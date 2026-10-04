import { describe, expect, test } from "bun:test";
import type { PluginUser } from "@app/plugin-sdk";
import { ForbiddenError, testPlugin, textsOf } from "@app/plugin-sdk/testing";
import disruptions, { TONES } from "./index";

const city = { id: "city", name: "Urząd", role: "admin" } as const;
const anna = { id: "anna", name: "Anna", role: "user" } as const;

type T = Awaited<ReturnType<typeof testPlugin>>;
/** Sunday 4 October 2026, 10:00 in Warsaw. */
const NOW = new Date("2026-10-04T08:00:00Z");

const ROAD = {
  type: "LineString",
  coordinates: [
    [17.0301, 51.1079],
    [17.0402, 51.1101],
  ],
};
const SQUARE = {
  type: "Polygon",
  coordinates: [
    [
      [17.02, 51.1],
      [17.03, 51.1],
      [17.03, 51.11],
      [17.02, 51.11],
    ],
  ],
};

const start = async () => {
  const t = await testPlugin(disruptions, { user: anna });
  t.setNow(NOW);
  return t;
};
const add = async (t: T, input: Record<string, unknown>) =>
  ((await t.as(city).tool("createDisruption", input)).data as { id: string }).id;
/** Current: 1–20 October; planned: 10–11 October; ended: 1–5 September. */
const seed = async (t: T) => ({
  roadworks: await add(t, {
    title: "Remont ul. Długiej",
    kind: "closure",
    geometry: ROAD,
    startsAt: "2026-10-01 07:00",
    endsAt: "2026-10-20 18:00",
    description: "Wymiana nawierzchni.",
    detour: "Przez ul. Krótką.",
  }),
  market: await add(t, {
    title: "Jarmark na placu",
    kind: "limited",
    geometry: SQUARE,
    startsAt: "2026-10-10 06:00",
    endsAt: "2026-10-11 22:00",
  }),
  old: await add(t, {
    title: "Malowanie pasów",
    kind: "inconvenience",
    geometry: ROAD,
    startsAt: "2026-09-01 07:00",
    endsAt: "2026-09-05 18:00",
  }),
});
const seen = async (t: T, user: PluginUser, view: string, params: Record<string, string> = {}) =>
  textsOf(await t.as(user).view(view, params)).join("\n");

/** Map items (routes and areas) anywhere in a view tree, with their tones (see the MAP ADAPTER in index.ts). */
type MapItem = { id: string; title: string; tone?: string };
const itemsOf = (node: unknown): MapItem[] => {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(itemsOf);
  const o = node as Record<string, unknown>;
  if (o.type === "Map") return (o.layers as { items: MapItem[] }[]).flatMap((layer) => layer.items);
  return Object.values(o).flatMap(itemsOf);
};
const colors = async (t: T, params: Record<string, string> = {}) =>
  Object.fromEntries(itemsOf(await t.view("map", params)).map((i) => [i.title, i.tone]));

describe("disruptions: admins mark them on the map", () => {
  test("roads and areas with time, kind and description; residents cannot publish", async () => {
    const t = await start();
    const { roadworks, market } = await seed(t);
    const road = await t.db.disruptions!.get(roadworks);
    expect(road).toMatchObject({ shape: "line", kind: "closure" });
    expect(road?.startsAt).toEqual(new Date("2026-10-01T05:00:00Z"));
    const area = await t.db.disruptions!.get(market);
    expect(JSON.parse(String(area?.geometry)).coordinates[0]).toHaveLength(5); // the ring was closed

    await expect(
      t.tool("createDisruption", { title: "Moje", kind: "closure", geometry: ROAD, startsAt: "2026-10-05 10:00" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(await seen(t, anna, "new")).toContain("Utrudnienia dodają administratorzy.");
    expect(await seen(t, anna, "map")).not.toContain("Dodaj utrudnienie");
    expect(await seen(t, city, "map")).toContain("Dodaj utrudnienie");
  });

  test("validation of the map shape and dates", async () => {
    const t = await start();
    const base = { title: "Remont", kind: "closure", startsAt: "2026-10-05 10:00" };
    expect(t.invalidInput("createDisruption", base)?.[0]?.message).toBe("Zaznacz odcinek drogi albo obszar na mapie");
    expect(
      t.invalidInput("createDisruption", {
        ...base,
        geometry: { type: "LineString", coordinates: [[17.03, 51.1]] },
      })?.[0]?.message,
    ).toBe("Odcinek drogi musi mieć co najmniej 2 punkty");
    expect(
      t.invalidInput("createDisruption", {
        ...base,
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [17, 51],
              [17.1, 51],
            ],
          ],
        },
      })?.[0]?.message,
    ).toBe("Obszar musi mieć co najmniej 3 punkty");
    expect(
      t.invalidInput("createDisruption", {
        ...base,
        geometry: {
          type: "LineString",
          coordinates: [
            [17, 51],
            [200, 51],
          ],
        },
      })?.[0]?.message,
    ).toBe("Nieprawidłowe współrzędne na mapie");
    // GeoJSON as text and as a Feature (what a map widget may send) are accepted.
    expect(t.invalidInput("createDisruption", { ...base, geometry: JSON.stringify(ROAD) })).toBeNull();
    expect(t.invalidInput("createDisruption", { ...base, geometry: { type: "Feature", geometry: SQUARE } })).toBeNull();
    expect(t.invalidInput("createDisruption", { ...base, geometry: ROAD, kind: "fun" })?.[0]?.path).toEqual(["kind"]);
    expect(
      (await t.as(city).tool("createDisruption", { ...base, geometry: ROAD, endsAt: "2026-10-05 09:00" })).error,
    ).toBe("Koniec musi być po rozpoczęciu.");
  });
});

describe("disruptions: residents see the map and the list", () => {
  test("map: current in red, planned in yellow, ended not shown", async () => {
    const t = await start();
    await seed(t);
    expect(await colors(t)).toEqual({ "Remont ul. Długiej": TONES.current, "Jarmark na placu": TONES.planned });
    expect(await colors(t, { show: "current" })).toEqual({ "Remont ul. Długiej": TONES.current });
    expect(await colors(t, { show: "planned" })).toEqual({ "Jarmark na placu": TONES.planned });
    expect(TONES).toEqual({ current: "danger", planned: "warning" });
    const map = await seen(t, anna, "map");
    expect(map).toContain("Czerwony – trwające");
    expect(map).toContain("Żółty – planowane");

    t.setNow(new Date("2026-10-10T06:00:00Z")); // the market has started
    expect(await colors(t)).toEqual({ "Remont ul. Długiej": TONES.current, "Jarmark na placu": TONES.current });
  });

  test("list: current and planned sections; ended ones on their own list", async () => {
    const t = await start();
    await seed(t);
    const list = await seen(t, anna, "list");
    expect(list).toContain("Trwające utrudnienia (1)");
    expect(list).toContain("Planowane utrudnienia (1)");
    expect(list.indexOf("Remont ul. Długiej")).toBeLessThan(list.indexOf("Planowane utrudnienia"));
    expect(list.indexOf("Jarmark na placu")).toBeGreaterThan(list.indexOf("Planowane utrudnienia"));
    expect(list).not.toContain("Malowanie pasów");
    expect(await seen(t, anna, "list", { past: "1" })).toContain("Malowanie pasów");
  });

  test("details: status, kind, time, description and detour", async () => {
    const t = await start();
    const { roadworks, market } = await seed(t);
    const detail = await seen(t, anna, "detail", { id: roadworks });
    for (const s of [
      "Remont ul. Długiej",
      "Trwa",
      "Zamknięcie",
      "Odcinek drogi",
      "od: czwartek, 1 października 2026, 7:00 · do: wtorek, 20 października 2026, 18:00",
      "Wymiana nawierzchni.",
      "Przez ul. Krótką.",
    ])
      expect(detail).toContain(s);
    expect(detail).not.toContain("Zakończ teraz");
    expect(await seen(t, anna, "detail", { id: market })).toContain("Planowane");
    expect(itemsOf(await t.view("detail", { id: market }))).toEqual([
      expect.objectContaining({ title: "Jarmark na placu", tone: TONES.planned }),
    ]);

    const open = await add(t, {
      title: "Budowa ronda",
      kind: "inconvenience",
      geometry: SQUARE,
      startsAt: "2026-10-02 08:00",
    });
    expect(await seen(t, anna, "detail", { id: open })).toContain("do: odwołania");
  });
});

describe("disruptions: managing", () => {
  test("admins edit, end early and delete", async () => {
    const t = await start();
    const { roadworks, market } = await seed(t);

    await t.as(city).tool("updateDisruption", {
      id: roadworks,
      title: "Remont ul. Długiej (etap 2)",
      kind: "limited",
      geometry: ROAD,
      startsAt: "2026-10-01 07:00",
      endsAt: "2026-10-25 18:00",
    });
    expect(await seen(t, anna, "detail", { id: roadworks })).toContain("Ograniczony dostęp");

    await expect(t.tool("endDisruption", { id: roadworks })).rejects.toBeInstanceOf(ForbiddenError);
    expect((await t.as(city).tool("endDisruption", { id: roadworks })).toast).toBe("Utrudnienie zakończone.");
    expect((await t.as(city).tool("endDisruption", { id: roadworks })).error).toBe(
      "To utrudnienie już się zakończyło.",
    );
    expect(await colors(t)).toEqual({ "Jarmark na placu": TONES.planned });

    // Cancelling a planned one: it never shows up as current.
    await t.as(city).tool("endDisruption", { id: market });
    t.setNow(new Date("2026-10-10T10:00:00Z"));
    expect(await colors(t)).toEqual({});
    expect(await seen(t, anna, "list", { past: "1" })).toContain("Jarmark na placu");

    expect((await t.as(city).tool("deleteDisruption", { id: market })).toast).toBe("Utrudnienie usunięte.");
    expect((await t.as(city).tool("deleteDisruption", { id: market })).error).toBe("To utrudnienie nie istnieje.");
  });

  test("AI tool lists current and planned disruptions with their place", async () => {
    const t = await start();
    const { roadworks, market } = await seed(t);
    const { data } = await t.tool("listDisruptions");
    expect(data).toEqual([
      expect.objectContaining({
        id: roadworks,
        status: "current",
        kindLabel: "Zamknięcie",
        center: { lng: 17.03515, lat: 51.109 },
      }),
      expect.objectContaining({ id: market, status: "planned", shape: "area", center: { lng: 17.025, lat: 51.105 } }),
    ]);
    expect((await t.tool("listDisruptions", { status: "planned" })).data).toEqual([
      expect.objectContaining({ id: market }),
    ]);
  });

  test("widget: an empty state when nothing is going on; current disruptions and what is coming this week", async () => {
    const t = await start();
    expect(textsOf((await t.dashboardWidget("now"))!)).toEqual([
      "Utrudnienia",
      "Teraz nic nie utrudnia przejazdu.",
      "Nic nie utrudnia przejazdu w ciągu 7 dni.",
      "Mapa utrudnień",
    ]);
    await seed(t);
    expect(textsOf((await t.dashboardWidget("now"))!)).toEqual([
      "Utrudnienia",
      "Trwające utrudnienia: 1",
      "Remont ul. Długiej",
      "Zamknięcie",
      "Planowane w ciągu 7 dni: 1",
      "Mapa utrudnień",
    ]);
  });
});
