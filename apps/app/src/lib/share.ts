import * as Linking from "expo-linking";
import { Share } from "react-native";

/**
 * The full address of a place in the app: the app's own scheme in a build, exp:// in Expo Go, this site's address
 * on the web.
 */
export const appLink = (path: string, queryParams?: Record<string, string>): string =>
  Linking.createURL(path, { queryParams });

/** Opens the system share sheet with a message (and, where the platform takes one, a separate link). */
export async function shareMessage(message: string, url?: string): Promise<void> {
  // A cancelled sheet or a platform without sharing is not an error for the resident: nothing else to do.
  await Share.share(url ? { message, url } : { message }).catch(() => undefined);
}

/** Opens the system share sheet with the link to a place in the app (e.g. an issue, for a neighbour). */
export const shareLink = (path: string): Promise<void> => shareMessage(appLink(path), appLink(path));
