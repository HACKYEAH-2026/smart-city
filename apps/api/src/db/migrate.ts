import { fileURLToPath } from "node:url";
import { migrate as run } from "drizzle-orm/bun-sqlite/migrator";
import type { DbHandle } from "./client";

/** Migrations directory; overridden by MIGRATIONS_DIR in the Docker image. */
export const migrationsFolder =
  process.env.MIGRATIONS_DIR ?? fileURLToPath(new URL("../../migrations", import.meta.url));

export async function migrate(handle: DbHandle): Promise<void> {
  run(handle.db, { migrationsFolder });
}
