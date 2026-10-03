import { type ChildProcess, spawn } from "node:child_process";
import { resolve } from "node:path";
import { test as base, expect } from "@playwright/test";

/**
 * E2E fixtures:
 *  - worker-scoped `api`: a separate API process (bun apps/api/src/test-server.ts) per worker,
 *    with its own in-memory SQLite database.
 *  - auto fixture: POST /__test/reset before EVERY test.
 *  - the frontend gets the worker's API URL via window.__API_URL__ (runtime config).
 */
const ROOT = resolve(import.meta.dirname, "../../..");
const BASE_PORT = 4100;

async function waitForHealth(url: string, proc: ChildProcess, timeoutMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (proc.exitCode !== null) throw new Error(`API exited with code ${proc.exitCode}`);
    try {
      const r = await fetch(`${url}/health`);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`API did not start within ${timeoutMs} ms`);
}

type WorkerFixtures = { api: { url: string } };
type TestFixtures = { resetDb: undefined };

export const test = base.extend<TestFixtures, WorkerFixtures>({
  api: [
    // biome-ignore lint/correctness/noEmptyPattern: required by Playwright's fixture API
    async ({}, use, workerInfo) => {
      const port = BASE_PORT + workerInfo.parallelIndex;
      const url = `http://localhost:${port}`;
      const proc = spawn("bun", ["apps/api/src/test-server.ts"], {
        cwd: ROOT,
        env: {
          ...process.env,
          NODE_ENV: "test",
          PORT: String(port),
          DATABASE_URL: ":memory:",
          API_URL: url,
        },
        stdio: ["ignore", "inherit", "inherit"],
      });
      try {
        await waitForHealth(url, proc);
        await use({ url });
      } finally {
        proc.kill("SIGTERM");
      }
    },
    { scope: "worker", timeout: 60_000 },
  ],
  resetDb: [
    async ({ api, page }, use) => {
      const r = await fetch(`${api.url}/__test/reset`, { method: "POST" });
      expect(r.ok, "reset database before test").toBe(true);
      await page.addInitScript((u) => {
        (globalThis as unknown as { __API_URL__: string }).__API_URL__ = u;
      }, api.url);
      await use(undefined);
    },
    { auto: true },
  ],
});

export { TEST_ADMIN_TOKEN } from "../../api/src/test-env";
export { expect };
