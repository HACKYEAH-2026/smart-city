import { Database } from "bun:sqlite";
import { type BunSQLiteDatabase, drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";

/** Typ klienta widziany przez aplikację. */
export type Db = BunSQLiteDatabase<typeof schema>;
export type DbHandle = { db: Db; sqlite: Database; close: () => Promise<void> };

/**
 * Jedyna fabryka klienta bazy (SQLite przez bun:sqlite). Wybór pliku przez DATABASE_URL:
 *   :memory:              -> baza w pamięci (testy, E2E)
 *   file:/abs/path.db     -> plik na dysku (produkcja: wolumen /data)
 *   file:./rel/path.db    -> plik względem katalogu roboczego (dev)
 */
export async function createDb(url: string): Promise<DbHandle> {
  if (url === ":memory:") return fromSqlite(new Database(":memory:"));
  if (url.startsWith("file:")) return fromSqlite(new Database(url.slice("file:".length), { create: true }));
  throw new Error(`Nieobsługiwany DATABASE_URL: ${url.split(":")[0]}: (oczekiwano :memory: lub file:<ścieżka>)`);
}

/** Opakowuje istniejące połączenie (używane przez helpery testowe ze zrzutem). */
export function fromSqlite(sqlite: Database): DbHandle {
  // SQLite domyślnie NIE egzekwuje kluczy obcych (onDelete: cascade) — włączamy per połączenie.
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
