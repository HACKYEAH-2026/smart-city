import { Hono } from "hono";
import type { RecordId } from "surrealdb";
import type { Auth } from "./auth";
import {
  communityBySlug,
  DATABASE,
  type Db,
  first,
  keyOf,
  membershipRef,
  migrate,
  NAMESPACE,
  ref,
  toCommunity,
} from "./db";
import type { PluginHost } from "./plugins/host";
import { syncPluginTables } from "./services/db/service";

/**
 * Endpoints for tests and local dev only. Mounted only by test-server.ts with NODE_ENV=test.
 * Never import this file from production code.
 */
export const DEMO_COMMUNITY = { slug: "krakow", name: "Kraków" } as const;
/** The demo place's invite code (shown as "KRK-MST"); anyone with it may join (join rule "open"). */
export const DEMO_INVITE_CODE = "KRKMST";
export const DEMO_ADMIN = { email: "admin@krakow.test", password: "password123", name: "Urząd Miasta" } as const;

type Deps = { db: Db; auth: Auth; plugins: PluginHost };

const userIdByEmail = async (db: Db, email: string) =>
  (await first<{ id: RecordId }>(db, "SELECT id FROM user WHERE email = $email;", { email }))?.id;

/**
 * Dev/E2E seed data (idempotent): a demo community with built-in plugins (with onInstall)
 * and a community admin account.
 */
export async function seedDemo({ db, auth, plugins }: Deps) {
  await db.query("INSERT IGNORE INTO community $data;", {
    data: { ...DEMO_COMMUNITY, kind: "district", join_rule: "open", invite_code: DEMO_INVITE_CODE },
  });
  const row = await communityBySlug(db, DEMO_COMMUNITY.slug);
  if (!row) throw new Error("seed: community missing");
  const community = toCommunity(row);
  await plugins.ready();
  for (const plugin of plugins.list().filter((p) => p.origin === "builtin")) await plugins.enable(plugin, community);

  const existing = await userIdByEmail(db, DEMO_ADMIN.email);
  const adminId = existing ? keyOf(existing) : (await auth.api.signUpEmail({ body: { ...DEMO_ADMIN } })).user.id;
  await db.query('UPSERT $m MERGE { community: $c, user: $u, role: "admin" };', {
    m: membershipRef(community.id, adminId),
    c: ref("community", community.id),
    u: ref("user", adminId),
  });
}

/**
 * Empties the database by switching the client to a new one (schema applied, tables of loaded plugins synced).
 * The old one is left in memory: `REMOVE DATABASE` makes Bun 1.4 crash on exit with @surrealdb/node 3.0.3.
 */
async function resetDb({ db, plugins }: Deps) {
  await db.use({ namespace: NAMESPACE, database: `${DATABASE}_${crypto.randomUUID().replaceAll("-", "")}` });
  await migrate(db);
  for (const plugin of plugins.list()) await syncPluginTables(db, plugin);
}

export function createTestRoutes(deps: Deps) {
  return (
    new Hono()
      .post("/__test/reset", async (c) => {
        await resetDb(deps);
        await seedDemo(deps);
        return c.json({ ok: true });
      })
      /** Invites an existing user to Kraków from its admin (the invitations screen shows it). */
      .post("/__test/invitation", async (c) => {
        const { email, slug } = await c.req.json<{ email: string; slug: string }>();
        const invitee = await first<{ id: RecordId }>(deps.db, "SELECT id FROM user WHERE email = $e;", { e: email });
        const community = await communityBySlug(deps.db, slug);
        const admin = await userIdByEmail(deps.db, DEMO_ADMIN.email);
        if (!invitee || !community || !admin) return c.json({ error: "not_found" }, 404);
        await first(deps.db, "CREATE invitation CONTENT { community: $c, user: $u, invited_by: $i };", {
          c: ref("community", keyOf(community.id)),
          u: ref("user", keyOf(invitee.id)),
          i: ref("user", keyOf(admin)),
        });
        return c.json({ ok: true });
      })
      /** Adds an existing user to a place as a plain member (joining is a separate screen, not in the API yet). */
      .post("/__test/membership", async (c) => {
        const { email, slug } = await c.req.json<{ email: string; slug: string }>();
        const user = await first<{ id: RecordId }>(deps.db, "SELECT id FROM user WHERE email = $e;", { e: email });
        const community = await communityBySlug(deps.db, slug);
        if (!user || !community) return c.json({ error: "not_found" }, 404);
        await first(deps.db, "UPSERT $m MERGE { community: $c, user: $u };", {
          m: membershipRef(keyOf(community.id), keyOf(user.id)),
          c: ref("community", keyOf(community.id)),
          u: ref("user", keyOf(user.id)),
        });
        return c.json({ ok: true });
      })
  );
}
