/**
 * Migration check (verify stage):
 *  1. drift: schema.ts must be fully covered by ./migrations (drizzle-kit generate creates nothing),
 *  2. migrations apply on a clean SQLite database (in memory and on file),
 *  3. re-running migrations is a no-op.
 */
import { cpSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDb, migrate, migrationsFolder } from "../src/db";

const EXPECTED = [
  "account",
  "communities",
  "memberships",
  "plugin_docs",
  "plugin_files",
  "plugin_installations",
  "plugin_sources",
  "session",
  "user",
  "verification",
];

function listFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true }).map(String).sort();
}

// 1. drift
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
    throw new Error("drizzle-kit generate failed");
  }
  const after = listFiles(tmp);
  if (after.length !== before.length) {
    throw new Error(
      `Schema drift: schema.ts has changes without a migration. Run 'bun run db:generate'. New files: ${after.filter((f) => !before.includes(f)).join(", ")}`,
    );
  }
  console.log("schema drift: none");
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

// 2 + 3. clean database
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
    if (missing.length) throw new Error(`${label}: tables missing after migration: ${missing.join(", ")}`);
    console.log(`migrations on clean database (${label}): OK [${list.join(", ")}]`);
  } finally {
    await handle.close();
  }
}

await checkOn("memory", ":memory:");
const dir = mkdtempSync(join(tmpdir(), "migcheck-"));
try {
  await checkOn("file", `file:${join(dir, "app.db")}`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
