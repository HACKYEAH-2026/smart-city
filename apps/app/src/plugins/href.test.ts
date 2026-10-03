import { describe, expect, test } from "bun:test";
import { pluginHref, viewParamsFrom } from "./href";

describe("pluginHref", () => {
  test("builds the path and query", () => {
    expect(pluginHref("krakow", "issues", "list")).toBe("/app/c/krakow/issues/list");
    expect(pluginHref("krakow", "issues", "detail", { id: "a b" })).toBe("/app/c/krakow/issues/detail?id=a+b");
  });
});

describe("viewParamsFrom", () => {
  test("skips route segments and array values", () => {
    expect(viewParamsFrom({ slug: "k", plugin: "p", view: "v", id: "1", tags: ["a", "b"], x: undefined })).toEqual({
      id: "1",
    });
  });
});
