/** Minimum password length, the only password rule. Must match `minPasswordLength` in apps/api/src/auth.ts. */
export const MIN_PASSWORD_LENGTH = 5;

export type PasswordCheck = "length";

/**
 * Meter score 0–4: the segments fill as the password approaches the minimum length and are all full exactly
 * when it is met. `missing` = the unmet rule (null once the password is long enough).
 */
export function passwordStrength(password: string): { score: number; missing: PasswordCheck | null } {
  const score = Math.min(4, Math.floor((password.length * 4) / MIN_PASSWORD_LENGTH));
  return { score, missing: password.length >= MIN_PASSWORD_LENGTH ? null : "length" };
}
