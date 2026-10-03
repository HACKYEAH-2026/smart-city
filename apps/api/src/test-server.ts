/**
 * Serwer dla E2E i lokalnego dev: migruje bazę SQLite (DATABASE_URL, domyślnie w pamięci)
 * i dokłada /__test/reset. Odmawia startu poza NODE_ENV=test.
 */
import { createApp } from "./app";
import { createDb, migrate } from "./db";
import { loadEnv } from "./env";
import { TEST_ENV } from "./test-env";
import { createTestRoutes, seedDemo } from "./test-routes";

// Dev/E2E: domyślnie :4000 (3000 bywa zajęty przez inne narzędzia). Produkcja: PORT z env (3000).
const port = process.env.PORT ?? "4000";
const env = loadEnv({
  ...TEST_ENV,
  API_URL: `http://localhost:${port}`,
  ...process.env,
  PORT: port,
});
if (env.NODE_ENV !== "test") {
  console.error("test-server.ts wymaga NODE_ENV=test");
  process.exit(1);
}

const handle = await createDb(env.DATABASE_URL);
await migrate(handle);
seedDemo(handle.db);
const { app } = createApp({ db: handle.db, env });
app.route("/", createTestRoutes(handle.db));

const server = Bun.serve({ port: env.PORT, fetch: app.fetch });
console.log(`api(test): nasłuch na :${server.port} [${env.DATABASE_URL}]`);

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, async () => {
    server.stop(true);
    await handle.close();
    process.exit(0);
  });
}
