import { type ChildProcess, spawn } from "node:child_process";
import { type AddressInfo, createServer } from "node:net";
import { resolve } from "node:path";
import { test as base, expect } from "@playwright/test";
import { TEST_GOOGLE_CLIENT_ID } from "../../api/src/test-google";

/**
 * E2E fixtures:
 *  - worker-scoped `api`: a separate API process (bun apps/api/src/test-server.ts) per worker, on a port the
 *    OS picks (other E2E runs on this machine must never reach it, nor this run theirs),
 *    with its own embedded in-memory SurrealDB and Google sign-in on fake ID tokens (test-google.ts).
 *  - auto fixture: POST /__test/reset before EVERY test.
 *  - the frontend gets the worker's API URL via window.__API_URL__ (runtime config).
 */
const ROOT = resolve(import.meta.dirname, "../../..");

/** A port nothing listens on right now, chosen by the OS. */
function freePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, () => {
      const { port } = server.address() as AddressInfo;
      server.close(() => resolvePort(port));
    });
  });
}

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
      const port = await freePort();
      // The frontend's port is random too (playwright.config.ts): the API must trust exactly that origin.
      const web = new URL(String(workerInfo.project.use.baseURL)).origin;
      const url = `http://localhost:${port}`;
      const proc = spawn("bun", ["apps/api/src/test-server.ts"], {
        cwd: ROOT,
        env: {
          ...process.env,
          NODE_ENV: "test",
          PORT: String(port),
          DATABASE_URL: "mem://",
          API_URL: url,
          GOOGLE_CLIENT_ID: TEST_GOOGLE_CLIENT_ID,
          TRUSTED_ORIGINS: web,
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

/** Makes an existing user a member of Kraków (joining is not a screen yet); the test API exposes this route. */
export const joinKrakow = async (apiUrl: string, email: string) => {
  const res = await fetch(`${apiUrl}/__test/membership`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, slug: "krakow" }),
  });
  if (!res.ok) throw new Error(`joinKrakow ${res.status}`);
};
/** Invites an existing user to Kraków from its admin (the invitations screen shows it); the test API exposes this route. */
export const inviteToKrakow = async (apiUrl: string, email: string) => {
  const res = await fetch(`${apiUrl}/__test/invitation`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, slug: "krakow" }),
  });
  if (!res.ok) throw new Error(`inviteToKrakow ${res.status}`);
};
export { expect };
