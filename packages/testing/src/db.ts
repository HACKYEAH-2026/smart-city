import { Database } from "bun:sqlite";
import { createDb, type DbHandle, fromSqlite, migrate } from "@app/db";

/**
 * Zrzut SQLite: migracje wykonują się RAZ na proces testowy, potem każdy test dostaje
 * świeżą bazę w pamięci odtworzoną ze zrzutu (Database.deserialize) — bez ponownych migracji.
 */
let snapshot: Promise<Uint8Array> | undefined;

async function buildSnapshot(): Promise<Uint8Array> {
  const template = await createDb(":memory:");
  await migrate(template);
  const dump = template.sqlite.serialize();
  await template.close();
  return dump;
}

/** Świeża, zmigrowana baza SQLite w pamięci dla pojedynczego testu. Zawsze wołaj close(). */
export async function freshTestDb(): Promise<DbHandle> {
  snapshot ??= buildSnapshot();
  return fromSqlite(Database.deserialize(await snapshot));
}
