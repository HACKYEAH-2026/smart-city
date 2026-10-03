/**
 * Fake Google ID tokens for integration tests, E2E and nothing else (never import from production code).
 * Tests cannot get a token signed by Google, so the test API swaps Better Auth's Google signature check for
 * `verifyTestGoogleIdToken`: an HS256 JWT with Google's claims, signed with a test key. Everything after the
 * check (reading the claims, creating the account, the session) is the production path.
 * Only node:crypto: Playwright (Node) imports this file too.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/** Web client ID of the fake Google project (GOOGLE_CLIENT_ID in tests). */
export const TEST_GOOGLE_CLIENT_ID = "test-web-client.apps.googleusercontent.com";
const KEY = "test-google-signing-key";

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
const sign = (data: string) => createHmac("sha256", KEY).update(data).digest();

/** The ID token the system account picker would return for this Google account. */
export function testGoogleIdToken(account: { email: string; name?: string; sub?: string }): string {
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: "https://accounts.google.com",
    aud: TEST_GOOGLE_CLIENT_ID,
    sub: account.sub ?? `google-${account.email}`,
    email: account.email,
    email_verified: true,
    name: account.name ?? account.email,
    iat: now,
    exp: now + 3600,
  };
  const data = `${encode({ alg: "HS256", typ: "JWT" })}.${encode(claims)}`;
  return `${data}.${sign(data).toString("base64url")}`;
}

const claimsOf = (payload: string): { aud?: unknown; exp?: unknown } =>
  JSON.parse(Buffer.from(payload, "base64url").toString());

/** Better Auth `verifyIdToken` for tests: our signature, our audience, not expired. */
export async function verifyTestGoogleIdToken(token: string): Promise<boolean> {
  const [header = "", payload = "", signature = ""] = token.split(".");
  const expected = sign(`${header}.${payload}`);
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return false;
  const claims = claimsOf(payload);
  return claims.aud === TEST_GOOGLE_CLIENT_ID && Number(claims.exp) > Date.now() / 1000;
}
