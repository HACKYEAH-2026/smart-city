/**
 * Wejście PRODUKCYJNE. Nie importuje niczego z test-*.ts (sprawdza to scripts/build.ts).
 * Migracje uruchamia osobny proces (dist/migrate.js) przed startem, nie serwer.
 */

import { createApp } from "./app";
import { createDb } from "./db";
import { loadEnv } from "./env";

const env = loadEnv();
const { db } = await createDb(env.DATABASE_URL);
const { app } = createApp({ db, env });

const server = Bun.serve({ port: env.PORT, fetch: app.fetch });
console.log(`api: nasłuch na :${server.port} (${env.NODE_ENV})`);
