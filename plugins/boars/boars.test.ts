import { describe, expect, test } from "bun:test";
import type { GeoLocation, PluginUser, ToolResult, UINode } from "@app/plugin-sdk";
import { testPlugin, textsOf } from "@app/plugin-sdk/testing";
import boars from "./index";

const anna: PluginUser = { id: "anna", name: "Anna", role: "user" };
const bartek: PluginUser = { id: "bartek", name: "Bartek", role: "user" };
const city: PluginUser = { id: "city", name: "Urząd Miasta", role: "admin" };

const wolski: GeoLocation = { lat: 50.0614, lng: 19.8436, address: "al. Panieńskich Skał, Las Wolski" };
const borkowski: GeoLocation = { lat: 50.0163, lng: 19.9002, address: "Las Borkowski, Kraków" };

const start = new Date("2026-10-04T16:00:00Z");
const later = (minutes: number) => new Date(start.getTime() + minutes * 60 * 1000);
/** Every boundary is crossed by a minute, never hit exactly: the windows compare with `>`. */
const SLACK = 1;
const DAY = 24 * 60;

const setup = async () => {
  const plugin = await testPlugin(boars, { user: anna, community: { slug: "krakow", name: "Kraków" } });
  plugin.setNow(start);
  return plugin;
};

type Harness = Awaited<ReturnType<typeof setup>>;
/** The harness database is untyped (it gets the module, not its table types). */
const tableOf = (plugin: Harness, name: string) => {
  const table = plugin.db[name];
  if (!table) throw new Error(`no table ${name}`);
  return table;
};

const idOf = (result: ToolResult) => {
  const id = result.navigate?.params?.id;
  if (!id) throw new Error(`no sighting id in ${JSON.stringify(result)}`);
  return id;
};

const flat = (node: UINode): UINode[] => [
  node,
  ...("children" in node && node.children ? node.children.flatMap(flat) : []),
];
const nodesOf = <T extends UINode["type"]>(view: UINode, type: T) =>
  flat(view).filter((node): node is Extract<UINode, { type: T }> => node.type === type);

describe("boars: reporting", () => {
  test("the place is required and checked; the note and photos are limited", async () => {
    const plugin = await setup();
    expect(plugin.invalidInput("report", {})).toEqual([
      expect.objectContaining({ path: ["location"], message: "Zaznacz na mapie, gdzie jest dzik." }),
    ]);
    expect(plugin.invalidInput("report", { location: { lat: 100, lng: 19 } })?.[0]?.path).toEqual(["location", "lat"]);
    expect(plugin.invalidInput("report", { location: wolski, note: "x".repeat(281) })?.[0]?.message).toBe(
      "Notatka może mieć najwyżej 280 znaków.",
    );
    const photos = [
      await plugin.files.fake(),
      await plugin.files.fake(),
      await plugin.files.fake(),
      await plugin.files.fake(),
    ];
    expect(plugin.invalidInput("report", { location: wolski, photos })?.[0]?.message).toBe("Dodaj najwyżej 3 zdjęcia.");
    expect(plugin.invalidInput("report", { location: wolski })).toBeNull();
  });

  test("a report stores the sighting with its photos and warns residents within 500 m", async () => {
    const plugin = await setup();
    const photos = [await plugin.files.fake(), await plugin.files.fake()];
    const result = await plugin.tool("report", {
      location: wolski,
      withYoung: true,
      note: "Przy placu zabaw",
      photos,
    });
    const id = idOf(result);
    expect(result).toMatchObject({
      toast: "Zgłoszenie zapisane. Ostrzeżenie wysłane w promieniu 500 m.",
      navigate: { type: "navigate", view: "sighting", params: { id }, replace: true },
    });

    const [row] = await tableOf(plugin, "sightings").findMany();
    expect(row).toMatchObject({ id, location: wolski, withYoung: true, note: "Przy placu zabaw", reporter: anna.id });
    expect(await tableOf(plugin, "photos").count()).toBe(2);
    expect(await Promise.all(photos.map((p) => plugin.files.isKept(p)))).toEqual([true, true]);

    expect(plugin.notifications()).toEqual([
      {
        from: anna.id,
        to: { near: { lat: wolski.lat, lng: wolski.lng, radius: 500 } },
        tone: "danger",
        title: "Dzik z młodymi w pobliżu",
        body: "al. Panieńskich Skał, Las Wolski. Przy placu zabaw. Nie podchodź i nie karm dzika. Weź psa na smycz i omiń to miejsce. Locha broni młodych: trzymaj się z daleka.",
        open: { type: "navigate", view: "sighting", params: { id } },
      },
    ]);
  });

  test("the push uses only a real address and makes the note a sentence", async () => {
    const plugin = await setup();
    await plugin.tool("report", {
      location: { lat: wolski.lat, lng: wolski.lng, address: "" },
      note: "idzie w stronę szkoły",
    });
    expect(plugin.notifications()[0]?.body).toBe(
      "Idzie w stronę szkoły. Nie podchodź i nie karm dzika. Weź psa na smycz i omiń to miejsce.",
    );
  });

  test("one report per resident every 90 seconds; others can report meanwhile", async () => {
    const plugin = await setup();
    await plugin.tool("report", { location: wolski });
    plugin.setNow(later(1));
    expect((await plugin.tool("report", { location: borkowski })).error).toBe(
      "Twoje ostrzeżenie zostało już wysłane. Następne możesz wysłać za chwilę.",
    );
    expect((await plugin.as(bartek).tool("report", { location: borkowski })).error).toBeUndefined();
    plugin.setNow(later(1.5 + SLACK));
    expect((await plugin.tool("report", { location: borkowski })).error).toBeUndefined();
    expect(await tableOf(plugin, "sightings").count()).toBe(3);
    expect(plugin.notifications()).toHaveLength(3);
  });

  test("someone else's photo is refused and nothing is sent", async () => {
    const plugin = await setup();
    const foreign = await plugin.as(bartek).files.fake();
    expect((await plugin.tool("report", { location: wolski, photos: [foreign] })).error).toBe(
      "Nie można dodać tego zdjęcia. Dodaj je jeszcze raz.",
    );
    expect(await tableOf(plugin, "sightings").count()).toBe(0);
    expect(plugin.notifications()).toEqual([]);
  });
});

describe("boars: views", () => {
  test("the form: place, young, note, photos, sent to the report tool", async () => {
    const plugin = await setup();
    const view = await plugin.view("report");
    expect(view).toMatchObject({ type: "Screen", title: "Zgłoś dzika" });
    const [form] = nodesOf(view, "Form");
    expect(form).toMatchObject({ submitLabel: "Ostrzeż sąsiadów", submit: { type: "tool", tool: "report" } });
    expect(form?.children.map((field) => field.type)).toEqual(["LocationInput", "Switch", "TextInput", "ImagePicker"]);
  });

  test("the list: a map with fresh and older pins, cards newest first, a calm empty state", async () => {
    const plugin = await setup();
    const empty = await plugin.view("list");
    expect(nodesOf(empty, "Map")).toEqual([]);
    expect(textsOf(empty)).toContain("W ostatnim tygodniu nikt nie zgłosił dzika w okolicy.");

    const old = idOf(await plugin.tool("report", { location: borkowski }));
    plugin.setNow(later(2 * DAY));
    const fresh = idOf(await plugin.as(bartek).tool("report", { location: wolski, withYoung: true }));
    const view = await plugin.view("list");

    expect(nodesOf(view, "Card").map((c) => c.title)).toEqual([wolski.address, borkowski.address]);
    expect(nodesOf(view, "Card")[0]?.tags).toEqual([{ text: "Z młodymi", tone: "danger", dot: true }]);
    const [map] = nodesOf(view, "Map");
    expect(map?.layers.map((l) => [l.title, l.tone, l.items.map((i) => i.id)])).toEqual([
      ["Ostatnia doba", "danger", [fresh]],
      ["Wcześniej", "warning", [old]],
    ]);
    expect(nodesOf(view, "Fab")[0]).toMatchObject({ label: "Zgłoś dzika", action: { view: "report" } });

    plugin.setNow(later(2 * DAY + DAY + SLACK));
    const [olderOnly] = nodesOf(await plugin.view("list"), "Map");
    expect(olderOnly?.layers.map((l) => l.title)).toEqual(["Wcześniej"]);

    plugin.setNow(later(2 * DAY + 7 * DAY + SLACK));
    expect(nodesOf(await plugin.view("list"), "Card")).toEqual([]);
  });

  test("a sighting: photos, the alert zone, what to do, no reporter's name; unknown id", async () => {
    const plugin = await setup();
    const photo = await plugin.files.fake();
    const id = idOf(await plugin.tool("report", { location: wolski, note: "Przy placu zabaw", photos: [photo] }));

    const view = await plugin.as(bartek).view("sighting", { id });
    expect(view).toMatchObject({ title: "Dzik w okolicy", eyebrow: "Uwaga, dzik!" });
    expect(nodesOf(view, "Gallery")[0]?.items.map((i) => i.file)).toEqual([photo]);
    const [map] = nodesOf(view, "Map");
    expect(map?.layers[0]).toMatchObject({
      kind: "areas",
      tone: "danger",
      items: [{ center: { lat: wolski.lat, lng: wolski.lng }, radius: 500 }],
    });
    const texts = textsOf(view);
    expect(texts).toContain("Przy placu zabaw");
    expect(texts).toContain(wolski.address);
    expect(texts).toContain("Nie podchodź i nie karm dzika. Weź psa na smycz i omiń to miejsce.");
    expect(JSON.stringify(view)).not.toContain(anna.name);
    expect(JSON.stringify(view)).not.toContain(anna.id);
    expect(view).not.toHaveProperty("actions");
    expect(nodesOf(view, "Share")[0]?.path).toBe(`/app/c/krakow/boars/sighting?id=${id}`);
    expect(textsOf(await plugin.view("sighting", { id }))).toContain("Twoje zgłoszenie");

    expect(await plugin.view("sighting", { id: "missing" })).toMatchObject({ title: "Nie znaleziono" });
  });

  test("the author and admins remove a sighting with its photos; other residents cannot", async () => {
    const plugin = await setup();
    const photo = await plugin.files.fake();
    const first = idOf(await plugin.tool("report", { location: wolski, photos: [photo] }));
    plugin.setNow(later(1.5 + SLACK));
    const second = idOf(await plugin.tool("report", { location: borkowski }));

    const removeAction = {
      actions: [
        expect.objectContaining({
          label: "Usuń",
          action: { type: "tool", tool: "remove", args: { id: first } },
          confirm: expect.objectContaining({ confirmLabel: "Usuń" }),
        }),
      ],
    };
    expect(await plugin.view("sighting", { id: first })).toMatchObject(removeAction);
    expect(await plugin.as(city).view("sighting", { id: first })).toMatchObject(removeAction);

    expect((await plugin.as(bartek).tool("remove", { id: first })).error).toBe("Możesz usunąć tylko swoje zgłoszenie.");
    expect(await plugin.tool("remove", { id: first })).toMatchObject({
      toast: "Zgłoszenie usunięte.",
      navigate: { type: "navigate", view: "list", replace: true },
    });
    expect(await tableOf(plugin, "photos").count()).toBe(0);
    expect((await plugin.as(city).tool("remove", { id: second })).toast).toBe("Zgłoszenie usunięte.");
    expect(await tableOf(plugin, "sightings").count()).toBe(0);
    expect((await plugin.tool("remove", { id: second })).error).toBe("To zgłoszenie już nie istnieje.");
  });

  test("the recent tool gives assistants the sighting, never who reported it", async () => {
    const plugin = await setup();
    const id = idOf(await plugin.tool("report", { location: wolski, withYoung: true, note: "Przy placu zabaw" }));
    const { data } = await plugin.as(bartek).tool("recent");
    expect(data).toEqual([
      {
        id,
        place: wolski.address,
        lat: wolski.lat,
        lng: wolski.lng,
        withYoung: true,
        note: "Przy placu zabaw",
        createdAt: start.toISOString(),
      },
    ]);
  });
});

describe("boars: dashboard widget", () => {
  test("calm when nothing was seen in 24 h, the latest sightings in danger tone otherwise", async () => {
    const plugin = await setup();
    const calm = await plugin.dashboardWidget("latest");
    expect(textsOf(calm)).toEqual([
      "Uwaga, dzik!",
      "Spokojnie",
      "Nikt nie zgłosił dzika w ciągu ostatniej doby.",
      "Zgłoś dzika",
    ]);
    expect(nodesOf(calm, "Button")[0]?.action).toMatchObject({ type: "navigate", view: "report" });

    await plugin.tool("report", { location: borkowski });
    plugin.setNow(later(10));
    const second = idOf(await plugin.tool("report", { location: wolski, withYoung: true }));
    plugin.setNow(later(11));
    await plugin.as(bartek).tool("report", { location: borkowski });

    const widget = await plugin.dashboardWidget("latest");
    expect(widget).toMatchObject({ icon: "alert", link: { label: "w ciągu doby", count: 3 } });
    const rows = nodesOf(widget, "Card");
    expect(rows).toHaveLength(2);
    expect(rows.map((c) => c.badge)).toEqual([
      { text: "Dzik", tone: "danger" },
      { text: "Z młodymi", tone: "danger" },
    ]);
    expect(rows[1]?.onPress).toMatchObject({ view: "sighting", params: { id: second } });
    expect(nodesOf(await plugin.dashboardWidget("latest", { size: { w: 3, h: 3 } }), "Card")).toHaveLength(3);

    plugin.setNow(later(11 + DAY + SLACK));
    expect(textsOf(await plugin.dashboardWidget("latest"))).toContain("Spokojnie");
  });
});
