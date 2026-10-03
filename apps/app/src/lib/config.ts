declare global {
  var __API_URL__: string | undefined;
}

/**
 * Jedyne miejsce, które zna adres API.
 *  - EXPO_PUBLIC_API_URL: wstrzykiwany w buildzie (staging/prod, patrz CI).
 *  - globalThis.__API_URL__: nadpisanie w runtime (E2E: osobne API na worker Playwrighta).
 *  - domyślnie dev na tej samej maszynie (emulator Androida: ustaw EXPO_PUBLIC_API_URL=http://10.0.2.2:4000).
 */
export function apiBaseUrl(): string {
  return globalThis.__API_URL__ ?? process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";
}
