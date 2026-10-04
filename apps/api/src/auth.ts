import { type AuthProviders, MIN_PASSWORD_LENGTH } from "@app/shared";
import { betterAuth } from "better-auth";
import { bearer } from "better-auth/plugins";
import { surrealdbAdapter } from "surreal-better-auth";
import type { Db } from "./db";
import type { Env } from "./env";
import { libraryLogger } from "./log";

/** Checks a Google ID token's signature; replaces Better Auth's check against Google's keys (tests only). */
export type GoogleIdTokenVerifier = (token: string) => Promise<boolean>;

/** What the app needs to offer Google sign-in (GET /api/auth-providers). */
export const authProviders = (env: Env): AuthProviders => ({
  google: env.GOOGLE_CLIENT_ID
    ? { webClientId: env.GOOGLE_CLIENT_ID, iosClientId: env.GOOGLE_IOS_CLIENT_ID ?? null }
    : null,
});

/**
 * Google sign-in on the phones: the native account picker returns an ID token, the app posts it to
 * /api/auth/sign-in/social (`idToken`). Better Auth verifies it (Google's keys, issuer, audience = our client IDs,
 * age), creates the account on first use and opens a session. An email that already has a password account is not
 * linked: Better Auth requires the local email to be verified first, and ours never is (no verification emails).
 * Otherwise whoever registered someone else's address with a password would keep a way into the account that its
 * owner later opens with Google.
 */
function googleProvider(env: Env, verifyIdToken?: GoogleIdTokenVerifier) {
  if (!env.GOOGLE_CLIENT_ID) return {};
  const clientId = [env.GOOGLE_CLIENT_ID, env.GOOGLE_IOS_CLIENT_ID].filter((id): id is string => Boolean(id));
  return { google: { clientId, ...(verifyIdToken ? { verifyIdToken } : {}) } };
}

/**
 * Better Auth: email + password and Google, stored in SurrealDB (community adapter `surreal-better-auth`, schemaless
 * tables user/session/account/verification; user ids are record keys of `user`). The bearer plugin gives one
 * auth path for web and the native Expo app (Authorization header), without relying on cookies.
 */
export function createAuth(db: Db, env: Env, opts: { verifyGoogleIdToken?: GoogleIdTokenVerifier } = {}) {
  const auth = libraryLogger("auth");
  return betterAuth({
    baseURL: env.API_URL,
    basePath: "/api/auth",
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: env.TRUSTED_ORIGINS,
    database: surrealdbAdapter(db, { schemaMode: "schemaless" }),
    emailAndPassword: { enabled: true, autoSignIn: true, minPasswordLength: MIN_PASSWORD_LENGTH },
    socialProviders: googleProvider(env, opts.verifyGoogleIdToken),
    plugins: [bearer()],
    rateLimit: { enabled: env.NODE_ENV === "production" },
    // Everything Better Auth logs (failed sign-ins, Google token checks…) goes to ours; LOG_LEVEL filters it.
    logger: { level: "debug", log: (level, message, ...args) => auth[level](message, ...args) },
  });
}

export type Auth = ReturnType<typeof createAuth>;
export type SessionUser = Auth["$Infer"]["Session"]["user"];
