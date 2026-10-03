declare global {
  var __API_URL__: string | undefined;
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
