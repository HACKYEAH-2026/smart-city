/**
 * Konfiguracja testowa: integracja (test/helpers.ts), test-server dla E2E/dev i skrypty dev.
 * Bez zależności runtime — importuje ją też Playwright (Node). Nigdy nie używaj w produkcji.
 */
export const TEST_ADMIN_TOKEN = "test-admin-token-0000000000";

export const TEST_ENV = {
  NODE_ENV: "test",
  DATABASE_URL: ":memory:",
  API_URL: "http://localhost:4000",
  BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-000",
  // statyczny eksport web (E2E) + Expo dev server (web)
  TRUSTED_ORIGINS: "http://localhost:4173,http://localhost:8081",
  PLUGIN_ADMIN_TOKEN: TEST_ADMIN_TOKEN,
} as const;
