import { describe, expect, test } from "bun:test";
import type { LayoutWidget } from "@app/shared";
import {
  addWidget,
  byPlugin,
  type LayoutDraft,
  layoutInput,
  moveWidget,
  reconcileDraft,
  removeWidget,
  resizeWidget,
  sizeLabel,
} from "./layoutDraft";

const widget = (key: string, pluginId = key.split("/")[0] ?? key): LayoutWidget => ({
  key,
  pluginId,
  pluginName: `Plugin ${pluginId}`,
  pluginIcon: "📣",
  title: key,
  size: { w: 3, h: 3 },
  sizes: [
    { w: 3, h: 3 },
    { w: 3, h: 2 },
  ],
});

const keys = (draft: LayoutDraft) => ({
  widgets: draft.widgets.map((w) => w.key),
  available: draft.available.map((w) => w.key),
});

const draft: LayoutDraft = { widgets: [widget("a/x"), widget("b/x"), widget("c/x")], available: [widget("d/x")] };

describe("layout draft", () => {
  test("moving a widget earlier or later; the ends stay put", () => {
    expect(keys(moveWidget(draft, "b/x", -1)).widgets).toEqual(["b/x", "a/x", "c/x"]);
    expect(keys(moveWidget(draft, "b/x", 1)).widgets).toEqual(["a/x", "c/x", "b/x"]);
    expect(moveWidget(draft, "a/x", -1)).toBe(draft);
    expect(moveWidget(draft, "c/x", 1)).toBe(draft);
    expect(moveWidget(draft, "nope", 1)).toBe(draft);
  });

  test("resizing changes only that widget", () => {
    const next = resizeWidget(draft, "b/x", { w: 3, h: 2 });
    expect(next.widgets.map((w) => sizeLabel(w.size))).toEqual(["3 × 3", "3 × 2", "3 × 3"]);
  });

  test("a removed widget becomes available; added back it goes last in its default size", () => {
    const removed = removeWidget(resizeWidget(draft, "a/x", { w: 3, h: 2 }), "a/x");
    expect(keys(removed)).toEqual({ widgets: ["b/x", "c/x"], available: ["d/x", "a/x"] });
    const added = addWidget(removed, "a/x");
    expect(keys(added)).toEqual({ widgets: ["b/x", "c/x", "a/x"], available: ["d/x"] });
    expect(added.widgets[2]?.size).toEqual({ w: 3, h: 3 });
    expect(addWidget(draft, "a/x")).toBe(draft);
    expect(removeWidget(draft, "d/x")).toBe(draft);
  });

  test("reconciling with fresh data keeps the admin's edits and picks up new and gone widgets", () => {
    // The admin moved c/x first, resized it and removed a/x.
    const moved = moveWidget(moveWidget(draft, "c/x", -1), "c/x", -1);
    const edited = removeWidget(resizeWidget(moved, "c/x", { w: 3, h: 2 }), "a/x");
    // Meanwhile plugin e was switched on (one widget on the dashboard, one available) and plugin b switched off.
    const latest: LayoutDraft = {
      widgets: [widget("a/x"), widget("c/x"), widget("e/x")],
      available: [widget("d/x"), widget("e/y")],
    };
    const next = reconcileDraft(edited, latest);
    expect(keys(next)).toEqual({ widgets: ["c/x", "e/x"], available: ["d/x", "a/x", "e/y"] });
    expect(next.widgets[0]?.size).toEqual({ w: 3, h: 2 });
    // Nothing new: the draft stays as the admin left it.
    expect(keys(reconcileDraft(next, latest))).toEqual(keys(next));
  });

  test("what the API takes: keys and sizes in order", () => {
    expect(layoutInput(moveWidget(draft, "c/x", -1)).widgets).toEqual([
      { key: "a/x", size: { w: 3, h: 3 } },
      { key: "c/x", size: { w: 3, h: 3 } },
      { key: "b/x", size: { w: 3, h: 3 } },
    ]);
  });

  test("size labels", () => {
    expect(sizeLabel({ w: 2, h: 1 })).toBe("2 × 1");
    expect(sizeLabel({ w: 2, h: 1 }, true)).toBe("2×1");
  });

  test("widgets grouped by plugin, in order of first appearance", () => {
    const groups = byPlugin([widget("a/x"), widget("b/x"), widget("a/y")]);
    expect(groups.map((g) => [g.pluginId, g.widgets.map((w) => w.key)])).toEqual([
      ["a", ["a/x", "a/y"]],
      ["b", ["b/x"]],
    ]);
  });
});
