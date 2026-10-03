import type { Db } from "@app/db";
import { schema } from "@app/db";
import { eq, getTableName, sql } from "drizzle-orm";
import { Hono } from "hono";
import { builtinPlugins } from "./plugins/builtin";
import { instantiate } from "./plugins/host";

/**
 * Endpointy wyłącznie dla testów i lokalnego dev. Montowane tylko przez test-server.ts przy NODE_ENV=test.
 * Nigdy nie importuj tego pliku z kodu produkcyjnego.
 */
export const DEMO_COMMUNITY = { slug: "krakow", name: "Kraków" } as const;

/** Dane startowe dev/E2E (idempotentne): społeczność demo z zainstalowanymi wtyczkami wbudowanymi. */
export function seedDemo(db: Db) {
  db.insert(schema.communities).values(DEMO_COMMUNITY).onConflictDoNothing().run();
  const community = db.select().from(schema.communities).where(eq(schema.communities.slug, DEMO_COMMUNITY.slug)).get();
  if (!community) throw new Error("seed: brak społeczności");
  for (const mod of builtinPlugins) {
    const pluginId = instantiate(mod).manifest.id;
    db.insert(schema.pluginInstallations).values({ communityId: community.id, pluginId }).onConflictDoNothing().run();
  }
}

export function createTestRoutes(db: Db) {
  return new Hono().post("/__test/reset", (c) => {
    db.transaction((tx) => {
      tx.run(sql`PRAGMA defer_foreign_keys = ON`);
      for (const table of Object.values(schema.allTables)) tx.run(sql.raw(`delete from "${getTableName(table)}"`));
    });
    seedDemo(db);
    return c.json({ ok: true });
  });
}
