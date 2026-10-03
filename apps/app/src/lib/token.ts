/**
 * Token sesji (Better Auth, plugin bearer) — jedna ścieżka dla web, iOS i Androida.
 * Trzymany w pamięci (synchroniczny odczyt przy każdym żądaniu) i utrwalany w Storage.
 * Logika czysta, testowana w token.test.ts z magazynem w pamięci.
 */
import type { Storage } from "./storage";

export const TOKEN_KEY = "auth_token";

export function createTokenStore(storage: Storage) {
  let token: string | null = null;
  let loaded = false;
  return {
    /** Wczytuje token z magazynu (raz, przy starcie aplikacji). */
    async load() {
      token = await storage.get(TOKEN_KEY);
      loaded = true;
      return token;
    },
    isLoaded: () => loaded,
    get: () => token,
    /** Zapisuje token z nagłówka odpowiedzi Better Auth, jeśli jest. */
    async capture(headers: Headers) {
      const t = headers.get("set-auth-token");
      if (!t) return;
      token = t;
      await storage.set(TOKEN_KEY, t);
    },
    async clear() {
      token = null;
      await storage.remove(TOKEN_KEY);
    },
    headers: (): Record<string, string> => (token ? { authorization: `Bearer ${token}` } : {}),
  };
}

export type TokenStore = ReturnType<typeof createTokenStore>;
