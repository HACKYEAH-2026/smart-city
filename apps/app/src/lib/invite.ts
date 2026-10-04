import { formatInviteCode } from "@app/shared";
import { t } from "../texts";
import { appLink, shareMessage } from "./share";

/** Link that opens the preview of a place with this invite code (the QR on the "place created" screen and the shared message). */
export const inviteLink = (code: string): string => appLink("/app/preview", { code });

/** Shares an invitation to the place (its name, the code and the link) through the system share sheet. */
export const shareInvite = (place: { name: string }, code: string): Promise<void> =>
  shareMessage(
    `${t.invite_share_message_before}${place.name}${t.invite_share_message_after} ${formatInviteCode(code)}\n${inviteLink(code)}`,
  );
