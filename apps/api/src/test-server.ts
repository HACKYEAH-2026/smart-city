/**
 * Server for E2E and local dev: applies the schema to the database (DATABASE_URL, in-memory by default)
 * and adds /__test/reset. Refuses to start outside NODE_ENV=test.
 */
import { createApp } from "./app";
import { createDb, migrate } from "./db";
import { loadEnv } from "./env";
import { TEST_ENV } from "./test-env";
import { createTestRoutes, seedDemo } from "./test-routes";

// Dev/E2E: :4000 by default (3000 is often taken by other tools). Production: PORT from env (3000).
const port = process.env.PORT ?? "4000";
const env = loadEnv({
  ...TEST_ENV,
  API_URL: `http://localhost:${port}`,
  ...process.env,
  PORT: port,
});
if (env.NODE_ENV !== "test") {
  console.error("test-server.ts requires NODE_ENV=test");
  process.exit(1);
}

const handle = await createDb(env.DATABASE_URL);
await migrate(handle.db);
const { app, auth, plugins } = createApp({ db: handle.db, env });
const deps = { db: handle.db, auth, plugins };
await seedDemo(deps);
app.route("/", createTestRoutes(deps));

const server = Bun.serve({ port: env.PORT, fetch: app.fetch });
console.log(`api(test): listening on :${server.port} [${env.DATABASE_URL}]`);

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, async () => {
    server.stop(true);
    await handle.close();
    process.exit(0);
  });
}
