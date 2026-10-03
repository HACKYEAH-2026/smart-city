/**
 * PRODUCTION entry point. Imports nothing from test-*.ts (checked by scripts/build.ts).
 * The schema is applied by a separate process (dist/migrate-cli.js) before startup, not by the server.
 */

import { createApp } from "./app";
import { createDb } from "./db";
import { loadEnv } from "./env";

const env = loadEnv();
const { db } = await createDb(env.DATABASE_URL);
const { app } = createApp({ db, env });

const server = Bun.serve({ port: env.PORT, fetch: app.fetch });
console.log(`api: listening on :${server.port} (${env.NODE_ENV})`);
