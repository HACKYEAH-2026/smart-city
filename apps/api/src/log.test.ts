import { describe, expect, test } from "bun:test";
import { render, withLogFields } from "./log";

const json = (line: string) => JSON.parse(line) as Record<string, unknown>;
const asJson = { json: true, color: false };
const asText = { json: false, color: false };

describe("log lines", () => {
  test("JSON: level, scope, message and fields; an error keeps its own fields and cause, its stack only at error", () => {
    const err = Object.assign(new Error("400 model does not support tools", { cause: new Error("bad request") }), {
      status: 400,
      headers: { secret: "x" },
    });
    const warn = json(render("warn", "author", "model call failed", { attempt: 1, err }, asJson));
    expect(warn).toMatchObject({ level: "warn", scope: "author", msg: "model call failed", attempt: 1 });
    expect(warn.err).toEqual({
      name: "Error",
      message: "400 model does not support tools",
      status: 400,
      cause: { name: "Error", message: "bad request" },
    });
    expect(warn.stack).toBeUndefined();
    const error = json(render("error", "author", "failed", { err }, asJson));
    expect(String(error.stack)).toContain("400 model does not support tools");
    expect(String(error.stack)).toContain("bad request");
  });

  test("text: one readable line, values quoted only when needed, stacks indented below an error", () => {
    const line = render(
      "info",
      "builder",
      "check failed at types",
      { attempt: 2, stage: "types", note: "a b" },
      asText,
    );
    expect(line).toMatch(
      /^\d\d:\d\d:\d\d\.\d{3} INFO {2}builder check failed at types attempt=2 stage=types note="a b"$/,
    );
    const [head, ...stack] = render("error", "http", "GET / failed", { err: new Error("boom") }, asText).split("\n");
    expect(head).toContain('err={"name":"Error","message":"boom"}');
    expect(stack[0]).toBe("    Error: boom");
  });

  test("fields of the surrounding job join every line, also across awaits", async () => {
    const line = await withLogFields({ plugin: "ai-1", n: 2 }, async () => {
      await Bun.sleep(0);
      return render("info", "builder", "version ready", { ms: 5 }, asJson);
    });
    expect(json(line)).toMatchObject({ plugin: "ai-1", n: 2, ms: 5 });
  });

  test("long strings are cut and self-references do not loop", () => {
    const loop: Record<string, unknown> = { a: 1 };
    loop.self = loop;
    const out = json(render("info", "x", "m", { text: "x".repeat(5000), loop }, asJson));
    expect(String(out.text)).toEndWith("… (+1000)");
    expect(JSON.stringify(out.loop)).toContain("[…]");
  });
});
