/**
 * Session token (Better Auth, bearer plugin) — one path for web, iOS and Android.
 * Kept in memory (synchronous read on every request) and persisted in Storage.
 * Pure logic, tested in token.test.ts with an in-memory store.
 */
import type { Storage } from "./storage";

export const TOKEN_KEY = "auth_token";

export function createTokenStore(storage: Storage) {
  let token: string | null = null;
  let loaded = false;
  return {
    /** Loads the token from storage (once, at app startup). */
    async load() {
      token = await storage.get(TOKEN_KEY);
      loaded = true;
      return token;
    },
    isLoaded: () => loaded,
    get: () => token,
    /** Stores the token from the Better Auth response header, if present. */
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
