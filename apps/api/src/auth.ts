import { betterAuth } from "better-auth";
import { bearer } from "better-auth/plugins";
import { surrealdbAdapter } from "surreal-better-auth";
import type { Db } from "./db";
import type { Env } from "./env";

/**
 * Better Auth: email + password, stored in SurrealDB (community adapter `surreal-better-auth`, schemaless
 * tables user/session/account/verification; user ids are record keys of `user`). The bearer plugin gives one
 * auth path for web and the native Expo app (Authorization header), without relying on cookies.
 */
export function createAuth(db: Db, env: Env) {
  return betterAuth({
    baseURL: env.API_URL,
    basePath: "/api/auth",
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: env.TRUSTED_ORIGINS,
    database: surrealdbAdapter(db, { schemaMode: "schemaless" }),
    // The only password rule; must match MIN_PASSWORD_LENGTH in apps/app/src/lib/passwordStrength.ts.
    emailAndPassword: { enabled: true, autoSignIn: true, minPasswordLength: 5 },
    plugins: [bearer()],
    rateLimit: { enabled: env.NODE_ENV === "production" },
  });
}

export type Auth = ReturnType<typeof createAuth>;
export type SessionUser = Auth["$Infer"]["Session"]["user"];
