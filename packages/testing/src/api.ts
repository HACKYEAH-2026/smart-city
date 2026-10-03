import type { DbHandle } from "@app/db";
import { TEST_ADMIN_TOKEN } from "./constants";
import { freshTestDb } from "./db";

/**
 * Minimalny kontrakt aplikacji potrzebny helperowi (celowo bez importu z apps/api,
 * żeby pakiet testing nie zależał od aplikacji).
 */
type RequestableApp = { request: (path: string, init?: RequestInit) => Response | Promise<Response> };
type AppFactory<A extends RequestableApp> = (db: DbHandle["db"]) => A;

/** Jedyne źródło konfiguracji testowej (integracja + test-server dla E2E/dev). */
export const TEST_ENV = {
  NODE_ENV: "test",
  DATABASE_URL: ":memory:",
  API_URL: "http://localhost:4000",
  BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-000",
  // statyczny eksport web (E2E) + Expo dev server (web)
  TRUSTED_ORIGINS: "http://localhost:4173,http://localhost:8081",
  PLUGIN_ADMIN_TOKEN: TEST_ADMIN_TOKEN,
} as const;

export type TestUser = { id: string; email: string; headers: Record<string, string> };

/**
 * Kontekst testu integracyjnego: świeża baza + aplikacja wołana przez app.request()
 * (bez portów). Użycie: const t = await setupApi(); ...; await t.close();
 */
export async function setupApi<A extends RequestableApp>(factory: AppFactory<A>) {
  const handle = await freshTestDb();
  const app = factory(handle.db);
  let seq = 0;

  const request = (path: string, init: RequestInit & { json?: unknown } = {}) => {
    const { json, ...rest } = init;
    const headers = new Headers(rest.headers);
    if (json !== undefined) headers.set("content-type", "application/json");
    return app.request(path, { ...rest, headers, body: json !== undefined ? JSON.stringify(json) : rest.body });
  };

  /** Fabryka danych: rejestruje użytkownika przez prawdziwy endpoint Better Auth. */
  const signUp = async (overrides: { email?: string; password?: string; name?: string } = {}) => {
    seq += 1;
    const email = overrides.email ?? `user${seq}@example.test`;
    const res = await request("/api/auth/sign-up/email", {
      method: "POST",
      json: { email, password: overrides.password ?? "password123", name: overrides.name ?? `User ${seq}` },
    });
    if (res.status !== 200) throw new Error(`signUp ${res.status}: ${await res.text()}`);
    const token = res.headers.get("set-auth-token");
    if (!token) throw new Error("signUp: brak nagłówka set-auth-token (plugin bearer?)");
    const body = (await res.json()) as { user: { id: string } };
    return { id: body.user.id, email, headers: { authorization: `Bearer ${token}` } } satisfies TestUser;
  };

  return { app, db: handle.db, request, signUp, close: handle.close };
}
