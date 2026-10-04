/**
 * `bun test <args>` with one exception for a known Bun bug: Bun 1.4.2 with the embedded SurrealDB engine
 * (@surrealdb/node 3.0.3) sometimes segfaults while exiting, after the run has finished and printed its summary
 * (docs/testing.md). A run that printed "Ran N tests" with "0 fail" and no "N errors" (unhandled errors outside a test)
 * and then died of SIGSEGV counts as green, with a loud note; so does the same teardown dying of SIGABRT when the
 * engine's runtime panicked on its mutex ("failed to lock mutex"). Anything else (failures, errors, a crash before
 * the summary) keeps its exit code.
 */
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");
const SIGSEGV_EXIT = 139;
const SIGABRT_EXIT = 134;

/** Copies a child's stream to ours as it arrives and returns everything it wrote. */
async function tee(stream: ReadableStream<Uint8Array>, out: NodeJS.WriteStream): Promise<string> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    out.write(chunk);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

const greenSummary = (output: string): boolean => {
  const plain = output.replace(ANSI, "");
  return (
    /^Ran \d+ tests? across \d+ files?\./m.test(plain) &&
    /^\s*0 fail$/m.test(plain) &&
    !/^\s*[1-9]\d* errors?$/m.test(plain)
  );
};

const proc = Bun.spawn(["bun", "test", ...Bun.argv.slice(2)], {
  stdout: "pipe",
  stderr: "pipe",
  // The API's log (apps/api/src/log.ts) stays quiet in tests; LOG_LEVEL=debug bun run test:int shows it.
  env: { LOG_LEVEL: "silent", ...process.env, ...(process.stdout.isTTY ? { FORCE_COLOR: "1" } : {}) },
});
const [out, err, code] = await Promise.all([
  tee(proc.stdout, process.stdout),
  tee(proc.stderr, process.stderr),
  proc.exited,
]);
const output = `${out}\n${err}`;
const segfault = code === SIGSEGV_EXIT || proc.signalCode === "SIGSEGV";
const mutexPanic = (code === SIGABRT_EXIT || proc.signalCode === "SIGABRT") && output.includes("failed to lock mutex");
const crashedAfterGreenRun = (segfault || mutexPanic) && greenSummary(output);

if (crashedAfterGreenRun) {
  console.error(
    "\nbun-test: every test passed, then Bun crashed while exiting (known Bun 1.4.2 + @surrealdb/node bug, " +
      "docs/testing.md). Counted as green.",
  );
}
// exitCode instead of process.exit(): Bun first flushes what is still queued for a slow stdout/stderr reader.
process.exitCode = crashedAfterGreenRun ? 0 : code;
