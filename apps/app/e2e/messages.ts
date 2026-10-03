import { readFileSync } from "node:fs";
import { join } from "node:path";

/** E2E strings straight from messages/<locale>.json (same source as the app). */
const load = (locale: string) =>
  JSON.parse(readFileSync(join(import.meta.dirname, "../messages", `${locale}.json`), "utf8")) as Record<
    string,
    string
  >;

export const en = load("en");
