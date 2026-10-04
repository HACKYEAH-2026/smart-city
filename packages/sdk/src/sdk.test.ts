import { describe, expect, test } from "bun:test";
import { geoLocation } from "./geo";
import { sdk } from "./load";
import { pluginManifestSchema } from "./plugin";
import {
  dashboardWidgetSchema,
  MAP_LIMITS,
  type ScreenAction,
  screenSchema,
  toolResultSchema,
  UI_ICONS,
  ui,
  uiNodeSchema,
} from "./ui";

describe("UI catalog", () => {
  test("screen back allows host app destinations and rejects tools", () => {
    const screen = ui.screen("Settings", [], { back: ui.app("pluginPage"), chrome: false });
    expect(screenSchema.parse(screen)).toEqual(screen);
    expect(screenSchema.safeParse({ ...screen, back: ui.tool("save") }).success).toBe(false);
    expect(screenSchema.safeParse({ ...screen, back: { type: "app", screen: "unknown" } }).success).toBe(false);
  });
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

  test("activity: a person, a line of text and an ISO time; read-only in a widget", () => {
    const row = ui.activity({
      title: "Zieleń przy Rondzie Mogilskim",
      text: "Anna: Proponuję lipy",
      person: "Anna Nowak",
      at: "2026-10-04T08:30:00.000Z",
      unread: true,
      onPress: ui.navigate("thread", { id: "1" }),
    });
    expect(uiNodeSchema.parse(row)).toEqual(row);
    expect(uiNodeSchema.parse(ui.activity({ title: "Anna" }))).toEqual({ type: "Activity", title: "Anna" });
    expect(uiNodeSchema.safeParse({ ...row, at: "wczoraj" }).success).toBe(false);
    expect(dashboardWidgetSchema.safeParse(ui.widget("x", [row])).success).toBe(true);
    expect(dashboardWidgetSchema.safeParse(ui.widget("x", [{ ...row, onPress: ui.tool("remove") }])).success).toBe(
      false,
    );
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

  test("a screen may say where its back button leads (default: the dashboard)", () => {
    const screen = ui.screen("Dziura", [], { back: ui.navigate("list") });
    expect(screenSchema.parse(screen)).toEqual(screen);
    expect(
      screenSchema.safeParse({ type: "Screen", title: "Dziura", children: [], back: { type: "tool", tool: "remove" } })
        .success,
    ).toBe(false);
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

describe("issue details", () => {
  test("a timeline: steps in order, each with a date, an optional note and a tone for its dot", () => {
    const timeline = ui.timeline([
      { title: "Zgłoszone", at: "30 wrz, 18:40", tone: "neutral" },
      { title: "W realizacji", at: "2 paź", text: "Zgłosiliśmy sprawę zarządcy drogi.", tone: "warning" },
    ]);
    expect(uiNodeSchema.parse(timeline)).toEqual(timeline);
    expect(uiNodeSchema.safeParse({ type: "Timeline", items: [] }).success).toBe(false);
  });

  test("share: a button that shares an app link (a path inside the app)", () => {
    const share = ui.share("Udostępnij", "/app/c/krakow/issues/detail?id=1");
    expect(uiNodeSchema.parse(share)).toEqual(share);
    expect(uiNodeSchema.safeParse({ ...share, path: "https://example.test" }).success).toBe(false);
  });
});

describe("square controls", () => {
  test("a form may be inline: its submit is a square send button beside the field", () => {
    const composer = ui.form({
      submitLabel: "Wyślij",
      submit: ui.tool("comment", { id: "1" }),
      inline: true,
      children: [ui.textInput({ name: "text", label: "Dodaj komentarz" })],
    });
    expect(uiNodeSchema.parse(composer)).toEqual(composer);
  });

  test("a square icon set includes send and share", () => {
    expect(UI_ICONS).toEqual(expect.arrayContaining(["send", "share"]));
  });
});

describe("tags row", () => {
  test("a row of tags with tones, icons and dots", () => {
    const tags = ui.tags([
      { text: "Problem", tone: "danger", icon: "alert" },
      { text: "W realizacji", tone: "warning", dot: true },
    ]);
    expect(uiNodeSchema.parse(tags)).toEqual(tags);
    expect(uiNodeSchema.safeParse({ type: "Tags", items: [] }).success).toBe(false);
  });
});

describe("place row", () => {
  test("a place: a row with a pin and the address", () => {
    const place = ui.place("ul. Słoneczna 5");
    expect(uiNodeSchema.parse(place)).toEqual(place);
    expect(uiNodeSchema.safeParse({ type: "Place", text: "" }).success).toBe(false);
  });
});

describe("reserved plugin ids", () => {
  test("an id the app's routes use (manage) is rejected", () => {
    const base = { name: "Notatki", version: "1.0.0", nav: [{ view: "main", label: "Notatki" }] };
    expect(pluginManifestSchema.safeParse({ ...base, id: "manage" }).success).toBe(false);
    expect(pluginManifestSchema.safeParse({ ...base, id: "manager" }).success).toBe(true);
  });
});

describe("cards with photos, meta and counts", () => {
  const at = "2026-10-01T08:00:00.000Z";

  test("an image with +N, a meta line, a toggle counter: valid, and not read-only", () => {
    const card = ui.card({
      title: "Dziura w jezdni",
      image: { file: "f1", alt: "Zdjęcie dziury", more: 2 },
      meta: [{ at }, { text: "8", icon: "chat", label: "Komentarze: 8" }],
      counter: { label: "Podbij zgłoszenie", value: 24, pressed: true, action: ui.tool("vote", { id: "1" }) },
      onPress: ui.navigate("detail", { id: "1" }),
    });
    expect(uiNodeSchema.parse(card)).toEqual(card);
    expect(dashboardWidgetSchema.safeParse(ui.widget("x", [card])).success).toBe(false);
  });

  test("a plain count (no action, no pressed), an icon, a count badge and an unread dot are read-only", () => {
    const rows = ui.list(
      "Najczęściej podbijane",
      [
        ui.card({ title: "Latarnia", counter: { label: "17 głosów", value: 17 }, unread: true }),
        ui.card({ title: "Panel zgłoszeń", icon: "shield", count: 5, onPress: ui.navigate("admin") }),
      ],
      { variant: "grouped" },
    );
    expect(dashboardWidgetSchema.safeParse(ui.widget("x", [rows])).success).toBe(true);
  });

  test("rejects a bad meta item, too many photos besides the thumbnail and a negative count", () => {
    const parse = (props: object) => uiNodeSchema.safeParse({ type: "Card", title: "x", ...props }).success;
    expect(parse({ meta: [{ at: "wczoraj" }] })).toBe(false);
    expect(parse({ meta: [] })).toBe(false);
    expect(parse({ meta: [{ text: "" }] })).toBe(false);
    expect(parse({ image: { file: "f", alt: "a", more: 100 } })).toBe(false);
    expect(parse({ count: -1 })).toBe(false);
    expect(parse({ icon: "rocket" })).toBe(false);
  });

  test("a removable tag makes a card or a Tags row not read-only", () => {
    const tag = { text: "Oświetlenie", onRemove: ui.tool("removeCategory", { name: "Oświetlenie" }) };
    expect(uiNodeSchema.parse(ui.tags([tag]))).toEqual(ui.tags([tag]));
    expect(dashboardWidgetSchema.safeParse(ui.widget("x", [ui.tags([tag])])).success).toBe(false);
    expect(dashboardWidgetSchema.safeParse(ui.widget("x", [ui.card({ title: "x", tags: [tag] })])).success).toBe(false);
    expect(dashboardWidgetSchema.safeParse(ui.widget("x", [ui.tags([{ text: "Oświetlenie" }])])).success).toBe(true);
  });

  test("a list's variant is cards or grouped", () => {
    expect(uiNodeSchema.safeParse({ type: "List", label: "x", variant: "table", children: [] }).success).toBe(false);
  });
});

describe("new leaves: notice, meta, gallery, menu", () => {
  test("notice: a text with an icon and a tone", () => {
    const notice = ui.notice("Widzisz tylko swoje zgłoszenia.", { icon: "lock" });
    expect(uiNodeSchema.parse(notice)).toEqual(notice);
    expect(uiNodeSchema.safeParse({ type: "Notice", text: "" }).success).toBe(false);
    expect(dashboardWidgetSchema.safeParse(ui.widget("x", [notice])).success).toBe(true);
  });

  test("meta: 1-5 items, each a moment or a text", () => {
    const meta = ui.meta([{ text: "Anna N." }, { at: "2026-10-01T08:00:00+02:00" }]);
    expect(uiNodeSchema.parse(meta)).toEqual(meta);
    expect(uiNodeSchema.safeParse({ type: "Meta", items: [] }).success).toBe(false);
    expect(uiNodeSchema.safeParse({ type: "Meta", items: Array(6).fill({ text: "x" }) }).success).toBe(false);
  });

  test("gallery: 1-10 photos with alt texts", () => {
    const gallery = ui.gallery([
      { file: "f1", alt: "Dziura z bliska" },
      { file: "f2", alt: "Dziura z daleka" },
    ]);
    expect(uiNodeSchema.parse(gallery)).toEqual(gallery);
    expect(uiNodeSchema.safeParse({ type: "Gallery", items: [] }).success).toBe(false);
  });

  test("menu: navigate options keep it read-only, a tool option does not", () => {
    const sort = ui.menu({
      label: "Sortowanie",
      variant: "text",
      options: [
        {
          label: "Najwięcej głosów",
          selected: true,
          action: ui.navigate("admin", { sort: "votes" }, { replace: true }),
        },
        { label: "Najnowsze", action: ui.navigate("admin", { sort: "newest" }, { replace: true }) },
      ],
    });
    expect(uiNodeSchema.parse(sort)).toEqual(sort);
    expect(dashboardWidgetSchema.safeParse(ui.widget("x", [sort])).success).toBe(true);
    const category = ui.menu({
      label: "Kategoria",
      icon: "sliders",
      variant: "chip",
      options: [
        { label: "Oświetlenie", selected: true, action: ui.tool("setCategory", { category: "Oświetlenie" }) },
        { label: "Inne", action: ui.tool("setCategory", { category: "Inne" }) },
      ],
    });
    expect(uiNodeSchema.parse(category)).toEqual(category);
    expect(dashboardWidgetSchema.safeParse(ui.widget("x", [category])).success).toBe(false);
    expect(uiNodeSchema.safeParse({ ...sort, options: sort.options.slice(0, 1) }).success).toBe(false);
  });
});

describe("empty, stat, button, share, tabs, text input", () => {
  test("empty: an optional title and icon", () => {
    const empty = ui.empty("Nikt jeszcze niczego nie zgłosił.", { title: "Na razie cisza", icon: "megaphone" });
    expect(uiNodeSchema.parse(empty)).toEqual(empty);
    expect(ui.empty("Nic.")).toEqual({ type: "Empty", text: "Nic." });
  });

  test("stat: an optional tone", () => {
    expect(uiNodeSchema.parse(ui.stat("aktywnych", "8", "success"))).toEqual({
      type: "Stat",
      label: "aktywnych",
      value: "8",
      tone: "success",
    });
  });

  test("button: the ink variant and a pressed toggle", () => {
    const vote = ui.button("Podbite · 25", ui.tool("vote", { id: "1" }), "primary", undefined, { pressed: true });
    expect(uiNodeSchema.parse(vote)).toEqual(vote);
    const report = ui.button("Zgłoś problem", ui.navigate("new"), "ink", "camera");
    expect(dashboardWidgetSchema.safeParse(ui.widget("x", [report])).success).toBe(true);
  });

  test("share: a full-width button variant", () => {
    const share = ui.share("Udostępnij sąsiadom", "/app/c/krakow/issues/detail?id=1", { variant: "button" });
    expect(uiNodeSchema.parse(share)).toEqual(share);
    expect(uiNodeSchema.safeParse({ ...share, variant: "link" }).success).toBe(false);
  });

  test("tabs: tiles with counts", () => {
    const tabs = ui.tabs({
      label: "Stan zgłoszeń",
      variant: "tiles",
      options: [
        {
          label: "Aktywne",
          count: 8,
          selected: true,
          action: ui.navigate("admin", { state: "active" }, { replace: true }),
        },
        { label: "Zamknięte", count: 41, action: ui.navigate("admin", { state: "closed" }, { replace: true }) },
      ],
    });
    expect(uiNodeSchema.parse(tabs)).toEqual(tabs);
  });

  test("text input: a hint and a placeholder", () => {
    const input = ui.textInput({ name: "reply", label: "Odpowiedź", hint: "Widoczna dla członków", placeholder: "…" });
    expect(uiNodeSchema.parse(input)).toEqual(input);
    expect(uiNodeSchema.safeParse({ ...input, hint: "x".repeat(161) }).success).toBe(false);
  });
});

describe("photos, settings that save at once", () => {
  test("image picker: up to `max` photos, prefilled with uploaded ones", () => {
    const picker = ui.imagePicker({
      name: "photos",
      label: "Zdjęcia",
      max: 3,
      value: [{ file: "f1" }, { file: "f2" }],
    });
    expect(uiNodeSchema.parse(picker)).toEqual(picker);
    expect(uiNodeSchema.safeParse({ ...picker, max: 1 }).success).toBe(false);
    expect(uiNodeSchema.safeParse({ ...picker, max: 11 }).success).toBe(false);
    expect(uiNodeSchema.parse(ui.imagePicker({ name: "photo", label: "Zdjęcie" }))).toEqual({
      type: "ImagePicker",
      name: "photo",
      label: "Zdjęcie",
    });
  });

  test("switch and select may carry a tool action; they are inputs, so never in a widget", () => {
    const save = ui.tool("saveSettings");
    const toggle = ui.switch({ name: "votingEnabled", label: "Podbijanie", value: true, action: save });
    const who = ui.select({
      name: "commentPermission",
      label: "Kto może komentować",
      variant: "segmented",
      options: [
        { value: "members", label: "Wszyscy członkowie" },
        { value: "admins", label: "Tylko administratorzy" },
      ],
      value: "members",
      action: save,
    });
    expect(uiNodeSchema.parse(toggle)).toEqual(toggle);
    expect(uiNodeSchema.parse(who)).toEqual(who);
    expect(uiNodeSchema.safeParse({ ...who, variant: "radio" }).success).toBe(true);
    expect(uiNodeSchema.safeParse({ ...toggle, action: ui.navigate("x") }).success).toBe(false);
    expect(dashboardWidgetSchema.safeParse(ui.widget("x", [toggle])).success).toBe(false);
  });
});

describe("screen header actions, sheets, app actions, widget link count", () => {
  test("a screen has up to 2 header actions that navigate or run a tool; an icon-only one needs an icon", () => {
    const panel: ScreenAction = { label: "Panel", icon: "shield", action: ui.navigate("admin") };
    const screen = ui.screen("Zgłoszenia", [], { actions: [panel] });
    expect(screenSchema.parse(screen)).toEqual(screen);
    const parse = (actions: unknown[]) => screenSchema.safeParse({ ...screen, actions }).success;
    expect(parse([{ label: "Ustawienia", variant: "icon", icon: "settings", action: ui.navigate("settings") }])).toBe(
      true,
    );
    expect(parse([{ label: "Ustawienia", variant: "icon", action: ui.navigate("settings") }])).toBe(false);
    expect(parse([{ ...panel, action: ui.tool("remove") }])).toBe(true);
    expect(parse([{ ...panel, action: ui.app("dashboard") }])).toBe(false);
    expect(parse([panel, panel, panel])).toBe(false);
  });

  test("navigate may present the view as a sheet; a tool result may too", () => {
    const sheet = ui.navigate("merge", { id: "1" }, { present: "sheet" });
    expect(sheet).toEqual({ type: "navigate", view: "merge", params: { id: "1" }, present: "sheet" });
    expect(toolResultSchema.parse({ navigate: sheet })).toEqual({ navigate: sheet });
    expect(uiNodeSchema.safeParse({ type: "Button", label: "x", action: { ...sheet, present: "modal" } }).success).toBe(
      false,
    );
  });

  test("the app action leads to the dashboard and is read-only", () => {
    const back = ui.button("Wróć do pulpitu", ui.app("dashboard"), "quiet");
    expect(back.action).toEqual({ type: "app", screen: "dashboard" });
    expect(dashboardWidgetSchema.safeParse(ui.widget("x", [back])).success).toBe(true);
    expect(uiNodeSchema.safeParse({ ...back, action: { type: "app", screen: "settings" } }).success).toBe(false);
  });

  test("a widget link may show a count; it still only navigates", () => {
    const widget = ui.widget("Zgłoszenia", [], {
      link: { label: "aktywnych", count: 12, action: ui.navigate("list") },
    });
    expect(dashboardWidgetSchema.parse(widget)).toEqual(widget);
    expect(
      dashboardWidgetSchema.safeParse({
        ...widget,
        link: { label: "aktywnych", count: -1, action: ui.navigate("list") },
      }).success,
    ).toBe(false);
  });
});

describe("chat screen", () => {
  const message = { id: "m1", person: "Anna Nowak", text: "Proponuję lipy", at: "2026-10-04T08:30:00.000Z" };

  test("a chat of messages, a composer and a confirmed tool action in the header make a valid screen", () => {
    const screen = ui.screen(
      "Zieleń przy Rondzie",
      [
        ui.chat({ label: "Wiadomości", messages: [message, { ...message, id: "m2", mine: true, note: "edytowano" }] }),
        ui.composer({
          name: "text",
          label: "Twoja wiadomość",
          placeholder: "Napisz wiadomość…",
          sendLabel: "Wyślij",
          submit: ui.tool("sendMessage", { discussion: "d1" }),
        }),
      ],
      {
        actions: [
          {
            label: "Zamknij dyskusję",
            icon: "lock",
            variant: "icon",
            action: ui.tool("lockDiscussion", { id: "d1", locked: true }),
            confirm: {
              title: "Zamknąć dyskusję?",
              message: "Pisać będą mogli tylko moderatorzy.",
              confirmLabel: "Zamknij",
            },
          },
        ],
      },
    );
    expect(screenSchema.parse(screen)).toEqual(screen);
  });

  test("messages need an ISO time; a composer is not for widgets", () => {
    expect(uiNodeSchema.safeParse(ui.chat({ label: "x", messages: [{ ...message, at: "wczoraj" }] })).success).toBe(
      false,
    );
    const composer = ui.composer({ name: "text", label: "x", sendLabel: "Wyślij", submit: ui.tool("send") });
    expect(dashboardWidgetSchema.safeParse(ui.widget("x", [composer])).success).toBe(false);
    expect(
      dashboardWidgetSchema.safeParse(ui.widget("x", [ui.chat({ label: "x", messages: [message] })])).success,
    ).toBe(true);
  });
});
