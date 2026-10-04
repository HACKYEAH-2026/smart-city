import * as Linking from "expo-linking";
import { Share } from "react-native";

/** The full address of a place in the app: the app's own scheme in a build, this site's address on the web. */
export const appLink = (path: string): string => Linking.createURL(path);

/** Opens the system share sheet with the link to a place in the app (e.g. an issue, for a neighbour). */
export async function shareLink(path: string): Promise<void> {
  // A cancelled sheet or a platform without sharing is not an error for the resident: nothing else to do.
  await Share.share({ message: appLink(path), url: appLink(path) }).catch(() => undefined);
}
