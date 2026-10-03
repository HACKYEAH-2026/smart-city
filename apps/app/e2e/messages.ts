import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Teksty dla E2E wprost z messages/<locale>.json (to samo źródło co Paraglide). */
const load = (locale: string) =>
  JSON.parse(readFileSync(join(import.meta.dirname, "../messages", `${locale}.json`), "utf8")) as Record<
    string,
    string
  >;

export const en = load("en");
export const pl = load("pl");
