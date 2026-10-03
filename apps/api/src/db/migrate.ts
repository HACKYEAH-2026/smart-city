import type { Db } from "./client";
import { SCHEMA } from "./schema";

/** Applies the (idempotent) schema. Safe to run on every start and repeatedly. */
export async function migrate(db: Db): Promise<void> {
  await db.query(SCHEMA);
}
