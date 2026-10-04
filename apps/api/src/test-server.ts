/**
 * Server for E2E and local dev: applies the schema to the database (DATABASE_URL, in-memory by default),
 * seeds the demo place, a resident of three places and more public places around Kraków (test-routes.ts), the demo's
 * people and the content of Kraków and the Tauron Arena (test-demo.ts), and adds /__test/reset.
 * Refuses to start outside NODE_ENV=test.
 * Google sign-in: with the test client ID (E2E) it accepts fake ID tokens (test-google.ts); with a real
 * GOOGLE_CLIENT_ID (local dev with a phone, the repo-root .env) it checks real tokens like production.
 */
import { createApp } from "./app";
import { createDb, migrate } from "./db";
import { loadEnv } from "./env";
import { logger } from "./log";
import { TestPluginAuthor } from "./test-author";
import { createDemoRoutes, seedDemoContent } from "./test-demo";
import { TEST_ENV } from "./test-env";
import { TestGeocoder } from "./test-geocoder";
import { TEST_GOOGLE_CLIENT_ID, verifyTestGoogleIdToken } from "./test-google";
import { createTestRoutes, seedDemo, seedDemoMap, seedDemoResident } from "./test-routes";

// Dev/E2E: :4000 by default (3000 is often taken by other tools). Production: PORT from env (3000).
const port = process.env.PORT ?? "4000";
const env = loadEnv({
  ...TEST_ENV,
  API_URL: `http://localhost:${port}`,
  ...process.env,
  PORT: port,
});
const log = logger("api");
if (env.NODE_ENV !== "test") {
  log.error("test-server.ts requires NODE_ENV=test");
  process.exit(1);
}

const handle = await createDb(env.DATABASE_URL);
await migrate(handle.db);
const { app, auth, plugins, files } = createApp({
  db: handle.db,
  env,
  ...(env.GOOGLE_CLIENT_ID === TEST_GOOGLE_CLIENT_ID ? { verifyGoogleIdToken: verifyTestGoogleIdToken } : {}),
  // E2E (GEOCODER=test): fixed addresses, no network; local dev keeps the real geocoder.
  ...(process.env.GEOCODER === "test" ? { geocoder: new TestGeocoder() } : {}),
  // E2E (PLUGIN_AUTHOR=test): the plugin builder writes a fixed plugin, no model; local dev uses the env's model.
  ...(process.env.PLUGIN_AUTHOR === "test" ? { author: new TestPluginAuthor() } : {}),
});
const deps = { db: handle.db, auth, plugins, files };
await seedDemo(deps);
// A resident of Kraków, a campus and a cooperative for local dev; /__test/reset (E2E) starts without them.
await seedDemoResident(deps);
// The demo's people, the Tauron Arena and what they wrote in it and in Kraków; /__test/reset starts without them too.
// A dev database the seed does not expect (e.g. an old plugin's data) only loses the demo content, not the API.
await seedDemoContent(deps).catch((err: unknown) => log.error("demo content not seeded", { err }));
// More pins on the map of places for local dev; /__test/reset (E2E) starts from the demo place alone.
await seedDemoMap(deps);
app.route("/", createTestRoutes(deps));
app.route("/", createDemoRoutes(deps));

const server = Bun.serve({ port: env.PORT, fetch: app.fetch });
log.info(`listening on :${server.port} (test server)`, { db: env.DATABASE_URL });

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, async () => {
    server.stop(true);
    await handle.close();
    process.exit(0);
  });
}
