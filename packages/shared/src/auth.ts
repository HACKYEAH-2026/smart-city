/**
 * Sign-in methods the API offers (GET /api/auth-providers). Google: the phone's native account picker asks Google
 * for an ID token for `webClientId` (iOS also needs its own `iosClientId`); the API verifies it and opens a session.
 * `google: null` = Google sign-in is off on this API (no GOOGLE_CLIENT_ID).
 */
export type GoogleClientIds = { webClientId: string; iosClientId: string | null };
export type AuthProviders = { google: GoogleClientIds | null };

/** Minimum password length, the only password rule (Better Auth on the API, the registration form in the app). */
export const MIN_PASSWORD_LENGTH = 5;
