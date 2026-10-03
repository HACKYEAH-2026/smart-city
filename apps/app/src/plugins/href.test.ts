import { describe, expect, test } from "bun:test";
import { pluginHref, viewParamsFrom } from "./href";

describe("pluginHref", () => {
  test("buduje ścieżkę i query", () => {
    expect(pluginHref("krakow", "issues", "list")).toBe("/app/c/krakow/issues/list");
    expect(pluginHref("krakow", "issues", "detail", { id: "a b" })).toBe("/app/c/krakow/issues/detail?id=a+b");
  });
});

describe("viewParamsFrom", () => {
  test("pomija segmenty trasy i wartości tablicowe", () => {
    expect(viewParamsFrom({ slug: "k", plugin: "p", view: "v", id: "1", tags: ["a", "b"], x: undefined })).toEqual({
      id: "1",
    });
  });
});
