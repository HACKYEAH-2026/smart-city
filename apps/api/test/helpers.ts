import { Database } from "bun:sqlite";
import type { AIProviders } from "../src/ai/types";
import { createApp } from "../src/app";
import { createDb, type DbHandle, fromSqlite, migrate } from "../src/db";
import { type Env, loadEnv } from "../src/env";
import { TEST_ENV } from "../src/test-env";
import { DEMO_ADMIN, seedDemo } from "../src/test-routes";

/**
 * SQLite snapshot: migrations run ONCE per test process, then each test gets a fresh
 * in-memory database restored from the snapshot (Database.deserialize) — no re-migration.
 */
let snapshot: Promise<Uint8Array> | undefined;

async function buildSnapshot(): Promise<Uint8Array> {
  const template = await createDb(":memory:");
  await migrate(template);
  const dump = template.sqlite.serialize();
  await template.close();
  return dump;
}

async function freshTestDb(): Promise<DbHandle> {
  snapshot ??= buildSnapshot();
  return fromSqlite(Database.deserialize(await snapshot));
}

export type TestUser = { id: string; email: string; headers: Record<string, string> };

/**
 * Integration test context: fresh database + app called via app.request() (no ports).
 * Usage: t = await setup(); ...; await t.close() in afterEach. `env` overrides TEST_ENV.
 */
export async function setup(env: Partial<Record<keyof Env, string | undefined>> = {}, opts: { ai?: AIProviders } = {}) {
  const handle = await freshTestDb();
  const { app, auth, plugins } = createApp({
    db: handle.db,
    env: loadEnv({ ...TEST_ENV, ...env }),
    ...(opts.ai ? { ai: opts.ai } : {}),
  });
  let seq = 0;

  const request = (path: string, init: RequestInit & { json?: unknown } = {}) => {
    const { json, ...rest } = init;
    const headers = new Headers(rest.headers);
    if (json !== undefined) headers.set("content-type", "application/json");
    return app.request(path, { ...rest, headers, body: json !== undefined ? JSON.stringify(json) : rest.body });
  };

  /** Data factory: registers a user via the real Better Auth endpoint. */
  const signUp = async (overrides: { email?: string; password?: string; name?: string } = {}) => {
    seq += 1;
    const email = overrides.email ?? `user${seq}@example.test`;
    const res = await request("/api/auth/sign-up/email", {
      method: "POST",
      json: { email, password: overrides.password ?? "password123", name: overrides.name ?? `User ${seq}` },
    });
    if (res.status !== 200) throw new Error(`signUp ${res.status}: ${await res.text()}`);
    const token = res.headers.get("set-auth-token");
    if (!token) throw new Error("signUp: missing set-auth-token header (bearer plugin?)");
    const body = (await res.json()) as { user: { id: string } };
    return { id: body.user.id, email, headers: { authorization: `Bearer ${token}` } } satisfies TestUser;
  };

  /** Demo data ("Kraków" community, built-in plugins, admin account) + signed-in admin. */
  const seed = async () => {
    await seedDemo({ db: handle.db, auth, plugins });
    const res = await request("/api/auth/sign-in/email", {
      method: "POST",
      json: { email: DEMO_ADMIN.email, password: DEMO_ADMIN.password },
    });
    const token = res.headers.get("set-auth-token");
    if (!token) throw new Error(`seed: admin sign-in ${res.status}`);
    return { admin: { headers: { authorization: `Bearer ${token}` } } };
  };

  return { app, db: handle.db, plugins, request, signUp, seed, close: handle.close };
}
export type Ctx = Awaited<ReturnType<typeof setup>>;
