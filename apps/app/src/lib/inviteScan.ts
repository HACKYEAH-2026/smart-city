import { parseInviteCode } from "@app/shared";

/** The invite code in a scanned QR code: the invite link's `code` parameter, or the bare code; null for anything else. */
export function inviteCodeFromScan(data: string): string | null {
  const fromLink = data.match(/[?&]code=([^&#\s]+)/)?.[1];
  return parseInviteCode(fromLink ?? data);
}
