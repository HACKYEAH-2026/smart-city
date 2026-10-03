import type { GoogleClientIds } from "@app/shared";

declare global {
  /** E2E only: the token the "account picker" returns (null = closed); unset = no Google button. */
  var __GOOGLE_ID_TOKEN__: string | null | undefined;
}

/**
 * Web build: no Google sign-in (the app ships on Android and iOS; the web export runs E2E). Same API as google.ts.
 * E2E stands in for the native account picker with `globalThis.__GOOGLE_ID_TOKEN__` (like `__API_URL__` in
 * config.ts), so the screen and the session path after the picker are tested.
 */
export const googleSignInAvailable = (_ids: GoogleClientIds): boolean => globalThis.__GOOGLE_ID_TOKEN__ !== undefined;

export async function googleIdToken(_ids: GoogleClientIds): Promise<string | null> {
  return globalThis.__GOOGLE_ID_TOKEN__ ?? null;
}

export async function googleSignOut(): Promise<void> {}
