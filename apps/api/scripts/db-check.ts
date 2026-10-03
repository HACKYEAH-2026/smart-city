/**
 * Kontrola migracji (etap verify):
 *  1. dryf: schema.ts musi być w pełni pokryty przez ./migrations (drizzle-kit generate nic nie tworzy),
 *  2. migracje przechodzą na czystej bazie SQLite (w pamięci i w pliku),
 *  3. ponowne uruchomienie migracji jest no-opem.
 */
import { cpSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDb, migrate, migrationsFolder } from "../src/db";

const EXPECTED = [
  "account",
  "communities",
  "plugin_docs",
  "plugin_installations",
  "plugin_sources",
  "session",
  "user",
  "verification",
];

function listFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true }).map(String).sort();
}

// 1. dryf
const tmp = mkdtempSync(join(tmpdir(), "drift-"));
try {
  cpSync(migrationsFolder, tmp, { recursive: true });
  const before = listFiles(tmp);
  const proc = Bun.spawnSync(["bunx", "drizzle-kit", "generate"], {
    cwd: join(import.meta.dir, ".."),
    env: { ...process.env, DRIZZLE_OUT: tmp },
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) {
    console.error(proc.stderr.toString());
    throw new Error("drizzle-kit generate zakończył się błędem");
  }
  const after = listFiles(tmp);
  if (after.length !== before.length) {
    throw new Error(
      `Dryf schematu: schema.ts ma zmiany bez migracji. Uruchom 'bun run db:generate'. Nowe pliki: ${after.filter((f) => !before.includes(f)).join(", ")}`,
    );
  }
  console.log("dryf schematu: brak");
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

// 2 + 3. czysta baza
async function checkOn(label: string, url: string) {
  const handle = await createDb(url);
  try {
    await migrate(handle);
    await migrate(handle);
    const list = handle.sqlite
      .query<{ name: string }, []>(
        "select name from sqlite_master where type = 'table' and name not like 'sqlite_%' and name not like '__drizzle%' order by name",
      )
      .all()
      .map((r) => r.name);
    const missing = EXPECTED.filter((t) => !list.includes(t));
    if (missing.length) throw new Error(`${label}: brak tabel po migracji: ${missing.join(", ")}`);
    console.log(`migracje na czystej bazie (${label}): OK [${list.join(", ")}]`);
  } finally {
    await handle.close();
  }
}

await checkOn("pamięć", ":memory:");
const dir = mkdtempSync(join(tmpdir(), "migcheck-"));
try {
  await checkOn("plik", `file:${join(dir, "app.db")}`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
