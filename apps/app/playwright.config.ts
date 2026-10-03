import { defineConfig, devices } from "@playwright/test";

/**
 * Web E2E: frontend = production static Expo export (dist/) served by scripts/serve.ts.
 * API = a separate process per worker (fixture e2e/fixtures.ts), in-memory SQLite.
 */
const CI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: "http://localhost:4173", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "bun run build && bun run preview",
    url: "http://localhost:4173",
    reuseExistingServer: !CI,
    timeout: 240_000,
  },
});
