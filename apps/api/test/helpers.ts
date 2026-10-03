import { testEngine } from "@app/plugin-sdk/testing";
import { surql } from "surrealdb";
import { createApp } from "../src/app";
import { communityBySlug, type DbHandle, first, keyOf, membershipRef, migrate, ref } from "../src/db";
import { type Env, loadEnv } from "../src/env";
import type { PluginAuthor } from "../src/services/ai/author";
import type { AIProviders } from "../src/services/ai/types";
import type { PushMessage, PushSender } from "../src/services/push/types";
import { TEST_ENV } from "../src/test-env";
import { TestGeocoder } from "../src/test-geocoder";
import { TEST_GOOGLE_CLIENT_ID, verifyTestGoogleIdToken } from "../src/test-google";
import { DEMO_ADMIN, DEMO_COMMUNITY, seedDemo } from "../src/test-routes";

/**
 * Each test gets a fresh database with the schema applied, on the one embedded engine of the test process
 * (`testEngine()` explains why there is only one). The Better Auth adapter needs the full client, so the
 * database is selected on it; tests in a process run one at a time. Databases are not removed: they are
 * small, in memory, and `REMOVE DATABASE` makes Bun 1.4 crash on exit with @surrealdb/node 3.0.3.
 */
async function freshTestDb(): Promise<DbHandle> {
  const db = await testEngine();
  const database = `api_${crypto.randomUUID().replaceAll("-", "")}`;
  await db.use({ namespace: "api", database });
  await migrate(db);
  return { db, close: async () => {} };
}

export type TestUser = { id: string; email: string; headers: Record<string, string> };

/**
 * Push service fake: records what would go to phones (tests never call Expo). `unregistered` tokens are
 * reported back as uninstalled apps; `failure` makes every send throw.
 */
export class RecordingPushSender implements PushSender {
  readonly sent: PushMessage[] = [];
  readonly unregistered = new Set<string>();
  failure?: Error;

  async send(messages: PushMessage[]) {
    if (this.failure) throw this.failure;
    this.sent.push(...messages);
    return { invalidTokens: messages.map((m) => m.to).filter((to) => this.unregistered.has(to)) };
  }
}

/**
 * Integration test context: fresh database + app called via app.request() (no ports).
 * Usage: t = await setup(); ...; await t.close() in afterEach. `env` overrides TEST_ENV. Google sign-in is on, with
 * fake ID tokens (src/test-google.ts). `author` is the plugin builder's AI (none by default: tests never call a model).
 */
export async function setup(
  env: Partial<Record<keyof Env, string | undefined>> = {},
  opts: { ai?: AIProviders; author?: PluginAuthor } = {},
) {
  const handle = await freshTestDb();
  const push = new RecordingPushSender();
  const { app, auth, plugins, notifications, drafts } = createApp({
    db: handle.db,
    env: loadEnv({ ...TEST_ENV, GOOGLE_CLIENT_ID: TEST_GOOGLE_CLIENT_ID, ...env }),
    push,
    verifyGoogleIdToken: verifyTestGoogleIdToken,
    geocoder: new TestGeocoder(),
    ...(opts.ai ? { ai: opts.ai } : {}),
    author: opts.author ?? null,
  });
  let seq = 0;

  const request = (path: string, init: RequestInit & { json?: unknown } = {}) => {
    const { json, ...rest } = init;
    const headers = new Headers(rest.headers);
    if (json !== undefined) headers.set("content-type", "application/json");
    return app.request(path, { ...rest, headers, body: json !== undefined ? JSON.stringify(json) : rest.body });
  };

  /** Makes a user a plain member of a place (joining is not in the API yet). */
  const join = async (user: TestUser, slug: string = DEMO_COMMUNITY.slug) => {
    const community = await communityBySlug(handle.db, slug);
    if (!community) throw new Error(`join: no place ${slug}`);
    await first(
      handle.db,
      surql`UPSERT ${membershipRef(keyOf(community.id), user.id)}
            MERGE { community: ${community.id}, user: ${ref("user", user.id)} };`,
    );
  };

  /** Data factory: registers a user via the real Better Auth endpoint; member of the demo place unless `place: null`. */
  const signUp = async (
    overrides: { email?: string; password?: string; name?: string; place?: string | null } = {},
  ) => {
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
    const user = { id: body.user.id, email, headers: { authorization: `Bearer ${token}` } } satisfies TestUser;
    const place = overrides.place === undefined ? DEMO_COMMUNITY.slug : overrides.place;
    if (place !== null && (await communityBySlug(handle.db, place))) await join(user, place);
    return user;
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

  return { app, db: handle.db, plugins, notifications, drafts, push, request, signUp, seed, join, close: handle.close };
}
export type Ctx = Awaited<ReturnType<typeof setup>>;
