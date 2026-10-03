import { loadPlugin } from "@app/plugin-sdk";
import { eq, getTableName, sql } from "drizzle-orm";
import { Hono } from "hono";
import type { Auth } from "./auth";
import { type Db, schema } from "./db";
import { builtinPlugins } from "./plugins/builtin";
import type { PluginHost } from "./plugins/host";

/**
 * Endpoints for tests and local dev only. Mounted only by test-server.ts with NODE_ENV=test.
 * Never import this file from production code.
 */
export const DEMO_COMMUNITY = { slug: "krakow", name: "Kraków" } as const;
export const DEMO_ADMIN = { email: "admin@krakow.test", password: "password123", name: "Urząd Miasta" } as const;

type Deps = { db: Db; auth: Auth; plugins: PluginHost };

/**
 * Dev/E2E seed data (idempotent): a demo community with built-in plugins (with onInstall)
 * and a community admin account.
 */
export async function seedDemo({ db, auth, plugins }: Deps) {
  db.insert(schema.communities).values(DEMO_COMMUNITY).onConflictDoNothing().run();
  const community = db.select().from(schema.communities).where(eq(schema.communities.slug, DEMO_COMMUNITY.slug)).get();
  if (!community) throw new Error("seed: community missing");
  for (const mod of builtinPlugins) {
    const pluginId = loadPlugin(mod).manifest.id;
    const created = db
      .insert(schema.pluginInstallations)
      .values({ communityId: community.id, pluginId })
      .onConflictDoNothing()
      .returning()
      .get();
    const plugin = plugins.get(pluginId);
    if (created && plugin) await plugins.install(plugin, created.id, community);
  }

  let admin = db.select().from(schema.user).where(eq(schema.user.email, DEMO_ADMIN.email)).get();
  if (!admin) {
    await auth.api.signUpEmail({ body: { ...DEMO_ADMIN } });
    admin = db.select().from(schema.user).where(eq(schema.user.email, DEMO_ADMIN.email)).get();
  }
  if (!admin) throw new Error("seed: admin account missing");
  db.insert(schema.memberships)
    .values({ communityId: community.id, userId: admin.id, role: "admin" })
    .onConflictDoUpdate({
      target: [schema.memberships.communityId, schema.memberships.userId],
      set: { role: "admin" },
    })
    .run();
}

export function createTestRoutes(deps: Deps) {
  return new Hono().post("/__test/reset", async (c) => {
    deps.db.transaction((tx) => {
      tx.run(sql`PRAGMA defer_foreign_keys = ON`);
      for (const table of Object.values(schema.allTables)) tx.run(sql.raw(`delete from "${getTableName(table)}"`));
    });
    await seedDemo(deps);
    return c.json({ ok: true });
  });
}
