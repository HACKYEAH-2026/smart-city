/**
 * bun run verify — the ONLY definition of done. Stages run in order; the first failure ends
 * the run with exit code != 0. Skipping a stage only explicitly: VERIFY_SKIP=android,e2e
 * (a skip is visible in the summary and is not a "green" verify for the task).
 */
type Stage = { name: string; cmd: string[]; needs?: string[]; shell?: string };

const stages: Stage[] = [
  { name: "lint + format", cmd: ["bun", "run", "lint"] },
  { name: "typecheck", cmd: ["bun", "run", "typecheck"] },
  { name: "unit", cmd: ["bun", "run", "test:unit"] },
  { name: "integration (SQLite)", cmd: ["bun", "run", "test:int"] },
  { name: "migrations (clean database + drift)", cmd: ["bun", "run", "db:check"] },
  { name: "e2e (Playwright)", cmd: ["bun", "run", "e2e"] },
  { name: "build (api + web: expo export static)", cmd: ["bun", "run", "build"] },
  {
    name: "android (expo prebuild + assembleDebug)",
    cmd: ["bun", "run", "android"],
    needs: ["JAVA_HOME", "ANDROID_HOME", "ANDROID_NDK_HOME"],
    shell: ".#android",
  },
];

const skip = new Set(
  (process.env.VERIFY_SKIP ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);
const key = (s: Stage) => s.name.split(" ")[0]!;
const results: { name: string; status: "OK" | "FAIL" | "SKIP"; ms: number; note?: string }[] = [];

function missing(needs: string[] = []): string[] {
  return needs.filter((n) => (n === n.toUpperCase() ? !process.env[n] : !Bun.which(n)));
}

function summary() {
  console.log("\n================== verify: summary ===================");
  for (const r of results) {
    const t = `${(r.ms / 1000).toFixed(1)}s`.padStart(7);
    console.log(`${r.status.padEnd(4)} ${t}  ${r.name}${r.note ? `  (${r.note})` : ""}`);
  }
  const total = results.reduce((a, r) => a + r.ms, 0);
  console.log(`------------------------------------------------------\ntotal ${(total / 1000).toFixed(1)}s`);
}

for (const stage of stages) {
  if (skip.has(key(stage))) {
    results.push({ name: stage.name, status: "SKIP", ms: 0, note: "VERIFY_SKIP" });
    continue;
  }
  const lacking = missing(stage.needs);
  if (lacking.length) {
    results.push({
      name: stage.name,
      status: "FAIL",
      ms: 0,
      note: `missing: ${lacking.join(", ")} — run in 'nix develop${stage.shell ? ` ${stage.shell}` : ""}'`,
    });
    summary();
    process.exit(1);
  }
  console.log(`\n▶ ${stage.name}: ${stage.cmd.join(" ")}`);
  const start = performance.now();
  const proc = Bun.spawn(stage.cmd, { stdout: "inherit", stderr: "inherit", env: process.env });
  const code = await proc.exited;
  const ms = performance.now() - start;
  results.push({
    name: stage.name,
    status: code === 0 ? "OK" : "FAIL",
    ms,
    note: code === 0 ? undefined : `exit ${code}`,
  });
  if (code !== 0) {
    summary();
    process.exit(code);
  }
}
summary();
const skipped = results.filter((r) => r.status === "SKIP").length;
console.log(skipped ? `verify: OK with skips (${skipped})` : "verify: OK");
