import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TEST_ENV } from "../src/test-env";
import { type Ctx, setup, type TestUser } from "./helpers";

/**
 * Membership: a user sees and opens only the places they belong to; creating a place makes its creator an admin.
 * The demo place ("krakow") is joined by the test user factory unless `place: null` is passed.
 */
let t: Ctx;
afterEach(async () => {
  await t.close();
});

type MyPlace = {
  id: string;
  slug: string;
  name: string;
  kind: string;
  role: string;
  isDefault: boolean;
  lastVisitAt: string | null;
};
/** The wizard's answers (design E-NoweMiejsce*); only the name is required. */
type PlaceInput = {
  name: string;
  kind?: string;
  address?: string;
  description?: string;
  joinRule?: string;
  makeDefault?: boolean;
  plugins?: string[];
};
/** Six characters without look-alikes (no 0/O, 1/I). */
const INVITE_CODE = /^[A-HJ-NP-Z2-9]{6}$/;

const myPlaces = async (u: TestUser) =>
  (await (await t.request("/api/communities", { headers: u.headers })).json()) as MyPlace[];
const create = (u: TestUser, place: string | PlaceInput) =>
  t.request("/api/communities", {
    method: "POST",
    headers: u.headers,
    json: typeof place === "string" ? { name: place } : place,
  });
const placeOf = async (u: TestUser, slug: string) =>
  (await (await t.request(`/api/communities/${slug}`, { headers: u.headers })).json()) as Record<string, unknown>;

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
    expect(await res.json()).toEqual({
      id: expect.any(String),
      slug: "osiedle-sloneczne",
      name: "Osiedle Słoneczne",
      inviteCode: expect.stringMatching(INVITE_CODE),
    });

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

  test("the wizard's answers are stored; the admin sees them with the invite code", async () => {
    t = await setup();
    const u = await t.signUp({ place: null });
    const res = await create(u, {
      name: "Kamienica Lipowa 12",
      kind: "building",
      address: "ul. Lipowa 12, Kraków",
      description: "Wspólnota mieszkaniowa: ogłoszenia, awarie, zebrania.",
      joinRule: "open",
    });
    const { inviteCode } = (await res.json()) as { inviteCode: string };
    expect(await placeOf(u, "kamienica-lipowa-12")).toEqual({
      id: expect.any(String),
      slug: "kamienica-lipowa-12",
      name: "Kamienica Lipowa 12",
      role: "admin",
      kind: "building",
      address: "ul. Lipowa 12, Kraków",
      description: "Wspólnota mieszkaniowa: ogłoszenia, awarie, zebrania.",
      joinRule: "open",
      location: null,
      onMap: false,
      inviteCode,
    });
    expect((await myPlaces(u))[0]).toMatchObject({ slug: "kamienica-lipowa-12", kind: "building" });
  });

  test("without answers a place is of kind 'other' and joined with the admin's approval", async () => {
    t = await setup();
    const u = await t.signUp({ place: null });
    await create(u, "Osiedle");
    expect(await placeOf(u, "osiedle")).toMatchObject({
      kind: "other",
      address: "",
      description: "",
      joinRule: "approval",
    });
  });

  test("makeDefault moves the default to the new place", async () => {
    t = await setup();
    const u = await t.signUp({ place: null });
    await create(u, "Osiedle");
    await create(u, { name: "Biuro", makeDefault: true });
    const defaults = (await myPlaces(u)).filter((p) => p.isDefault).map((p) => p.slug);
    expect(defaults).toEqual(["biuro"]);
  });

  test("every place gets its own invite code; members do not see it", async () => {
    t = await setup();
    await t.seed();
    const u = await t.signUp({ place: null });
    const codes = await Promise.all(
      ["Osiedle", "Biuro"].map(
        async (name) => ((await (await create(u, name)).json()) as { inviteCode: string }).inviteCode,
      ),
    );
    expect(new Set(codes).size).toBe(2);
    expect(await placeOf(await t.signUp(), "krakow")).toMatchObject({ role: "user", inviteCode: null });
  });

  test("the chosen built-in plugins are enabled in order; an unknown or uploaded plugin is rejected", async () => {
    t = await setup();
    const u = await t.signUp({ place: null });
    const res = await create(u, { name: "Kamienica Lipowa 12", plugins: ["discussions", "issues"] });
    expect(res.status).toBe(201);
    const { slug } = (await res.json()) as { slug: string };
    const nav = async (s: string) =>
      (
        (await (await t.request(`/api/communities/${s}/nav`, { headers: u.headers })).json()) as { pluginId: string }[]
      ).map((n) => n.pluginId);
    expect(await nav(slug)).toEqual(["discussions", "issues"]);

    const bare = (await (await create(u, "Bez funkcji")).json()) as { slug: string };
    expect(await nav(bare.slug)).toEqual([]);

    const notes = readFileSync(join(import.meta.dir, "fixtures/notes-plugin.ts"), "utf8");
    const platform = { authorization: `Bearer ${TEST_ENV.PLUGIN_ADMIN_TOKEN}` };
    expect(
      (await t.request("/api/admin/plugins", { method: "POST", headers: platform, json: { source: notes } })).status,
    ).toBe(201);
    for (const plugins of [["nie-ma"], ["issues", "notes"]]) {
      expect((await create(u, { name: "Odrzucone", plugins })).status, plugins.join()).toBe(400);
    }
    expect(await myPlaces(u)).toHaveLength(2); // the rejected place was not created
  });

  test("an unknown kind or join rule is rejected", async () => {
    t = await setup();
    const u = await t.signUp({ place: null });
    expect((await create(u, { name: "Osiedle", kind: "castle" })).status).toBe(400);
    expect((await create(u, { name: "Osiedle", joinRule: "anyone" })).status).toBe(400);
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

describe("invite codes", () => {
  test("the place behind an invite code is previewed to anyone signed in; an unknown code is 404", async () => {
    t = await setup();
    await t.seed();
    const stranger = await t.signUp({ place: null });
    const preview = await t.request("/api/communities/invite/krk-mst", { headers: stranger.headers });
    expect(preview.status).toBe(200);
    expect(await preview.json()).toMatchObject({ name: "Kraków", joinRule: "open" });
    const unknown = await t.request("/api/communities/invite/ZZZZZZ", { headers: stranger.headers });
    expect(unknown.status).toBe(404);
  });

  test("joining an open place makes its member, the last visited and default place when asked", async () => {
    t = await setup();
    await t.seed();
    const u = await t.signUp({ place: null });
    const joined = await t.request("/api/communities/join", {
      method: "POST",
      headers: u.headers,
      json: { code: "KRK-MST", makeDefault: true },
    });
    expect(joined.status).toBe(200);
    expect(await joined.json()).toMatchObject({ slug: "krakow", name: "Kraków" });
    const places = await myPlaces(u);
    expect(places).toEqual([expect.objectContaining({ slug: "krakow", role: "user", isDefault: true })]);
    expect(places[0]?.lastVisitAt).not.toBeNull();
  });

  test("a place that admits members after approval cannot be joined by its code", async () => {
    t = await setup();
    const admin = await t.signUp({ place: null });
    const closed = (await (await create(admin, { name: "Zamknięte", joinRule: "approval" })).json()) as {
      inviteCode: string;
    };
    const stranger = await t.signUp({ place: null });
    const refused = await t.request("/api/communities/join", {
      method: "POST",
      headers: stranger.headers,
      json: { code: closed.inviteCode },
    });
    expect(refused.status).toBe(403);
    expect(await myPlaces(stranger)).toEqual([]);
  });

  test("an unknown or malformed code cannot be joined", async () => {
    t = await setup();
    const u = await t.signUp({ place: null });
    const unknown = await t.request("/api/communities/join", {
      method: "POST",
      headers: u.headers,
      json: { code: "ZZZZZZ" },
    });
    expect(unknown.status).toBe(404);
    const malformed = await t.request("/api/communities/join", {
      method: "POST",
      headers: u.headers,
      json: { code: "0OIL1!" },
    });
    expect(malformed.status).toBe(404);
  });
});
