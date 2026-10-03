import { setupApi, TEST_ENV } from "@app/testing/api";
import { createApp } from "../src/app";
import { loadEnv } from "../src/env";

const env = loadEnv(TEST_ENV);

/** Świeża baza SQLite w pamięci (ze zrzutu) + aplikacja; wołaj close() w afterEach. */
export const setup = () => setupApi((db) => createApp({ db, env }).app);
export type Ctx = Awaited<ReturnType<typeof setup>>;
