import * as Linking from "expo-linking";

/**
 * Link that opens joining a place with this invite code (the QR on the "place created" screen and the shared
 * message): the app's own scheme in a build, exp:// in Expo Go, this site's address on the web.
 */
export const inviteLink = (code: string): string => Linking.createURL("/app/join", { queryParams: { code } });
