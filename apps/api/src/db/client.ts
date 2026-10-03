import { Database } from "bun:sqlite";
import { type BunSQLiteDatabase, drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";

/** Client type as seen by the app. */
export type Db = BunSQLiteDatabase<typeof schema>;
export type DbHandle = { db: Db; sqlite: Database; close: () => Promise<void> };

/**
 * The only database client factory (SQLite via bun:sqlite). File chosen by DATABASE_URL:
 *   :memory:              -> in-memory database (tests, E2E)
 *   file:/abs/path.db     -> file on disk (production: /data volume)
 *   file:./rel/path.db    -> file relative to the working directory (dev)
 */
export async function createDb(url: string): Promise<DbHandle> {
  if (url === ":memory:") return fromSqlite(new Database(":memory:"));
  if (url.startsWith("file:")) return fromSqlite(new Database(url.slice("file:".length), { create: true }));
  throw new Error(`Unsupported DATABASE_URL: ${url.split(":")[0]}: (expected :memory: or file:<path>)`);
}

/** Wraps an existing connection (used by the snapshot-based test helpers). */
export function fromSqlite(sqlite: Database): DbHandle {
  // SQLite does NOT enforce foreign keys by default (onDelete: cascade) — enable per connection.
  sqlite.run("PRAGMA foreign_keys = ON");
  sqlite.run("PRAGMA journal_mode = WAL");
  sqlite.run("PRAGMA busy_timeout = 5000");
  const db = drizzle(sqlite, { schema });
  return {
    db,
    sqlite,
    close: async () => sqlite.close(),
  };
}
