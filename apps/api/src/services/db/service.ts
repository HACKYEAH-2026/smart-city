import type { Database, Doc, Query } from "@app/plugin-sdk";
import { and, asc, desc, eq, type SQL, sql } from "drizzle-orm";
import { type Db, schema } from "../../db";

const { pluginDocs } = schema;
const NAME = /^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/;
const KEY = /^[^\s]{1,200}$/;

const toDoc = <T>(row: typeof pluginDocs.$inferSelect): Doc<T> => ({
  id: row.id,
  createdBy: row.createdBy,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  data: row.data as T,
});

function check(re: RegExp, what: string, value: string) {
  if (!re.test(value)) throw new Error(`Invalid ${what}: ${value}`);
}

/** where: equality on top-level JSON fields (booleans in SQLite JSON are 1/0). */
function whereClause(where: Record<string, unknown> = {}): SQL[] {
  return Object.entries(where).map(([field, value]) => {
    check(NAME, "where field", field);
    const path = `$.${field}`;
    if (value === null) return sql`json_extract(${pluginDocs.data}, ${path}) is null`;
    if (typeof value === "boolean") return sql`json_extract(${pluginDocs.data}, ${path}) = ${value ? 1 : 0}`;
    if (typeof value === "string" || typeof value === "number") {
      return sql`json_extract(${pluginDocs.data}, ${path}) = ${value}`;
    }
    throw new Error(`where.${field}: only string, number, boolean or null are supported`);
  });
}

/**
 * Document store of a single installation (`ctx.db`), kept in the app database (`src/db`, table plugin_docs).
 * EVERY query filters by installationId — this is the isolation boundary between communities and plugins.
 */
export function createPluginDb(db: Db, installationId: string, userId: string | null): Database {
  const scoped = (collection: string, id?: string) => {
    check(NAME, "collection", collection);
    return and(
      eq(pluginDocs.installationId, installationId),
      eq(pluginDocs.collection, collection),
      id === undefined ? undefined : eq(pluginDocs.id, id),
    );
  };

  return {
    async get<T>(collection: string, id: string) {
      const [row] = await db.select().from(pluginDocs).where(scoped(collection, id));
      return row ? toDoc<T>(row) : null;
    },
    async list<T>(collection: string, query: Query<T> = {}) {
      const order = query.order === "oldest" ? asc(pluginDocs.createdAt) : desc(pluginDocs.createdAt);
      const rows = await db
        .select()
        .from(pluginDocs)
        .where(and(scoped(collection), ...whereClause(query.where as Record<string, unknown>)))
        .orderBy(order)
        .limit(Math.min(query.limit ?? 100, 500));
      return rows.map((r) => toDoc<T>(r));
    },
    async create<T extends Record<string, unknown>>(collection: string, data: T) {
      check(NAME, "collection", collection);
      const [row] = await db
        .insert(pluginDocs)
        .values({ id: crypto.randomUUID(), installationId, collection, data, createdBy: userId })
        .returning();
      if (!row) throw new Error("insert returned no row");
      return toDoc<T>(row);
    },
    async upsert<T extends Record<string, unknown>>(collection: string, key: string, data: T) {
      check(NAME, "collection", collection);
      check(KEY, "key", key);
      const [row] = await db
        .insert(pluginDocs)
        .values({ id: key, installationId, collection, data, createdBy: userId })
        .onConflictDoUpdate({
          target: [pluginDocs.installationId, pluginDocs.collection, pluginDocs.id],
          set: { data, updatedAt: new Date() },
        })
        .returning();
      if (!row) throw new Error("upsert returned no row");
      return toDoc<T>(row);
    },
    async update<T>(collection: string, id: string, patch: Partial<T>) {
      const [current] = await db.select().from(pluginDocs).where(scoped(collection, id));
      if (!current) return null;
      const [row] = await db
        .update(pluginDocs)
        .set({ data: { ...current.data, ...(patch as Record<string, unknown>) } })
        .where(scoped(collection, id))
        .returning();
      return row ? toDoc<T>(row) : null;
    },
    async remove(collection: string, id: string) {
      const rows = await db.delete(pluginDocs).where(scoped(collection, id)).returning({ id: pluginDocs.id });
      return rows.length > 0;
    },
  };
}
