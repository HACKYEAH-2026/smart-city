import { afterEach, describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
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
afterEach(async () => {
  await t?.close();
  t = undefined;
});

const platform = { authorization: `Bearer ${TEST_ENV.PLUGIN_ADMIN_TOKEN}` };
const PLUGINS = join(import.meta.dir, "../../../plugins");
const BENCHES = readFileSync(join(PLUGINS, "benches/index.ts"), "utf8");

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

describe("plugin check", () => {
  test("every plugin in plugins/ passes; the result summarises it; nothing is stored", async () => {
    const ctx = await start();
    for (const dir of readdirSync(PLUGINS)) {
      const source = readFileSync(join(PLUGINS, dir, "index.ts"), "utf8").replace(`id: "${dir}"`, `id: "${dir}-copy"`);
      expect({ dir, result: await check(ctx, source) }).toMatchObject({ dir, result: { status: "ok" } });
    }
    expect(await check(ctx, BENCHES)).toEqual({
      status: "ok",
      plugin: {
        id: "benches",
        version: "2.0.0",
        views: ["main"],
        dashboardWidgets: [],
        tools: ["report"],
        streams: [],
        tables: ["benches"],
      },
    });
    const list = (await (await ctx.request("/api/admin/plugins", { headers: platform })).json()) as { id: string }[];
    expect(list.map((p) => p.id)).not.toContain("benches");
  });

  test("syntax: the first syntax error with its position", async () => {
    const ctx = await start();
    const source = `${BENCHES}\nconst broken = (;\n`;
    expect(await failed(ctx, source)).toEqual({
      status: "error",
      stage: "syntax",
      errors: [{ message: "Unexpected ;", ...at(source, "const broken"), column: 17 }],
    });
  });

  test("imports: every runtime import (static and dynamic); import type is fine", async () => {
    const ctx = await start();
    const source = `import { readFileSync } from "node:fs";\n${BENCHES.replace(
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
    const source = BENCHES.replace("ctx.db.benches.findMany()", "ctx.db.benchez.findMany()").replace(
      "ui.card({ title: b.park",
      "ui.card({ titel: b.park",
    );
    const result = await failed(ctx, source);
    expect(result.stage).toBe("types");
    const [table, ...rest] = result.errors;
    expect(table).toMatchObject({ ...at(source, "benchez"), column: source.split("\n")[21]!.indexOf("benchez") + 1 });
    expect(table?.message).toContain("Did you mean 'benches'?");
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
    const source = BENCHES.replace("const items =", "const secret = process.env.AI_API_KEY;\n        const items =");
    const result = await failed(ctx, source);
    expect(result).toMatchObject({ stage: "types", errors: [{ ...at(source, "process.env") }] });
    expect(result.errors[0]?.message).toBe(
      "Cannot find name 'process': a plugin gets no Bun, Node or browser globals, only ES2023 and the SDK (ctx, ui, z, t, fileRef).",
    );
  });

  test(`at most ${MAX_CHECK_ISSUES} issues, the rest counted`, async () => {
    const ctx = await start();
    const wrong = Array.from({ length: MAX_CHECK_ISSUES + 2 }, (_, i) => `export const n${i}: number = "x";`);
    const result = await failed(ctx, `${BENCHES}\n${wrong.join("\n")}\n`);
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
    expect(await load(BENCHES.replace('id: "benches"', 'id: "X"'))).toContain("Invalid manifest");
    expect(await load(BENCHES.replace('view: "main"', 'view: "missing"'))).toContain('missing view "missing"');
    expect(await load(BENCHES.replace('id: "benches"', 'id: "issues"'))).toBe('"issues" is a built-in plugin');
  });

  test("schema: breaking changes against the stored tables; the check changes nothing", async () => {
    const ctx = await start();
    expect((await post(ctx, "", BENCHES)).status).toBe(201);
    // Type-correct, but the stored column is optional (a type change would already fail at the types stage).
    const breaking = await failed(
      ctx,
      BENCHES.replace('reporter: t.ref("user").optional()', 'reporter: t.ref("user")'),
    );
    expect(breaking).toMatchObject({
      stage: "schema",
      errors: [{ message: expect.stringContaining("became required") }],
    });
    // Had this check applied the new column, the next one would be a type change; it was not applied.
    const lamp = (type: string) => BENCHES.replace("park: t.text(),", `park: t.text(), lamp: t.${type}().optional(),`);
    expect((await check(ctx, lamp("boolean"))).status).toBe("ok");
    expect((await check(ctx, lamp("integer"))).status).toBe("ok");
  });

  test("an upload reports the failed stage the same way (400)", async () => {
    const ctx = await start();
    const res = await post(ctx, "", BENCHES.replace("ctx.db.benches.findMany()", "ctx.db.benchez.findMany()"));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; message: string; stage: string; errors: unknown[] };
    expect(body).toMatchObject({ error: "invalid_plugin", stage: "types" });
    expect(body.errors[0]).toMatchObject({ line: 22, column: 36 });
    expect(body.message).toStartWith("types: line 22:36: Property 'benchez' does not exist");
  });

  test("type checking works from the recorded snapshot alone, mounted where no repo exists (production image)", async () => {
    const snapshot = JSON.parse(JSON.stringify(await recordTypeFs())) as TypeFs;
    expect(Object.keys(snapshot.files).filter((path) => path.startsWith("..") || path.startsWith("/"))).toEqual([]);
    const typecheck = createTypeChecker(ts, snapshot);
    expect(typecheck(BENCHES)).toEqual([]);
    expect(typecheck(BENCHES.replace("ctx.db.benches", "ctx.db.benchez"))[0]?.message).toContain(
      "Did you mean 'benches'?",
    );
  });
});
