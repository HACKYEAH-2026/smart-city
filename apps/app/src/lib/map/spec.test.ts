import { describe, expect, test } from "bun:test";
import { colors } from "../../theme/tokens";
import { boundsOf, circle, mapSources, mapSpec, STREET_ZOOM } from "./spec";

const rynek = { lat: 50.06165, lng: 19.93733 };
const floriańska = { lat: 50.06274, lng: 19.93986 };

/** Distance in metres between two points close to each other (equirectangular). */
const metres = (a: typeof rynek, b: typeof rynek) => {
  const x = (b.lng - a.lng) * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(x, b.lat - a.lat) * 111_320;
};

describe("plugin maps on the map page", () => {
  test("an area's circle keeps its radius on the ground and closes its ring", () => {
    const ring = circle(rynek, 300);
    expect(ring).toHaveLength(65);
    expect(ring[0]).toEqual(ring.at(-1));
    for (const p of ring) expect(metres(rynek, p)).toBeCloseTo(300, 0);
  });

  test("bounds around pins, routes and areas; none for an empty map", () => {
    expect(boundsOf({ pins: [] })).toBeNull();
    const bounds = boundsOf({
      pins: [{ id: "p", title: "x", ...rynek }],
      routes: [{ id: "r", path: [rynek, floriańska] }],
      areas: [{ id: "a", polygon: [rynek, floriańska, { lat: 50.05, lng: 19.95 }] }],
    });
    expect(bounds).toEqual([
      [rynek.lng, 50.05],
      [19.95, floriańska.lat],
    ]);
  });

  test("tones colour pins, routes and areas; no tone is the red of place pins", () => {
    const sources = mapSources({
      pins: [
        { id: "a", title: "x", ...rynek },
        { id: "b", title: "y", ...rynek, tone: "warning" },
      ],
      routes: [{ id: "r", path: [rynek, floriańska], tone: "info", dashed: true }],
      areas: [{ id: "z", center: rynek, radius: 100, tone: "success" }],
      selectedId: "b",
      me: null,
    });
    const props = (id: string) =>
      ((sources[id]?.data.features ?? []) as { properties: Record<string, unknown> }[]).map((f) => f.properties);
    expect(props("pins")).toEqual([
      { id: "a", title: "x", selected: false, color: colors.primary },
      { id: "b", title: "y", selected: true, color: colors.mapWarning },
    ]);
    expect(props("routes")).toEqual([{ id: "r", color: colors.mapInfo, dashed: true }]);
    expect(props("areas")).toEqual([{ id: "z", color: colors.mapSuccess }]);
  });

  test("a fitted first view: bounds, room for the panel at the bottom, never closer than a street", () => {
    const fit = boundsOf({ pins: [{ id: "p", title: "x", ...rynek }] });
    const spec = mapSpec(
      { center: rynek, zoom: 12, fit, interactive: true, tapToCenter: false, bottomInset: 20 },
      { pins: [], selectedId: null, me: null },
    );
    expect(spec.bounds).toEqual(fit);
    expect(spec.fitOptions.maxZoom).toBe(STREET_ZOOM);
    expect(spec.fitOptions.padding.bottom).toBeGreaterThan(spec.fitOptions.padding.top);
    expect(spec.pressable).toContain("areas");
  });
});
