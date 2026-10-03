import { afterEach, describe, expect, test } from "bun:test";
import { type Ctx, setup, type TestUser } from "./helpers";

/**
 * Membership: a user sees and opens only the places they belong to; creating a place makes its creator an admin.
 * The demo place ("krakow") is joined by the test user factory unless `place: null` is passed.
 */
let t: Ctx;
afterEach(async () => {
  await t.close();
});

type MyPlace = { id: string; slug: string; name: string; role: string; isDefault: boolean; lastVisitAt: string | null };

const myPlaces = async (u: TestUser) =>
  (await (await t.request("/api/communities", { headers: u.headers })).json()) as MyPlace[];
const create = (u: TestUser, name: string) =>
  t.request("/api/communities", { method: "POST", headers: u.headers, json: { name } });

describe("membership gate", () => {
  test("a non-member sees no place and gets 404 on every route of it", async () => {
    t = await setup();
    await t.seed();
    const stranger = await t.signUp({ place: null });
    expect(await myPlaces(stranger)).toEqual([]);

    const base = "/api/communities/krakow";
    for (const path of [base, `${base}/nav`, `${base}/widgets`, `${base}/plugins/issues/views/list`]) {
      expect((await t.request(path, { headers: stranger.headers })).status, path).toBe(404);
    }
    expect((await t.request(`${base}/visit`, { method: "POST", headers: stranger.headers })).status).toBe(404);
    expect((await t.request(`${base}/default`, { method: "PUT", headers: stranger.headers })).status).toBe(404);
  });

  test("the list holds only the user's places, with their role", async () => {
    t = await setup();
    await t.seed();
    const member = await t.signUp();
    const names = (await myPlaces(member)).map((p) => `${p.slug}:${p.role}`);
    expect(names).toEqual(["krakow:user"]);
    expect(await myPlaces(await t.signUp({ place: null }))).toEqual([]);
  });
});

describe("creating a place", () => {
  test("slug from the name; the creator is an admin; the first place becomes the default", async () => {
    t = await setup();
    const u = await t.signUp({ place: null });
    const res = await create(u, "Osiedle Słoneczne");
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: expect.any(String), slug: "osiedle-sloneczne", name: "Osiedle Słoneczne" });

    const [place] = await myPlaces(u);
    expect(place).toMatchObject({ slug: "osiedle-sloneczne", role: "admin", isDefault: true, lastVisitAt: null });
  });

  test("a taken slug gets a numeric suffix; a later place is not the default", async () => {
    t = await setup();
    const u = await t.signUp({ place: null });
    await create(u, "Osiedle");
    const second = await create(u, "Osiedle");
    expect(((await second.json()) as { slug: string }).slug).toBe("osiedle-2");
    const places = (await myPlaces(u)).sort((x, y) => x.slug.localeCompare(y.slug));
    expect(places.map((p) => [p.slug, p.isDefault])).toEqual([
      ["osiedle", true],
      ["osiedle-2", false],
    ]);
  });

  test("an empty name is rejected", async () => {
    t = await setup();
    const u = await t.signUp({ place: null });
    expect((await create(u, "   ")).status).toBe(400);
  });
});

describe("last visited and default place", () => {
  test("opening a place remembers it as the last visited", async () => {
    t = await setup();
    await t.seed();
    const u = await t.signUp();
    expect((await myPlaces(u))[0]?.lastVisitAt).toBeNull();
    expect((await t.request("/api/communities/krakow/visit", { method: "POST", headers: u.headers })).status).toBe(200);
    expect((await myPlaces(u))[0]?.lastVisitAt).toEqual(expect.any(String));
  });

  test("setting the default clears the previous default", async () => {
    t = await setup();
    const u = await t.signUp({ place: null });
    await create(u, "Osiedle");
    await create(u, "Biuro");
    const res = await t.request("/api/communities/biuro/default", { method: "PUT", headers: u.headers });
    expect(res.status).toBe(200);
    const defaults = (await myPlaces(u)).filter((p) => p.isDefault).map((p) => p.slug);
    expect(defaults).toEqual(["biuro"]);
  });
});
