import { defineConfig, devices } from "@playwright/test";

/**
 * Web E2E: frontend = production static Expo export (dist/) served by scripts/serve.ts.
 * API = a separate process per worker (fixture e2e/fixtures.ts), in-memory SurrealDB.
 */
const CI = Boolean(process.env.CI);
/**
 * The preview server's port: random, so that E2E runs sharing a machine (parallel sessions, each with its own
 * checkout) never test each other's build. Set once by the main process; the workers load this file again and
 * inherit it.
 */
const WEB_PORT = process.env.E2E_WEB_PORT ?? String(20_000 + Math.floor(Math.random() * 20_000));
process.env.E2E_WEB_PORT = WEB_PORT;
const WEB_URL = `http://localhost:${WEB_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: WEB_URL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // E2E_PREBUILT=1 serves the existing dist/ (verify sets it right after its build stage; also handy when only
    // specs changed). Without it, a fresh export first.
    command: process.env.E2E_PREBUILT === "1" ? "bun run preview" : "bun run build && bun run preview",
    url: WEB_URL,
    env: { PORT: WEB_PORT },
    timeout: 240_000,
  },
});
