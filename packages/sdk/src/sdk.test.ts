import { describe, expect, test } from "bun:test";
import { pluginManifestSchema } from "./plugin";
import { dashboardWidgetSchema, screenSchema, ui, uiNodeSchema } from "./ui";

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

  test("dashboard widget: a Widget root with reading and navigation only", () => {
    const ok = ui.widget("Ogłoszenia", [ui.card({ title: "Nowe", onPress: ui.navigate("item", { id: "1" }) })]);
    expect(dashboardWidgetSchema.parse(ok)).toEqual(ok);
    expect(dashboardWidgetSchema.safeParse(ui.screen("Ogłoszenia", [])).success).toBe(false);
    const withForm = ui.widget("x", [ui.form({ submitLabel: "Wyślij", submit: ui.tool("send"), children: [] })]);
    expect(dashboardWidgetSchema.safeParse(withForm).success).toBe(false);
    expect(
      dashboardWidgetSchema.safeParse(ui.widget("x", [ui.stack([ui.button("Usuń", ui.tool("remove"))])])).success,
    ).toBe(false);
  });

  test("dashboard widget: tapping it may only navigate to a view of the plugin", () => {
    const ok = ui.widget("Zgłoszenia", [ui.text("2 w toku")], ui.navigate("list"));
    expect(dashboardWidgetSchema.parse(ok)).toEqual(ok);
    expect(dashboardWidgetSchema.safeParse({ ...ok, onPress: ui.tool("remove") }).success).toBe(false);
  });
});

describe("plugin manifest", () => {
  test("fills in defaults", () => {
    const m = pluginManifestSchema.parse({
      id: "notes",
      name: "Notatki",
      version: "1.0.0",
      nav: [{ view: "main", label: "Notatki" }],
    });
    expect(m).toMatchObject({ icon: "🧩", permissions: [], description: "" });
  });

  test("rejects bad id, version and empty nav", () => {
    const base = { id: "notes", name: "Notatki", version: "1.0.0", nav: [{ view: "main", label: "Notatki" }] };
    expect(pluginManifestSchema.safeParse({ ...base, id: "Notatki!" }).success).toBe(false);
    expect(pluginManifestSchema.safeParse({ ...base, version: "v1" }).success).toBe(false);
    expect(pluginManifestSchema.safeParse({ ...base, nav: [] }).success).toBe(false);
  });
});
