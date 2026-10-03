import { describe, expect, test } from "bun:test";
import { notificationHref, pluginHref, viewParamsFrom } from "./href";

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

describe("notificationHref", () => {
  const push = { notificationId: "n1", community: "krakow", pluginId: "sightings" };

  test("a tapped push opens the plugin view it points to", () => {
    const open = { type: "navigate", view: "sighting", params: { id: "42" } };
    expect(notificationHref({ ...push, open })).toEqual({
      notificationId: "n1",
      href: "/app/c/krakow/sightings/sighting?id=42",
    });
  });

  test("without a view it opens the community", () => {
    expect(notificationHref({ ...push, open: null })).toEqual({ notificationId: "n1", href: "/app/c/krakow" });
  });

  test("anything that is not our push is ignored", () => {
    expect(notificationHref(undefined)).toBeNull();
    expect(notificationHref({ title: "obcy" })).toBeNull();
    expect(notificationHref({ ...push, community: 7 })).toBeNull();
    expect(notificationHref({ ...push, open: { type: "navigate", view: 1 } })).toBeNull();
  });
});
