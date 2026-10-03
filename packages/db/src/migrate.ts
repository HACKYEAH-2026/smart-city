import { fileURLToPath } from "node:url";
import { migrate as run } from "drizzle-orm/bun-sqlite/migrator";
import type { DbHandle } from "./client";

/** Katalog migracji; w obrazie Dockera nadpisywany przez MIGRATIONS_DIR. */
export const migrationsFolder = process.env.MIGRATIONS_DIR ?? fileURLToPath(new URL("../migrations", import.meta.url));

export async function migrate(handle: DbHandle): Promise<void> {
  run(handle.db, { migrationsFolder });
}
