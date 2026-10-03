import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(import.meta.dir, "../../messages");
const load = (file: string) => JSON.parse(readFileSync(join(dir, file), "utf8")) as Record<string, string>;
const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
const base = load("en.json");

describe("komunikaty i18n", () => {
  test("angielski jest bazą, każdy język ma dokładnie te same klucze", () => {
    expect(files).toContain("en.json");
    for (const file of files) expect(Object.keys(load(file)).sort(), file).toEqual(Object.keys(base).sort());
  });

  test("żaden komunikat nie jest pusty", () => {
    for (const file of files) {
      for (const [k, v] of Object.entries(load(file))) expect(v.trim().length, `${file}:${k}`).toBeGreaterThan(0);
    }
  });
});
