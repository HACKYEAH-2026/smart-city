import { describe, expect, test } from "bun:test";
import { pluginManifestSchema } from "./plugin";
import { screenSchema, ui, uiNodeSchema } from "./ui";

describe("UI catalog", () => {
  test("tree built from builders passes validation", () => {
    const tree = ui.screen("Zgłoszenia", [
      ui.button("Nowe", ui.navigate("new")),
      ui.list("Lista", [
        ui.card({
          title: "Latarnia",
          badge: { text: "Nowe", tone: "info" },
          onPress: ui.navigate("detail", { id: "1" }),
        }),
      ]),
      ui.form({
        submitLabel: "Wyślij",
        submit: ui.tool("report"),
        children: [ui.textInput({ name: "title", label: "Tytuł" })],
      }),
    ]);
    expect(screenSchema.parse(tree)).toEqual(tree);
  });

  test("rejects unknown node type and bad action", () => {
    expect(uiNodeSchema.safeParse({ type: "Script", code: "alert(1)" }).success).toBe(false);
    expect(uiNodeSchema.safeParse({ type: "Button", label: "x", action: { type: "eval" } }).success).toBe(false);
  });

  test("view must return a Screen", () => {
    expect(screenSchema.safeParse(ui.text("samotny tekst")).success).toBe(false);
  });
});

describe("plugin manifest", () => {
  test("fills in defaults", () => {
    const m = pluginManifestSchema.parse({
      id: "benches",
      name: "Ławki",
      version: "1.0.0",
      nav: [{ view: "main", label: "Ławki" }],
    });
    expect(m).toMatchObject({ icon: "🧩", permissions: [], description: "" });
  });

  test("rejects bad id, version and empty nav", () => {
    const base = { id: "benches", name: "Ławki", version: "1.0.0", nav: [{ view: "main", label: "Ławki" }] };
    expect(pluginManifestSchema.safeParse({ ...base, id: "Ławki!" }).success).toBe(false);
    expect(pluginManifestSchema.safeParse({ ...base, version: "v1" }).success).toBe(false);
    expect(pluginManifestSchema.safeParse({ ...base, nav: [] }).success).toBe(false);
  });
});
