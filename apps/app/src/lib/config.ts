declare global {
  var __API_URL__: string | undefined;
  var __DEV_LOGIN__: boolean | undefined;
}

/**
 * The only place that knows the API URL.
 *  - EXPO_PUBLIC_API_URL: injected at build time (staging/prod, see CI).
 *  - globalThis.__API_URL__: runtime override (E2E: a separate API per Playwright worker).
 *  - default: dev on the same machine (Android emulator: set EXPO_PUBLIC_API_URL=http://10.0.2.2:4000).
 */
export function apiBaseUrl(): string {
  return globalThis.__API_URL__ ?? process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";
}

/** The demo place's admin the dev API seeds (DEMO_ADMIN in apps/api/src/test-routes.ts; PRODUCT.md). */
const DEMO_ADMIN = { email: "admin@krakow.test", password: "password" } as const;

/**
 * Dev login: a button at the bottom of the login screen signs in as the demo admin in one tap. Off by default.
 *  - EXPO_PUBLIC_DEV_LOGIN=true in the repo-root .env (the app's dev script loads it, see .env.example).
 *  - globalThis.__DEV_LOGIN__: runtime override (E2E, like __API_URL__).
 */
export function devLoginAccount(): typeof DEMO_ADMIN | null {
  const on = globalThis.__DEV_LOGIN__ ?? process.env.EXPO_PUBLIC_DEV_LOGIN === "true";
  return on ? DEMO_ADMIN : null;
}
