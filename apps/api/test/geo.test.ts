import { afterEach, describe, expect, test } from "bun:test";
import type { GeoAddress, MapPlace, PlaceDetails } from "@app/shared";
import { surql } from "surrealdb";
import { geoPoint } from "../src/db";
import { TEST_ADDRESSES } from "../src/test-geocoder";
import { DEMO_ADDRESS, DEMO_LOCATION, DEMO_MAP_PLACES, seedDemoMap } from "../src/test-routes";
import { type Ctx, setup, type TestUser } from "./helpers";

/**
 * Maps: a place's location (the wizard and its admins), finding addresses (the test geocoder: fixed Kraków addresses)
 * and the map of places (public places for everyone signed in, own places for their members; slugs only for members).
 */
let t: Ctx;
afterEach(async () => {
  await t.close();
});

const FLORIANSKA = { lat: 50.06274, lng: 19.93986 };

const create = async (u: TestUser, place: Record<string, unknown>) => {
  const res = await t.request("/api/communities", { method: "POST", headers: u.headers, json: place });
  expect(res.status).toBe(201);
  return (await res.json()) as { slug: string };
};
const mapOf = async (u: TestUser) =>
  (await (await t.request("/api/geo/places", { headers: u.headers })).json()) as MapPlace[];
const detailsOf = async (u: TestUser, slug: string) =>
  (await (await t.request(`/api/communities/${slug}`, { headers: u.headers })).json()) as PlaceDetails;

describe("geo routes", () => {
  test("need a session", async () => {
    t = await setup();
    for (const path of ["/api/geo/search?q=Floria%C5%84ska", "/api/geo/reverse?lat=50&lng=19", "/api/geo/places"]) {
      expect((await t.request(path)).status, path).toBe(401);
    }
  });

  test("address search: matching addresses; a too short query is refused", async () => {
    t = await setup();
    const u = await t.signUp({ place: null });
    const found = (await (
      await t.request(`/api/geo/search?q=${encodeURIComponent("Floriańska 15")}&lat=50.06&lng=19.93`, {
        headers: u.headers,
      })
    ).json()) as GeoAddress[];
    expect(found).toEqual([TEST_ADDRESSES[0] as GeoAddress]);
    expect((await t.request("/api/geo/search?q=F", { headers: u.headers })).status).toBe(400);
  });

  test("the address at a point: the nearest one", async () => {
    t = await setup();
    const u = await t.signUp({ place: null });
    const res = await t.request("/api/geo/reverse?lat=50.0627&lng=19.9398", { headers: u.headers });
    expect(await res.json()).toEqual({ address: TEST_ADDRESSES[0] });
    expect((await t.request("/api/geo/reverse?lat=95&lng=19", { headers: u.headers })).status).toBe(400);
  });
});

describe("a place's location", () => {
  test("the wizard stores the pin and the map switch; the place's details return them", async () => {
    t = await setup();
    const owner = await t.signUp({ place: null });
    const { slug } = await create(owner, { name: "Kamienica", location: FLORIANSKA, onMap: true });
    expect(await detailsOf(owner, slug)).toMatchObject({ location: FLORIANSKA, onMap: true });

    const { slug: plain } = await create(owner, { name: "Bez pinezki" });
    expect(await detailsOf(owner, plain)).toMatchObject({ location: null, onMap: false });
  });

  test("an admin moves the pin, hides the place from the map or removes the pin", async () => {
    t = await setup();
    const owner = await t.signUp({ place: null });
    const { slug } = await create(owner, { name: "Kamienica", location: FLORIANSKA, onMap: true });
    const patch = (json: unknown) =>
      t.request(`/api/communities/${slug}`, { method: "PATCH", headers: owner.headers, json });

    expect((await patch({ location: DEMO_LOCATION, onMap: false })).status).toBe(200);
    expect(await detailsOf(owner, slug)).toMatchObject({ location: DEMO_LOCATION, onMap: false });
    expect((await patch({ location: null })).status).toBe(200);
    expect(await detailsOf(owner, slug)).toMatchObject({ location: null, onMap: false, name: "Kamienica" });
  });

  test("a pin must be a point on Earth", async () => {
    t = await setup();
    const owner = await t.signUp({ place: null });
    const res = await t.request("/api/communities", {
      method: "POST",
      headers: owner.headers,
      json: { name: "Nigdzie", location: { lat: 91, lng: 0 } },
    });
    expect(res.status).toBe(400);
  });
});

describe("the map of places", () => {
  test("everyone sees public places without their slug; members see their own places, public or not", async () => {
    t = await setup();
    await t.seed();
    const owner = await t.signUp({ place: null });
    const stranger = await t.signUp({ place: null });
    const { slug: hidden } = await create(owner, { name: "Kamienica", location: FLORIANSKA });
    const { slug: shown } = await create(owner, { name: "Biuro", kind: "company", location: FLORIANSKA, onMap: true });
    await create(owner, { name: "Bez pinezki", onMap: true });

    const demo = { name: "Kraków", kind: "district", address: DEMO_ADDRESS, joinRule: "open", ...DEMO_LOCATION };
    expect(await mapOf(stranger)).toEqual([
      expect.objectContaining({ name: "Biuro", kind: "company", slug: null, ...FLORIANSKA }),
      expect.objectContaining({ ...demo, slug: null }),
    ]);
    expect((await mapOf(owner)).map((p) => [p.name, p.slug])).toEqual([
      ["Biuro", shown],
      ["Kamienica", hidden],
      ["Kraków", null],
    ]);
    const member = await t.signUp();
    expect(await mapOf(member)).toContainEqual(expect.objectContaining({ ...demo, slug: "krakow" }));
  });

  test("local dev seeds public places all over Kraków: replaces the ones nobody belongs to, keeps the rest", async () => {
    t = await setup();
    const owner = await t.signUp({ place: null });
    const { slug } = await create(owner, { name: "Tyniec", location: FLORIANSKA, onMap: true });
    expect(slug).toBe("tyniec"); // the seed has a "tyniec" too
    await t.db.query(surql`CREATE community CONTENT { slug: "stare", name: "Stare", location: ${geoPoint(FLORIANSKA)},
                                                      on_map: true };`);
    await seedDemoMap(t.db);
    await seedDemoMap(t.db);

    const map = await mapOf(await t.signUp({ place: null }));
    expect(map).toHaveLength(DEMO_MAP_PLACES.length);
    expect(map.filter((p) => p.name === "Tyniec")).toEqual([expect.objectContaining(FLORIANSKA)]);
    expect(map.map((p) => p.name)).not.toContain("Stare");
    for (const place of DEMO_MAP_PLACES.filter((p) => p.slug !== "tyniec")) {
      expect(map).toContainEqual(expect.objectContaining({ ...place, slug: null }));
    }
  });
});
