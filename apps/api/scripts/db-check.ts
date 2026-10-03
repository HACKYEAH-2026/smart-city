/**
 * Schema check (verify stage), on a clean embedded database in memory and on disk (surrealkv):
 *  1. the platform schema applies, and applying it again is a no-op (idempotent, no migrations),
 *  2. all platform tables exist afterwards,
 *  3. built-in plugin tables sync, and a second sync plans only idempotent statements (no backfill, no OVERWRITE).
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

async function checkOn(label: string, url: string) {
  // Loaded here, not at the top: the parent process must not load the native engine (see below).
  const { loadPlugin } = await import("@app/plugin-sdk");
  const { planSchema, syncSchema } = await import("@app/plugin-sdk/engine");
  const { createDb, migrate, TABLES } = await import("../src/db");
  const { builtinPlugins } = await import("../src/plugins/builtin");
  const EXPECTED = [...Object.values(TABLES), "plugin_schema"];
  const handle = await createDb(url);
  try {
    await migrate(handle.db);
    await migrate(handle.db);
    const [info] = await handle.db.query<[{ tables: Record<string, string> }]>("INFO FOR DB;");
    const missing = EXPECTED.filter((t) => !(t in info.tables));
    if (missing.length) throw new Error(`${label}: tables missing after applying the schema: ${missing.join(", ")}`);
    const plugins = builtinPlugins.map((mod) => loadPlugin(mod));
    for (const { manifest, definition } of plugins) await syncSchema(handle.db, manifest.id, definition.tables ?? {});
    for (const { manifest, definition } of plugins) {
      const { statements } = await planSchema(handle.db, manifest.id, definition.tables ?? {});
      const changes = statements.filter((s) => !s.includes(" IF NOT EXISTS ") && !s.startsWith("UPSERT $id_schema_"));
      if (changes.length)
        throw new Error(`${label}: ${manifest.id} tables not stable after sync: ${changes.join(" ")}`);
    }
    console.log(`schema on clean database (${label}): OK [${Object.keys(info.tables).sort().join(", ")}]`);
  } finally {
    await handle.close();
  }
}

/**
 * Each target runs in its own process, and the parent never loads the native engine: with @surrealdb/node 3.0.3
 * Bun crashes on exit after schema writes (a crash report on stderr, exit code still 0), and with exit code 139
 * when one process opens two embedded engines. The child's stderr (also engine debug noise) is shown only on failure.
 */
const target = process.argv[2];
if (target) {
  await checkOn(target, target === "memory" ? "mem://" : `surrealkv://${join(process.argv[3] ?? "", "db")}`);
} else {
  const dir = mkdtempSync(join(tmpdir(), "schemacheck-"));
  try {
    const run = (args: string[]) => {
      const proc = Bun.spawnSync(["bun", import.meta.path, ...args], { stdout: "inherit", stderr: "pipe" });
      if (proc.exitCode !== 0) console.error(proc.stderr.toString());
      return proc.exitCode === 0;
    };
    const ok = [run(["memory"]), run(["disk", dir])].every(Boolean);
    if (!ok) process.exit(1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
// The embedded SurrealDB engine keeps the event loop alive after close().
process.exit(0);
