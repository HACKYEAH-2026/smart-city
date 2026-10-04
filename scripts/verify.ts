/**
 * bun run verify — the definition of done: lint, typecheck, unit, integration and schema checks, run concurrently
 * (each prints its output when it finishes). Any failure ends the run with exit code != 0 after the summary.
 * The slow stages are separate commands, run when a change needs them (AGENTS.md): `bun run e2e` (Playwright on a
 * web export), `bun run build`, `bun run android` (in `nix develop .#android`).
 * Skipping a check only explicitly: VERIFY_SKIP=unit (a skip is visible in the summary and is not a green verify).
 */
type Stage = { name: string; cmd: string[] };
type Result = { name: string; status: "OK" | "FAIL" | "SKIP"; ms: number; code: number; note?: string };

const checks: Stage[] = [
  { name: "lint + format", cmd: ["bun", "run", "lint"] },
  { name: "typecheck", cmd: ["bun", "run", "typecheck"] },
  { name: "unit", cmd: ["bun", "run", "test:unit"] },
  { name: "integration (SurrealDB in memory)", cmd: ["bun", "run", "test:int"] },
  { name: "schema (clean database, idempotent)", cmd: ["bun", "run", "db:check"] },
];

const skip = new Set(
  (process.env.VERIFY_SKIP ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);
const key = (s: Stage) => s.name.split(" ")[0] ?? s.name;
const started = performance.now();

function summary(results: Result[]) {
  console.log("\n================== verify: summary ===================");
  for (const r of results) {
    const t = `${(r.ms / 1000).toFixed(1)}s`.padStart(7);
    console.log(`${r.status.padEnd(4)} ${t}  ${r.name}${r.note ? `  (${r.note})` : ""}`);
  }
  const total = performance.now() - started;
  console.log(
    `------------------------------------------------------\ntotal ${(total / 1000).toFixed(1)}s (wall clock)`,
  );
}

/** Runs a check with its output collected and printed in one block when it finishes. */
async function run(stage: Stage): Promise<Result> {
  if (skip.has(key(stage))) return { name: stage.name, status: "SKIP", ms: 0, code: 0, note: "VERIFY_SKIP" };
  const start = performance.now();
  // stderr joins stdout at the source, so log lines stay next to the test or error they belong to.
  const proc = Bun.spawn(["sh", "-c", 'exec "$@" 2>&1', "sh", ...stage.cmd], { stdout: "pipe", stderr: "inherit" });
  const [out, code] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
  console.log(`\n▶ ${stage.name}: ${stage.cmd.join(" ")}\n${out}`);
  const ms = performance.now() - start;
  return code === 0
    ? { name: stage.name, status: "OK", ms, code }
    : { name: stage.name, status: "FAIL", ms, code, note: `exit ${code}` };
}

console.log(`\n▶ ${checks.map((s) => s.name).join(", ")}: concurrently, output per stage when it ends`);
const results = await Promise.all(checks.map(run));
summary(results);
const failed = results.find((r) => r.status === "FAIL");
if (failed) process.exit(failed.code || 1);
const skipped = results.filter((r) => r.status === "SKIP").length;
console.log(skipped ? `verify: OK with skips (${skipped})` : "verify: OK");
