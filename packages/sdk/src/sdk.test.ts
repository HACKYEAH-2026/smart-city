import { describe, expect, test } from "bun:test";
import { geoLocation } from "./geo";
import { sdk } from "./load";
import { pluginManifestSchema } from "./plugin";
import { dashboardWidgetSchema, MAP_LIMITS, screenSchema, ui, uiNodeSchema } from "./ui";

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
    const ok = ui.widget("Zgłoszenia", [ui.text("2 w toku")], { onPress: ui.navigate("list") });
    expect(dashboardWidgetSchema.parse(ok)).toEqual(ok);
    expect(dashboardWidgetSchema.safeParse({ ...ok, onPress: ui.tool("remove") }).success).toBe(false);
  });

  test("dashboard widget header: an icon, a subtitle and a link that only navigates", () => {
    const head = ui.widget("Zgłoszenia", [ui.text("2 w toku")], {
      icon: "megaphone",
      subtitle: "2 otwarte",
      link: { label: "Wszystkie", action: ui.navigate("list") },
    });
    expect(dashboardWidgetSchema.parse(head)).toEqual(head);
    expect(dashboardWidgetSchema.safeParse({ ...head, icon: "rocket" }).success).toBe(false);
    expect(
      dashboardWidgetSchema.safeParse({ ...head, link: { label: "Usuń", action: ui.tool("remove") } }).success,
    ).toBe(false);
  });

  test("highlight: a read-only tile with an optional photo, a vote count and a tap", () => {
    const tile = ui.highlight({
      eyebrow: "Najczęściej podbijane",
      title: "Dziura w jezdni",
      votes: 24,
      image: { file: "f1", alt: "Zdjęcie dziury" },
      onPress: ui.navigate("detail", { id: "1" }),
    });
    expect(uiNodeSchema.parse(tile)).toEqual(tile);
    expect(uiNodeSchema.safeParse({ ...tile, votes: -1 }).success).toBe(false);
    expect(dashboardWidgetSchema.safeParse(ui.widget("x", [{ ...tile, onPress: ui.tool("remove") }])).success).toBe(
      false,
    );
  });

  test("buttons take an icon from the set; a row can share its width between children", () => {
    const pair = ui.row(
      [ui.button("Zgłoś", ui.navigate("new"), "primary", "camera"), ui.button("Sugestia", ui.navigate("new"), "quiet")],
      { grow: true },
    );
    expect(uiNodeSchema.parse(pair)).toEqual(pair);
    const badIcon = { type: "Button", label: "x", action: ui.navigate("new"), icon: "rocket" };
    expect(uiNodeSchema.safeParse(badIcon).success).toBe(false);
  });
});

describe("plugin maps", () => {
  const floriańska = { lat: 50.06274, lng: 19.93986 };
  const rynek = { lat: 50.06165, lng: 19.93733 };
  const map = ui.map({
    label: "Utrudnienia",
    layers: [
      ui.map.pins(
        "Awarie",
        [{ id: "1", at: floriańska, title: "Latarnia", onPress: ui.navigate("detail", { id: "1" }) }],
        "danger",
      ),
      ui.map.routes("Objazdy", [{ id: "r", title: "Objazd", path: [floriańska, rynek], dashed: true }], "info"),
      ui.map.areas("Strefy", [
        { id: "a", title: "Brak wody", center: rynek, radius: 300, tone: "warning" },
        { id: "b", title: "Park zamknięty", polygon: [floriańska, rynek, { lat: 50.06, lng: 19.94 }] },
      ]),
    ],
  });

  test("pins, routes and areas built from builders pass validation", () => {
    expect(uiNodeSchema.parse(map)).toEqual(map);
    expect(screenSchema.safeParse(ui.screen("Mapa", [map])).success).toBe(true);
  });

  test("rejects bad geometry and maps over the limits", () => {
    const parse = (layers: unknown[]) => uiNodeSchema.safeParse({ type: "Map", label: "x", layers }).success;
    expect(parse([ui.map.pins("x", [{ id: "1", at: { lat: 91, lng: 0 }, title: "x" }])])).toBe(false);
    expect(parse([ui.map.routes("x", [{ id: "1", title: "x", path: [rynek] }])])).toBe(false);
    expect(parse([ui.map.areas("x", [{ id: "1", title: "x", center: rynek, radius: MAP_LIMITS.radius + 1 }])])).toBe(
      false,
    );
    const pins = (n: number) => Array.from({ length: n }, (_, i) => ({ id: String(i), at: rynek, title: "x" }));
    expect(parse([ui.map.pins("x", pins(MAP_LIMITS.items))])).toBe(true);
    expect(
      parse([ui.map.pins("x", pins(MAP_LIMITS.items / 2)), ui.map.pins("y", pins(MAP_LIMITS.items / 2 + 1))]),
    ).toBe(false);
  });

  test("a map in a dashboard widget: navigation only, like the rest of a widget", () => {
    expect(dashboardWidgetSchema.safeParse(ui.widget("Mapa", [map])).success).toBe(true);
    const withTool = ui.map({
      label: "x",
      layers: [ui.map.pins("x", [{ id: "1", at: rynek, title: "x", onPress: ui.tool("remove", { id: "1" }) }])],
    });
    expect(dashboardWidgetSchema.safeParse(ui.widget("Mapa", [withTool])).success).toBe(false);
  });

  test("location field: inside a form only (not a widget); the tool validates what it sends", () => {
    const field = ui.locationInput({ name: "where", label: "Gdzie?" });
    const form = ui.form({ submitLabel: "Wyślij", submit: ui.tool("report"), children: [field] });
    expect(uiNodeSchema.parse(form)).toEqual(form);
    expect(dashboardWidgetSchema.safeParse(ui.widget("x", [field])).success).toBe(false);
    expect(geoLocation().parse(floriańska)).toEqual({ ...floriańska, address: "" });
    expect(geoLocation().safeParse({ lat: "50", lng: 19 }).success).toBe(false);
  });

  test("plugins get a frozen ui.map: one plugin cannot swap the builders under the others", () => {
    expect(Object.isFrozen(sdk.ui.map)).toBe(true);
    expect(() => {
      (sdk.ui.map as { pins: unknown }).pins = () => null;
    }).toThrow();
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

describe("list screen", () => {
  test("a screen may show an eyebrow line above its title", () => {
    const screen = ui.screen("Zgłoszenia", [], { eyebrow: "Osiedle Słoneczne" });
    expect(screenSchema.parse(screen)).toEqual(screen);
  });

  test("a card may show tags and a vote counter; the counter's action is a tool, so widgets reject it", () => {
    const card = ui.card({
      title: "Dziura w jezdni",
      tags: [
        { text: "Problem", tone: "danger", icon: "alert" },
        { text: "Nowe", tone: "neutral", dot: true },
      ],
      counter: { label: "Podbij zgłoszenie", value: 3, pressed: false, action: ui.tool("support", { id: "1" }) },
    });
    expect(uiNodeSchema.parse(card)).toEqual(card);
    expect(uiNodeSchema.safeParse({ ...card, counter: { ...card.counter, value: -1 } }).success).toBe(false);
    expect(dashboardWidgetSchema.safeParse(ui.widget("Zgłoszenia", [card])).success).toBe(false);
    // A pressed counter has no action: the resident already confirmed it.
    const done = ui.card({ title: "Dziura", counter: { label: "Podbij zgłoszenie", value: 3, pressed: true } });
    expect(uiNodeSchema.parse(done)).toEqual(done);
  });

  test("tabs: one option is selected, and each option only navigates", () => {
    const tabs = ui.tabs({
      label: "Sortowanie",
      variant: "segmented",
      options: [
        { label: "Popularne", selected: true, action: ui.navigate("list", { sort: "popular" }, { replace: true }) },
        { label: "Najnowsze", action: ui.navigate("list", { sort: "newest" }, { replace: true }) },
      ],
    });
    expect(uiNodeSchema.parse(tabs)).toEqual(tabs);
    expect(uiNodeSchema.safeParse({ ...tabs, options: [{ label: "Usuń", action: ui.tool("remove") }] }).success).toBe(
      false,
    );
  });

  test("fab: a floating button that navigates", () => {
    const fab = ui.fab({ label: "Zgłoś", icon: "camera", action: ui.navigate("new") });
    expect(uiNodeSchema.parse(fab)).toEqual(fab);
    expect(uiNodeSchema.safeParse({ ...fab, action: ui.tool("report") }).success).toBe(false);
  });
});
