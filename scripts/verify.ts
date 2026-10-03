/**
 * bun run verify — the ONLY definition of done. The checks (lint … schema) are independent and run concurrently;
 * each prints its output when it finishes. Then build, e2e (on the web export the build stage just made) and android
 * run in order. Any failure ends the run with exit code != 0 after the summary. Skipping a stage only explicitly:
 * VERIFY_SKIP=android,e2e (a skip is visible in the summary and is not a "green" verify for the task).
 */
type Stage = { name: string; cmd: string[]; needs?: string[]; shell?: string; env?: Record<string, string> };
type Result = { name: string; status: "OK" | "FAIL" | "SKIP"; ms: number; code: number; note?: string };

const checks: Stage[] = [
  { name: "lint + format", cmd: ["bun", "run", "lint"] },
  { name: "typecheck", cmd: ["bun", "run", "typecheck"] },
  { name: "unit", cmd: ["bun", "run", "test:unit"] },
  { name: "integration (SurrealDB in memory)", cmd: ["bun", "run", "test:int"] },
  { name: "schema (clean database, idempotent)", cmd: ["bun", "run", "db:check"] },
];
const build: Stage = { name: "build (api + web: expo export static)", cmd: ["bun", "run", "build"] };
// The web export does not depend on the API address (injected at runtime), so e2e reuses the build stage's dist/.
const e2e = (prebuilt: boolean): Stage => ({
  name: "e2e (Playwright)",
  cmd: ["bun", "run", "e2e"],
  env: { E2E_PREBUILT: prebuilt ? "1" : "" },
});
const android: Stage = {
  name: "android (expo prebuild + assembleDebug)",
  cmd: ["bun", "run", "android"],
  needs: ["JAVA_HOME", "ANDROID_HOME", "ANDROID_NDK_HOME"],
  shell: ".#android",
};

const skip = new Set(
  (process.env.VERIFY_SKIP ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);
const key = (s: Stage) => s.name.split(" ")[0] ?? s.name;
const results: Result[] = [];
const started = performance.now();

function missing(needs: string[] = []): string[] {
  return needs.filter((n) => (n === n.toUpperCase() ? !process.env[n] : !Bun.which(n)));
}

function summary() {
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

/** Runs a stage; with `buffered`, its output is collected and printed in one block when it finishes. */
async function run(stage: Stage, buffered: boolean): Promise<Result> {
  if (skip.has(key(stage))) return { name: stage.name, status: "SKIP", ms: 0, code: 0, note: "VERIFY_SKIP" };
  const lacking = missing(stage.needs);
  if (lacking.length) {
    const note = `missing: ${lacking.join(", ")} — run in 'nix develop${stage.shell ? ` ${stage.shell}` : ""}'`;
    return { name: stage.name, status: "FAIL", ms: 0, code: 1, note };
  }
  const header = `\n▶ ${stage.name}: ${stage.cmd.join(" ")}`;
  if (!buffered) console.log(header);
  const start = performance.now();
  const io = buffered ? "pipe" : "inherit";
  // Buffered: stderr joins stdout at the source, so log lines stay next to the test or error they belong to.
  const cmd = buffered ? ["sh", "-c", 'exec "$@" 2>&1', "sh", ...stage.cmd] : stage.cmd;
  const proc = Bun.spawn(cmd, { stdout: io, stderr: "inherit", env: { ...process.env, ...stage.env } });
  const [out, code] = await Promise.all([
    buffered ? new Response(proc.stdout as ReadableStream).text() : "",
    proc.exited,
  ]);
  if (buffered) console.log(`${header}\n${out}`);
  const ms = performance.now() - start;
  return code === 0
    ? { name: stage.name, status: "OK", ms, code }
    : { name: stage.name, status: "FAIL", ms, code, note: `exit ${code}` };
}

function finish(): never {
  summary();
  const failed = results.find((r) => r.status === "FAIL");
  if (failed) process.exit(failed.code || 1);
  const skipped = results.filter((r) => r.status === "SKIP").length;
  console.log(skipped ? `verify: OK with skips (${skipped})` : "verify: OK");
  process.exit(0);
}

console.log(`\n▶ ${checks.map((s) => s.name).join(", ")}: concurrently, output per stage when it ends`);
results.push(...(await Promise.all(checks.map((s) => run(s, true)))));
if (results.some((r) => r.status === "FAIL")) finish();

const built = await run(build, false);
results.push(built);
if (built.status === "FAIL") finish();

for (const stage of [e2e(built.status === "OK"), android]) {
  const result = await run(stage, false);
  results.push(result);
  if (result.status === "FAIL") finish();
}
finish();
