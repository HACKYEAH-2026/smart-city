import { afterEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MAX_CHECK_ISSUES, type PluginCheck } from "@app/plugin-sdk";
import ts from "typescript";
import { createTypeChecker, recordTypeFs, type TypeFs } from "../src/plugins/typecheck";
import { TEST_ENV } from "../src/test-env";
import { type Ctx, setup } from "./helpers";

/**
 * Checking plugin source (POST /api/admin/plugins/check, and every upload): what each stage catches and how it
 * reports it (stage, line, column, snippet), so that the author (a person or an AI agent) can fix the source.
 */
let t: Ctx | undefined;
// These tests run the TypeScript checker over whole plugins: ~1-2 s each on an idle machine, but well over Bun's
// default 5 s when the machine is busy (parallel builds), which made verify fail on timeouts alone.
setDefaultTimeout(30_000);
afterEach(async () => {
  await t?.close();
  t = undefined;
});

const platform = { authorization: `Bearer ${TEST_ENV.PLUGIN_ADMIN_TOKEN}` };
const PLUGINS = join(import.meta.dir, "../../../plugins");
const NOTES = readFileSync(join(import.meta.dir, "fixtures/notes-plugin.ts"), "utf8");

const start = async () => {
  const ctx = await setup();
  t = ctx;
  return ctx;
};
const post = (ctx: Ctx, path: string, source: string) =>
  ctx.request(`/api/admin/plugins${path}`, { method: "POST", headers: platform, json: { source } });
const check = async (ctx: Ctx, source: string) => {
  const res = await post(ctx, "/check", source);
  expect(res.status).toBe(200);
  return (await res.json()) as PluginCheck;
};
const failed = async (ctx: Ctx, source: string) => {
  const result = await check(ctx, source);
  if (result.status !== "error") throw new Error(`expected a failed check, got ${JSON.stringify(result)}`);
  return result;
};
/** 1-based line of the first line containing `text`, and that line trimmed (what the check reports as snippet). */
const at = (source: string, text: string) => {
  const lines = source.split("\n");
  const index = lines.findIndex((line) => line.includes(text));
  return { line: index + 1, snippet: lines[index]?.trim() };
};
/** Where the misspelt table `notez` is: its line (as `at`) and its 1-based column. */
const notez = (source: string) => {
  const found = at(source, "notez");
  return { ...found, column: (source.split("\n")[found.line - 1] ?? "").indexOf("notez") + 1 };
};

describe("plugin check", () => {
  test("every plugin in plugins/ passes; the result summarises it; nothing is stored", async () => {
    const ctx = await start();
    for (const dir of readdirSync(PLUGINS)) {
      const source = readFileSync(join(PLUGINS, dir, "index.ts"), "utf8").replace(`id: "${dir}"`, `id: "${dir}-copy"`);
      expect({ dir, result: await check(ctx, source) }).toMatchObject({ dir, result: { status: "ok" } });
    }
    expect(await check(ctx, NOTES)).toEqual({
      status: "ok",
      plugin: {
        id: "notes",
        version: "1.0.0",
        name: "Notatki",
        icon: "📝",
        description: "Wspólne notatki członków społeczności.",
        views: ["main"],
        dashboardWidgets: ["main"],
        tools: ["add"],
        streams: [],
        tables: ["notes"],
      },
    });
    const list = (await (await ctx.request("/api/admin/plugins", { headers: platform })).json()) as { id: string }[];
    expect(list.map((p) => p.id)).not.toContain("notes");
    // One full check per plugin in plugins/ and the fixture: 16 s at load ~60, past the default 30 s when it peaks.
  }, 120_000);

  test("syntax: the first syntax error with its position", async () => {
    const ctx = await start();
    const source = `${NOTES}\nconst broken = (;\n`;
    expect(await failed(ctx, source)).toEqual({
      status: "error",
      stage: "syntax",
      errors: [{ message: "Unexpected ;", ...at(source, "const broken"), column: 17 }],
    });
  });

  test("imports: every runtime import (static and dynamic); import type is fine", async () => {
    const ctx = await start();
    const source = `import { readFileSync } from "node:fs";\n${NOTES.replace(
      "const items =",
      'const os = await import("node:os");\n        const items =',
    )}`;
    const result = await failed(ctx, source);
    expect(result.stage).toBe("imports");
    expect(result.errors).toEqual([
      { message: expect.stringContaining('Runtime import of "node:fs"'), ...at(source, '"node:fs"') },
      { message: expect.stringContaining('Runtime import of "node:os"'), ...at(source, '"node:os"') },
    ]);
  });

  test("types: typos in tables and UI props, with suggestions and short type names", async () => {
    const ctx = await start();
    const source = NOTES.replace("ctx.db.notes.findMany()", "ctx.db.notez.findMany()").replace(
      "ui.card({ title: n.title",
      "ui.card({ titel: n.title",
    );
    const result = await failed(ctx, source);
    expect(result.stage).toBe("types");
    const [table, ...rest] = result.errors;
    expect(table).toMatchObject({ ...notez(source) });
    expect(table?.message).toContain("Did you mean 'notes'?");
    expect(table?.message).toContain("…"); // the long Database<…> type is cut
    expect(rest).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining("Did you mean to write 'title'?"),
        ...at(source, "titel"),
      }),
    );
  });

  test("types: no Bun, Node or browser globals", async () => {
    const ctx = await start();
    const source = NOTES.replace("const items =", "const secret = process.env.AI_API_KEY;\n        const items =");
    const result = await failed(ctx, source);
    expect(result).toMatchObject({ stage: "types", errors: [{ ...at(source, "process.env") }] });
    expect(result.errors[0]?.message).toBe(
      "Cannot find name 'process': a plugin gets no Bun, Node or browser globals, only ES2023 and the SDK (ctx, ui, z, t, fileRef).",
    );
  });

  test("safety: escape hatches out of ctx and the SDK, each with its line (the code type-checks)", async () => {
    const ctx = await start();
    const escapes = [
      "const g = globalThis;",
      "const F = ({}).constructor;",
      'const key = "prototype";',
      "JSON.parse = (text: string) => text;",
      'const f: unknown = ctx.user; if (typeof f === "function") f("return 1");',
      "const v: any = ctx.db; v.raw();",
      "// @ts-ignore",
      'const n: number = "not a number";',
    ];
    const source = `declare const secrets: string[];\n${NOTES.replace(
      "const items =",
      `${escapes.join("\n        ")}\n        const items =`,
    )}`;
    const result = await failed(ctx, source);
    expect(result.stage).toBe("safety");
    const expected: [string, string][] = [
      ["declare const secrets", "Ambient declarations"],
      ["const g = globalThis", "'globalThis' is not available to plugins"],
      ["({}).constructor", "'.constructor' is not allowed"],
      ['"prototype"', 'The string "prototype" is not allowed'],
      ["JSON.parse =", "Changing 'JSON.parse' is not allowed"],
      ['f("return 1")', "Calling a value of type 'any' or 'Function'"],
      ["v.raw()", "Calling a value of type 'any' or 'Function'"],
      ["// @ts-ignore", "'@ts-ignore' is not allowed"],
    ];
    for (const [code, message] of expected) {
      expect(result.errors).toContainEqual(
        expect.objectContaining({ message: expect.stringContaining(message), line: at(source, code).line }),
      );
    }
  });

  test(`at most ${MAX_CHECK_ISSUES} issues, the rest counted`, async () => {
    const ctx = await start();
    const wrong = Array.from({ length: MAX_CHECK_ISSUES + 2 }, (_, i) => `export const n${i}: number = "x";`);
    const result = await failed(ctx, `${NOTES}\n${wrong.join("\n")}\n`);
    expect(result.errors).toHaveLength(MAX_CHECK_ISSUES + 1);
    expect(result.errors.at(-1)).toEqual({ message: "…and 2 more" });
  });

  test("load: the factory runs and the manifest is validated; built-ins cannot be replaced", async () => {
    const ctx = await start();
    const load = async (source: string) => {
      const result = await failed(ctx, source);
      expect(result.stage).toBe("load");
      return result.errors[0]?.message;
    };
    expect(await load(NOTES.replace('id: "notes"', 'id: "X"'))).toContain("Invalid manifest");
    expect(await load(NOTES.replace('view: "main"', 'view: "missing"'))).toContain('missing view "missing"');
    expect(await load(NOTES.replace('id: "notes"', 'id: "issues"'))).toBe('"issues" is a built-in plugin');
  });

  test("schema: breaking changes against the stored tables; the check changes nothing", async () => {
    const ctx = await start();
    expect((await post(ctx, "", NOTES)).status).toBe(201);
    // Type-correct, but the stored column is optional (a type change would already fail at the types stage).
    const breaking = await failed(ctx, NOTES.replace('author: t.ref("user").optional()', 'author: t.ref("user")'));
    expect(breaking).toMatchObject({
      stage: "schema",
      errors: [{ message: expect.stringContaining("became required") }],
    });
    // Had this check applied the new column, the next one would be a type change; it was not applied.
    const pinned = (type: string) =>
      NOTES.replace("title: t.text(),", `title: t.text(), pinned: t.${type}().optional(),`);
    expect((await check(ctx, pinned("boolean"))).status).toBe("ok");
    expect((await check(ctx, pinned("integer"))).status).toBe("ok");
  });

  test("an upload reports the failed stage the same way (400)", async () => {
    const ctx = await start();
    const source = NOTES.replace("ctx.db.notes.findMany()", "ctx.db.notez.findMany()");
    const res = await post(ctx, "", source);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; message: string; stage: string; errors: unknown[] };
    expect(body).toMatchObject({ error: "invalid_plugin", stage: "types" });
    const { line, column } = notez(source);
    expect(body.errors[0]).toMatchObject({ line, column });
    expect(body.message).toStartWith(`types: line ${line}:${column}: Property 'notez' does not exist`);
  });

  test("checking the same source again leaves its module file alone (a rewrite restarts `bun --watch` mid-build)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "plugin-check-"));
    try {
      t = await setup({ PLUGINS_DIR: dir });
      expect((await check(t, NOTES)).status).toBe("ok");
      const files = readdirSync(dir).map((hash) => join(dir, hash, "plugin.ts"));
      expect(files).toHaveLength(1);
      const written = statSync(files[0] ?? "").mtimeMs;
      await Bun.sleep(20);
      expect((await check(t, NOTES)).status).toBe("ok");
      expect(statSync(files[0] ?? "").mtimeMs).toBe(written);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("type checking works from the recorded snapshot alone, mounted where no repo exists (production image)", async () => {
    const snapshot = JSON.parse(JSON.stringify(await recordTypeFs())) as TypeFs;
    expect(Object.keys(snapshot.files).filter((path) => path.startsWith("..") || path.startsWith("/"))).toEqual([]);
    const typecheck = createTypeChecker(ts, snapshot);
    expect(typecheck(NOTES)).toEqual([]);
    expect(typecheck(NOTES.replace("ctx.db.notes", "ctx.db.notez"))[0]?.message).toContain("Did you mean 'notes'?");
  });
});
