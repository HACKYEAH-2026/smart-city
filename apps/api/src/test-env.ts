/**
 * Test configuration: integration tests (test/helpers.ts), test-server for E2E/dev, and dev scripts.
 * No runtime dependencies — Playwright (Node) imports it too. Never use in production.
 */
export const TEST_ADMIN_TOKEN = "test-admin-token-0000000000";

export const TEST_ENV = {
  NODE_ENV: "test",
  DATABASE_URL: ":memory:",
  API_URL: "http://localhost:4000",
  BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-000",
  // static web export (E2E) + Expo dev server (web)
  TRUSTED_ORIGINS: "http://localhost:4173,http://localhost:8081",
  PLUGIN_ADMIN_TOKEN: TEST_ADMIN_TOKEN,
} as const;
