import type { GoogleClientIds } from "@app/shared";
import { isRunningInExpoGo } from "expo";
import { Platform } from "react-native";

/**
 * Native Google sign-in (@react-native-google-signin/google-signin): the system account picker, no browser. It
 * returns an ID token issued to our web client ID, which the API verifies (session.ts). The web build uses
 * google.web.ts (no Google sign-in there).
 * The module is native code that Expo Go does not ship (it throws on import there), so it is loaded lazily and the
 * button is hidden in Expo Go; Google sign-in works in the dev build (android:debug) and in release builds.
 */
const googleSignIn = () => import("@react-native-google-signin/google-signin");

/** iOS also needs its own client ID (and the build its URL scheme: GOOGLE_IOS_CLIENT_ID in app.config.ts). */
export const googleSignInAvailable = (ids: GoogleClientIds): boolean =>
  !isRunningInExpoGo() && (Platform.OS !== "ios" || ids.iosClientId !== null);

/** Shows the account picker; the picked account's ID token, or null when the user closed it. Throws on errors. */
export async function googleIdToken(ids: GoogleClientIds): Promise<string | null> {
  const { GoogleSignin, isSuccessResponse } = await googleSignIn();
  GoogleSignin.configure({
    webClientId: ids.webClientId,
    ...(ids.iosClientId ? { iosClientId: ids.iosClientId } : {}),
  });
  // Android: Google Play services are required (offers the update dialog); iOS: always true.
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) return null;
  if (!response.data.idToken) throw new Error("Google sign-in returned no ID token (is webClientId a Web client?)");
  return response.data.idToken;
}

/** On sign-out: forget the picked account, so the next Google sign-in asks which account to use. */
export async function googleSignOut(): Promise<void> {
  if (isRunningInExpoGo()) return;
  const { GoogleSignin } = await googleSignIn();
  if (GoogleSignin.hasPreviousSignIn()) await GoogleSignin.signOut();
}
