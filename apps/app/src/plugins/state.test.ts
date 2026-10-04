import { describe, expect, test } from "bun:test";
import type { ToolAction } from "@app/plugin-sdk";
import { type Pending, photoValue, saveAction, sheetKey, shownValue, syncFormValues } from "./state";

test("form refresh preserves drafts for unchanged server fields and syncs only changed values", () => {
  const before = { reply: "", note: "", photos: ["f1"], location: { lat: 50, lng: 20, address: "Place" } };
  const draft = { ...before, reply: "Unsaved reply", note: "Unsaved note" };
  expect(syncFormValues(draft, before, { ...before, photos: ["f1"] })).toEqual(draft);
  expect(syncFormValues(draft, before, { ...before, reply: "Server reply" })).toEqual({
    ...draft,
    reply: "Server reply",
  });
  expect(syncFormValues(draft, before, { note: "", photos: ["f1"] })).toEqual({ note: "Unsaved note", photos: ["f1"] });
});

describe("save-on-change fields", () => {
  test("show the change while it is saved, then the server's value (rolled back or refreshed)", () => {
    const saving: Pending<boolean> = { value: true };
    expect(shownValue(false, saving)).toBe(true);
    // Settled: a failed save shows the confirmed value again; a saved one shows the refreshed value.
    expect(shownValue(false, null)).toBe(false);
    expect(shownValue(true, null)).toBe(true);
    expect(shownValue<string>(undefined, null)).toBeUndefined();
  });

  test("the change goes to the tool under the field's name, over the tool's own args", () => {
    const action: ToolAction = {
      type: "tool",
      tool: "saveSettings",
      args: { section: "comments", votingEnabled: true },
    };
    expect(saveAction(action, "votingEnabled", false)).toEqual({
      type: "tool",
      tool: "saveSettings",
      args: { section: "comments", votingEnabled: false },
    });
    expect(saveAction({ type: "tool", tool: "saveSettings" }, "visibility", "members").args).toEqual({
      visibility: "members",
    });
  });
});

describe("photo fields", () => {
  test("several photos: always a list, an empty one when every photo was removed", () => {
    expect(photoValue(3, ["f1", "f2"])).toEqual(["f1", "f2"]);
    expect(photoValue(3, [])).toEqual([]);
  });

  test("one photo: its FileId, or nothing (the field is left out)", () => {
    expect(photoValue(1, ["f1"])).toBe("f1");
    expect(photoValue(1, [])).toBeUndefined();
  });
});

describe("sheet identity", () => {
  test("the same view and params in any order is the same sheet; other params or another view are not", () => {
    const merge = sheetKey({ view: "merge", params: { id: "1", photos: "f1" } });
    expect(sheetKey({ view: "merge", params: { photos: "f1", id: "1" } })).toBe(merge);
    expect(sheetKey({ view: "merge", params: { id: "2", photos: "f1" } })).not.toBe(merge);
    expect(sheetKey({ view: "merged", params: { id: "1", photos: "f1" } })).not.toBe(merge);
  });
});
