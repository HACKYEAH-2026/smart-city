import { afterEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CommunityNavItem, PlaceMember, PlacePlugin } from "@app/shared";
import { TEST_ENV } from "../src/test-env";
import { DEMO_COMMUNITY } from "../src/test-routes";
import { type Ctx, setup } from "./helpers";

// Uploading a plugin type-checks it (~1 s on an idle machine, more when verify runs builds in parallel).
setDefaultTimeout(30_000);

/**
 * Managing a place (routes/placeAdmin.ts): settings, members, built-in plugins on and off, deleting. Only the
 * place's admins: no session 401, a non-member 404 (the place is not revealed), a member 403.
 */
let t: Ctx;
afterEach(async () => {
  await t.close();
});

const base = `/api/communities/${DEMO_COMMUNITY.slug}`;
type Headers = Record<string, string>;
const start = async () => {
  t = await setup();
  return (await t.seed()).admin.headers;
};
const json = async <T>(res: Response) => (await res.json()) as T;
const nav = async (headers: Headers) =>
  (await json<CommunityNavItem[]>(await t.request(`${base}/nav`, { headers }))).map((n) => n.pluginId);

describe("access", () => {
  test("no session 401; a non-member 404; a member who is not an admin 403", async () => {
    const admin = await start();
    const member = await t.signUp();
    const stranger = await t.signUp({ place: null });
    const routes: [string, string, unknown?][] = [
      ["PATCH", base, { name: "Nowa nazwa" }],
      ["DELETE", base],
      ["GET", `${base}/members`],
      ["GET", `${base}/plugins`],
      ["PUT", `${base}/plugins/discussions`, { enabled: false }],
      ["PATCH", `${base}/members/${member.id}`, { role: "admin" }],
      ["DELETE", `${base}/members/${member.id}`],
    ];
    const statuses = async (headers?: Headers) =>
      Promise.all(
        routes.map(async ([method, path, body]) => (await t.request(path, { method, headers, json: body })).status),
      );
    expect(await statuses()).toEqual(routes.map(() => 401));
    expect(await statuses(stranger.headers)).toEqual(routes.map(() => 404));
    expect(await statuses(member.headers)).toEqual(routes.map(() => 403));
    expect((await t.request(base, { headers: admin })).status).toBe(200);
  });
});

describe("settings", () => {
  test("changes only what is sent; the slug stays; invalid values 400", async () => {
    const admin = await start();
    const patch = (body: unknown) => t.request(base, { method: "PATCH", headers: admin, json: body });
    expect((await patch({ name: "Kraków Centrum", joinRule: "open", kind: "district" })).status).toBe(200);
    expect((await patch({ description: "Miasto królów" })).status).toBe(200);
    const place = await json<Record<string, unknown>>(await t.request(base, { headers: admin }));
    expect(place).toMatchObject({
      slug: DEMO_COMMUNITY.slug,
      name: "Kraków Centrum",
      joinRule: "open",
      kind: "district",
      description: "Miasto królów",
    });
    expect((await patch({ name: "   " })).status).toBe(400);
    expect((await patch({ joinRule: "everyone" })).status).toBe(400);
  });
});

describe("members", () => {
  test("everyone in the place with their role, admins first, then in Polish alphabetical order", async () => {
    const admin = await start();
    await t.signUp({ name: "Zofia Zając", email: "zofia@example.test" });
    await t.signUp({ name: "Łukasz Lis", email: "lukasz@example.test" });
    await t.signUp({ name: "Anna Nowak", email: "anna@example.test" });
    await t.signUp({ place: null, email: "outside@example.test" });
    const members = await json<PlaceMember[]>(await t.request(`${base}/members`, { headers: admin }));
    expect(members.map(({ role }) => role)).toEqual(["admin", "user", "user", "user"]);
    expect(members.slice(1).map((m) => m.name)).toEqual(["Anna Nowak", "Łukasz Lis", "Zofia Zając"]);
    expect(members[1]).toMatchObject({ name: "Anna Nowak", email: "anna@example.test", role: "user" });
    expect(members.map((m) => m.email)).not.toContain("outside@example.test");
    expect(members.map(({ joinedAt }) => typeof joinedAt)).toEqual(["string", "string", "string", "string"]);
    expect(members.map(({ you }) => you)).toEqual([true, false, false, false]);
  });

  test("members after the admins in order of their names", async () => {
    const admin = await start();
    for (const name of ["Zenon", "Adam", "Marta", "Bartek", "Ola", "Celina"]) await t.signUp({ name });
    const members = await json<PlaceMember[]>(await t.request(`${base}/members`, { headers: admin }));
    expect(members.slice(1).map(({ name }) => name)).toEqual(["Adam", "Bartek", "Celina", "Marta", "Ola", "Zenon"]);
  });

  test("granting and revoking admin rights; the role decides what the member may manage", async () => {
    const admin = await start();
    const anna = await t.signUp();
    const role = (role: string) =>
      t.request(`${base}/members/${anna.id}`, { method: "PATCH", headers: admin, json: { role } });
    const annaSeesMembers = async () => (await t.request(`${base}/members`, { headers: anna.headers })).status;
    expect((await role("admin")).status).toBe(200);
    expect(await annaSeesMembers()).toBe(200);
    expect((await role("user")).status).toBe(200);
    expect(await annaSeesMembers()).toBe(403);
    expect((await role("owner")).status).toBe(400);
  });

  test("removing a member: the place is gone for them", async () => {
    const admin = await start();
    const anna = await t.signUp();
    expect((await t.request(`${base}/members/${anna.id}`, { method: "DELETE", headers: admin })).status).toBe(200);
    expect((await t.request(base, { headers: anna.headers })).status).toBe(404);
    const members = await json<PlaceMember[]>(await t.request(`${base}/members`, { headers: admin }));
    expect(members.map(({ you }) => you)).toEqual([true]);
  });

  test("never the admin's own membership (409); someone who is not a member 404", async () => {
    const admin = await start();
    const outsider = await t.signUp({ place: null });
    const [self] = await json<PlaceMember[]>(await t.request(`${base}/members`, { headers: admin }));
    const call = (method: string, userId: string, json?: unknown) =>
      t.request(`${base}/members/${userId}`, { method, headers: admin, json });
    const calls: [string, unknown?][] = [["PATCH", { role: "user" }], ["DELETE"]];
    for (const [method, body] of calls) {
      const own = await call(method, self?.id ?? "", body);
      expect(own.status).toBe(409);
      expect(await json<{ error: string }>(own)).toMatchObject({ error: "own_membership" });
      expect((await call(method, outsider.id, body)).status).toBe(404);
      expect((await call(method, "nobody", body)).status).toBe(404);
    }
  });

  test("an admin of one place never reaches the members of another", async () => {
    const admin = await start();
    const other = await t.signUp({ place: null });
    const theirs = await json<{ slug: string }>(
      await t.request("/api/communities", {
        method: "POST",
        headers: other.headers,
        json: { name: "Osiedle Zielone" },
      }),
    );
    const calls: [string, unknown?][] = [["PATCH", { role: "user" }], ["DELETE"]];
    for (const [method, body] of calls) {
      const res = await t.request(`${base}/members/${other.id}`, { method, headers: admin, json: body });
      expect(res.status).toBe(404);
    }
    const members = await json<PlaceMember[]>(
      await t.request(`/api/communities/${theirs.slug}/members`, { headers: other.headers }),
    );
    expect(members).toMatchObject([{ id: other.id, role: "admin" }]);
  });
});

describe("plugins", () => {
  test("built-in plugins with their state; off and on again keeps the data; others 404", async () => {
    const admin = await start();
    const member = await t.signUp();
    const list = async () => json<PlacePlugin[]>(await t.request(`${base}/plugins`, { headers: admin }));
    // `widgets`: the dashboard widgets each plugin declares.
    expect((await list()).map(({ id, enabled, widgets }) => ({ id, enabled, widgets }))).toEqual([
      { id: "issues", enabled: true, widgets: 1 },
      { id: "announcements", enabled: true, widgets: 1 },
      { id: "discussions", enabled: true, widgets: 1 },
    ]);
    // The plugin's page: its admin view and the sizes its widget may have.
    expect((await list()).find((p) => p.id === "issues")).toMatchObject({
      adminView: "admin",
      sizes: [
        { w: 3, h: 2 },
        { w: 3, h: 3 },
      ],
    });
    expect((await list()).find((p) => p.id === "announcements")).toMatchObject({ adminView: null });
    const put = (pluginId: string, enabled: boolean) =>
      t.request(`${base}/plugins/${pluginId}`, { method: "PUT", headers: admin, json: { enabled } });

    await t.request(`${base}/plugins/announcements/tools/publish`, {
      method: "POST",
      headers: admin,
      json: { args: { title: "Zebranie" } },
    });
    expect((await put("announcements", false)).status).toBe(200);
    expect((await list()).find((p) => p.id === "announcements")?.enabled).toBe(false);
    expect(await nav(member.headers)).toEqual(["issues", "discussions"]);
    expect((await t.request(`${base}/plugins/announcements/views/list`, { headers: member.headers })).status).toBe(404);

    expect((await put("announcements", true)).status).toBe(200);
    expect(await nav(member.headers)).toContain("announcements");
    const view = await t.request(`${base}/plugins/announcements/views/list`, { headers: member.headers });
    expect(JSON.stringify(await view.json())).toContain("Zebranie");

    const notes = readFileSync(join(import.meta.dir, "fixtures/notes-plugin.ts"), "utf8");
    const platform = { authorization: `Bearer ${TEST_ENV.PLUGIN_ADMIN_TOKEN}` };
    await t.request("/api/admin/plugins", { method: "POST", headers: platform, json: { source: notes } });
    expect((await put("notes", true)).status).toBe(404);
    expect((await put("nie-ma", true)).status).toBe(404);
    expect((await t.request(`${base}/plugins/issues`, { method: "PUT", headers: admin, json: {} })).status).toBe(400);
  });
});

describe("deleting", () => {
  test("the place and everyone's membership go; the slug is free again", async () => {
    const admin = await start();
    const member = await t.signUp();
    expect((await t.request(base, { method: "DELETE", headers: admin })).status).toBe(200);
    expect((await t.request(base, { headers: admin })).status).toBe(404);
    expect(await json<unknown[]>(await t.request("/api/communities", { headers: member.headers }))).toEqual([]);
    const created = await t.request("/api/communities", {
      method: "POST",
      headers: admin,
      json: { name: DEMO_COMMUNITY.name },
    });
    expect(await json<{ slug: string }>(created)).toMatchObject({ slug: DEMO_COMMUNITY.slug });
  });
});
