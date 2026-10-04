import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CommunityNavItem, PlaceMember, PlacePlugin } from "@app/shared";
import { TEST_ENV } from "../src/test-env";
import { DEMO_COMMUNITY } from "../src/test-routes";
import { type Ctx, setup } from "./helpers";

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
    ];
    const statuses = async (headers?: Headers) =>
      Promise.all(
        routes.map(async ([method, path, body]) => (await t.request(path, { method, headers, json: body })).status),
      );
    expect(await statuses()).toEqual([401, 401, 401, 401, 401]);
    expect(await statuses(stranger.headers)).toEqual([404, 404, 404, 404, 404]);
    expect(await statuses(member.headers)).toEqual([403, 403, 403, 403, 403]);
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
