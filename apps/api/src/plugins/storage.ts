import type { Db } from "@app/db";
import { schema } from "@app/db";
import type { PluginDoc, PluginStorage } from "@app/shared";
import { and, asc, desc, eq } from "drizzle-orm";

const { pluginDocs } = schema;
const COLLECTION = /^[a-z][a-z0-9_-]{0,39}$/;

const toDoc = <T>(row: typeof pluginDocs.$inferSelect): PluginDoc<T> => ({
  id: row.id,
  createdBy: row.createdBy,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  data: row.data as T,
});

function checkCollection(name: string) {
  if (!COLLECTION.test(name)) throw new Error(`Invalid collection name: ${name}`);
}

/**
 * Magazyn dokumentów jednej instalacji. KAŻDE zapytanie filtruje po installationId — to jest
 * granica izolacji między społecznościami i wtyczkami.
 */
export function createStorage(db: Db, installationId: string, userId: string): PluginStorage {
  const scoped = (collection: string, id?: string) =>
    and(
      eq(pluginDocs.installationId, installationId),
      eq(pluginDocs.collection, collection),
      id ? eq(pluginDocs.id, id) : undefined,
    );

  return {
    async list<T>(collection: string, opts: { order?: "newest" | "oldest"; limit?: number } = {}) {
      checkCollection(collection);
      const order = opts.order === "oldest" ? asc(pluginDocs.createdAt) : desc(pluginDocs.createdAt);
      const rows = await db
        .select()
        .from(pluginDocs)
        .where(scoped(collection))
        .orderBy(order)
        .limit(Math.min(opts.limit ?? 100, 500));
      return rows.map((r) => toDoc<T>(r));
    },
    async get<T>(collection: string, id: string) {
      checkCollection(collection);
      const [row] = await db.select().from(pluginDocs).where(scoped(collection, id));
      return row ? toDoc<T>(row) : null;
    },
    async add<T extends Record<string, unknown>>(collection: string, data: T) {
      checkCollection(collection);
      const [row] = await db
        .insert(pluginDocs)
        .values({ installationId, collection, data, createdBy: userId })
        .returning();
      if (!row) throw new Error("insert nie zwrócił wiersza");
      return toDoc<T>(row);
    },
    async update<T>(collection: string, id: string, patch: Record<string, unknown>) {
      checkCollection(collection);
      const [current] = await db.select().from(pluginDocs).where(scoped(collection, id));
      if (!current) return null;
      const [row] = await db
        .update(pluginDocs)
        .set({ data: { ...current.data, ...patch } })
        .where(scoped(collection, id))
        .returning();
      return row ? toDoc<T>(row) : null;
    },
    async remove(collection: string, id: string) {
      checkCollection(collection);
      const rows = await db.delete(pluginDocs).where(scoped(collection, id)).returning({ id: pluginDocs.id });
      return rows.length > 0;
    },
  };
}

/** Magazyn dla wtyczki bez uprawnienia "storage": każde użycie kończy się czytelnym błędem. */
export const deniedStorage: PluginStorage = new Proxy({} as PluginStorage, {
  get: () => () => Promise.reject(new Error('Plugin did not declare the "storage" permission')),
});
