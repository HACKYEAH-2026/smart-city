import { formatInviteCode } from "@app/shared";
import * as Linking from "expo-linking";
import { Share } from "react-native";
import { t } from "../texts";

/**
 * Link that opens the preview of a place with this invite code (the QR on the "place created" screen and the
 * shared message): the app's own scheme in a build, exp:// in Expo Go, this site's address on the web.
 */
export const inviteLink = (code: string): string => Linking.createURL("/app/preview", { queryParams: { code } });

/**
 * Shares an invitation to the place (its name, the code and the link) through the system share sheet. A dismissed
 * sheet, or a browser without the Web Share API, rejects: there is nothing to tell the user then.
 */
export const shareInvite = (place: { name: string }, code: string): Promise<void> =>
  Share.share({
    message: `${t.invite_share_message_before}${place.name}${t.invite_share_message_after} ${formatInviteCode(code)}\n${inviteLink(code)}`,
  }).then(
    () => undefined,
    () => undefined,
  );
