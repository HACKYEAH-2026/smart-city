/** Minimum password length. Must match `minPasswordLength` in apps/api/src/auth.ts. */
export const MIN_PASSWORD_LENGTH = 8;

export type PasswordCheck = "length" | "digit" | "case" | "symbol";

const CHECKS: { id: PasswordCheck; passes: (password: string) => boolean }[] = [
  { id: "length", passes: (p) => p.length >= MIN_PASSWORD_LENGTH },
  { id: "digit", passes: (p) => /\d/.test(p) },
  { id: "case", passes: (p) => /\p{Lowercase_Letter}/u.test(p) && /\p{Uppercase_Letter}/u.test(p) },
  { id: "symbol", passes: (p) => /[^\p{Letter}\p{Number}]/u.test(p) },
];

/** Score 0–4 (one point per passed check) and the first check still missing (null when all pass). */
export function passwordStrength(password: string): { score: number; missing: PasswordCheck | null } {
  const failing = CHECKS.filter((c) => !c.passes(password));
  return { score: CHECKS.length - failing.length, missing: failing[0]?.id ?? null };
}
