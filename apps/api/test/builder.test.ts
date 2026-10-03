import { afterEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import type { PluginCheck } from "@app/plugin-sdk";
import type { AiPlugin, CommunityNavItem, PlacePlugin, PluginCatalogItem } from "@app/shared";
import { type RecordId, surql } from "surrealdb";
import { first } from "../src/db";
import { REQUESTS_PER_DAY } from "../src/plugins/builder";
import type { AuthorTask, PluginAuthor } from "../src/services/ai/author/types";
import { TestPluginAuthor } from "../src/test-author";
import { DEMO_COMMUNITY } from "../src/test-routes";
import { type Ctx, setup } from "./helpers";

/**
 * The plugin builder (routes/builder.ts): a place's admin describes a plugin, the AI writes it in the background and
 * checks it like an upload; the plugin is a draft until it is published into the place, and every later request of
 * the admin is a new version, also after publishing. Only the place's admins; tests use a fake author
 * (src/test-author.ts), never a model.
 */
// Every version type-checks a whole plugin (~1 s on an idle machine, more when verify runs builds in parallel).
setDefaultTimeout(30_000);

let t: Ctx;
afterEach(async () => {
  await t.close();
});

const base = `/api/communities/${DEMO_COMMUNITY.slug}`;
type Headers = Record<string, string>;
const json = async <T>(res: Response) => (await res.json()) as T;

const start = async (author: PluginAuthor | null = new TestPluginAuthor()) => {
  t = await setup({}, author ? { author } : {});
  return (await t.seed()).admin.headers;
};
const create = async (headers: Headers, request: string) => {
  const res = await t.request(`${base}/plugins`, {
    method: "POST",
    headers,
    json: { request },
  });
  expect(res.status).toBe(201);
  return json<AiPlugin>(res);
};
/** The plugin once no version is being written. */
const settled = async (headers: Headers, id: string) => {
  await t.builder.idle();
  return json<AiPlugin>(await t.request(`${base}/plugins/${id}`, { headers }));
};
const change = (headers: Headers, id: string, request: string) =>
  t.request(`${base}/plugins/${id}/versions`, {
    method: "POST",
    headers,
    json: { request },
  });
const publish = (headers: Headers, id: string) =>
  t.request(`${base}/plugins/${id}/publish`, { method: "POST", headers });
/** An author that waits for `release()` before writing: the version stays "working" until then. */
const gated = () => {
  const gate = Promise.withResolvers<void>();
  const author: PluginAuthor = {
    write: async (task, check) => {
      await gate.promise;
      return new TestPluginAuthor().write(task, check);
    },
  };
  return { author, release: () => gate.resolve() };
};
const nav = async (headers: Headers) => json<CommunityNavItem[]>(await t.request(`${base}/nav`, { headers }));
const placePlugins = async (headers: Headers, path = base) =>
  json<PlacePlugin[]>(await t.request(`${path}/plugins`, { headers }));

describe("access", () => {
  test("no session 401; a non-member 404; a member who is not an admin 403", async () => {
    const admin = await start();
    const plugin = await create(admin, "Tablica „Zguby i znalezione” dla użytkowników");
    const member = await t.signUp();
    const stranger = await t.signUp({ place: null });
    const routes: [string, string, unknown?][] = [
      ["POST", `${base}/plugins`, { request: "Plugin do zgłaszania usterek" }],
      ["GET", `${base}/plugins/${plugin.id}`],
      ["POST", `${base}/plugins/${plugin.id}/versions`, { request: "Dodaj pole na zdjęcie" }],
      ["POST", `${base}/plugins/${plugin.id}/publish`],
    ];
    const statuses = async (headers?: Headers) =>
      Promise.all(
        routes.map(async ([method, path, body]) => (await t.request(path, { method, headers, json: body })).status),
      );
    expect(await statuses()).toEqual([401, 401, 401, 401]);
    expect(await statuses(stranger.headers)).toEqual([404, 404, 404, 404]);
    expect(await statuses(member.headers)).toEqual([403, 403, 403, 403]);
    await t.builder.idle();
  });

  test("without a model on the server: 503 ai_unavailable; a too short request 400; built-ins have no versions", async () => {
    const admin = await start(null);
    const res = await t.request(`${base}/plugins`, {
      method: "POST",
      headers: admin,
      json: { request: "Plugin X Y Z!" },
    });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "ai_unavailable" });
    const short = await t.request(`${base}/plugins`, {
      method: "POST",
      headers: admin,
      json: { request: "krótko" },
    });
    expect(short.status).toBe(400);
    expect((await t.request(`${base}/plugins/issues`, { headers: admin })).status).toBe(404);
  });

  test(`a place gets ${REQUESTS_PER_DAY} requests to the AI a day (429 after that)`, async () => {
    const admin = await start();
    const { id } = await create(admin, "Tablica wpisów dla sąsiadów");
    await t.builder.idle();
    const version = await first<{ plugin: RecordId }>(t.db, surql`SELECT plugin FROM plugin_version LIMIT 1;`);
    const earlier = Array.from({ length: REQUESTS_PER_DAY - 1 }, (_, i) => ({
      plugin: version?.plugin,
      n: i + 2,
      request: "Wcześniejsza prośba",
      status: "failed",
      error: "internal",
    }));
    await t.db.query(surql`INSERT INTO plugin_version ${earlier};`);
    expect((await change(admin, id, "Jeszcze jedna prośba")).status).toBe(429);
    const another = await t.request(`${base}/plugins`, {
      method: "POST",
      headers: admin,
      json: { request: "Nowy plugin dla sąsiadów" },
    });
    expect(another.status).toBe(429);
  });
});

describe("writing", () => {
  test("a description makes a draft whose version passed every check; its source is stored", async () => {
    const writing = gated();
    const admin = await start(writing.author);
    const created = await create(admin, "Tablica „Zguby i znalezione” dla użytkowników");
    expect(created).toMatchObject({
      status: "working",
      published: null,
      versions: [{ n: 1, status: "working" }],
    });
    expect(created.id).toMatch(/^ai-[a-z0-9]{10}$/);
    expect((await placePlugins(admin)).find((p) => p.id === created.id)).toMatchObject({
      name: "Tablica „Zguby i znalezione” dla użytkowników", // the request, until a version is ready
      draft: true,
      working: true,
    });
    writing.release();

    const plugin = await settled(admin, created.id);
    const [version] = plugin.versions;
    expect(plugin.status).toBe("ready");
    expect(version).toMatchObject({
      n: 1,
      request: "Tablica „Zguby i znalezione” dla użytkowników",
      status: "ready",
      attempts: 1,
      error: null,
      summary: expect.stringContaining("Zguby i znalezione"),
      outline: {
        name: "Zguby i znalezione",
        icon: "📌",
        views: ["main"],
        tools: ["add"],
        tables: ["notes"],
      },
    });
    expect(version?.source).toContain(`id: "${created.id}"`);
    expect((await placePlugins(admin)).find((p) => p.id === created.id)).toEqual({
      id: created.id,
      name: "Zguby i znalezione",
      icon: "📌",
      description: "Krótkie wpisy członków miejsca.",
      enabled: false,
      madeByAi: true,
      draft: true,
      working: false,
    });
    // A draft: residents do not see it, and it cannot be switched on without publishing.
    expect((await nav(admin)).map((n) => n.pluginId)).not.toContain(created.id);
    const on = await t.request(`${base}/plugins/${created.id}`, {
      method: "PUT",
      headers: admin,
      json: { enabled: true },
    });
    expect(on.status).toBe(404);
  });

  test("the author fixes what a check reports (every check counts); one that never passes fails the version", async () => {
    const admin = await start(new TestPluginAuthor({ firstTry: "typo" }));
    const fixed = await settled(admin, (await create(admin, "Tablica wpisów dla sąsiadów")).id);
    expect(fixed.versions[0]).toMatchObject({ status: "ready", attempts: 2 });
    await t.close();

    const failing = await start(new TestPluginAuthor({ firstTry: "never" }));
    const failed = await settled(failing, (await create(failing, "Tablica wpisów dla sąsiadów")).id);
    expect(failed).toMatchObject({ status: "failed" });
    expect(failed.versions[0]).toMatchObject({
      status: "failed",
      error: "check_failed",
      attempts: 1,
      source: null,
    });
  });

  test("a plugin under another id than the one asked for never becomes ready", async () => {
    const thief: PluginAuthor = {
      write: async (task: AuthorTask, check: (source: string) => Promise<PluginCheck>) => {
        const honest = await new TestPluginAuthor().write(task, check);
        return {
          ...honest,
          source: honest.source.replace(`id: "${task.pluginId}"`, 'id: "notes"'),
        };
      },
    };
    const admin = await start(thief);
    const plugin = await settled(admin, (await create(admin, "Tablica wpisów dla sąsiadów")).id);
    expect(plugin.versions[0]).toMatchObject({
      status: "failed",
      error: "check_failed",
    });
    expect(t.plugins.get("notes")).toBeUndefined();
  });
});

describe("publishing and changing", () => {
  test("publish installs the draft in the place; a change is a new version; publishing it replaces the plugin", async () => {
    const writing = gated();
    const admin = await start(writing.author);
    const { id } = await create(admin, "Tablica „Zguby i znalezione” dla użytkowników");
    expect((await publish(admin, id)).status).toBe(409); // still being written
    expect((await change(admin, id, "I jeszcze dodaj zdjęcia")).status).toBe(409); // one version at a time
    writing.release();
    await t.builder.idle();

    const published = await publish(admin, id);
    expect(published.status).toBe(200);
    expect(await json<AiPlugin>(published)).toMatchObject({ published: 1 });
    expect(await nav(admin)).toContainEqual(expect.objectContaining({ pluginId: id, label: "Zguby i znalezione" }));
    const add = await t.request(`${base}/plugins/${id}/tools/add`, {
      method: "POST",
      headers: admin,
      json: { args: { title: "Klucze na ławce przy Plantach" } },
    });
    expect(add.status).toBe(200);

    expect((await change(admin, id, "Zmień nazwę na „Rzeczy znalezione”, proszę")).status).toBe(201);
    const plugin = await settled(admin, id);
    expect(plugin.versions.map((v) => [v.n, v.status, v.outline?.name])).toEqual([
      [1, "ready", "Zguby i znalezione"],
      [2, "ready", "Rzeczy znalezione"],
    ]);
    expect(plugin.versions[1]?.source).toContain('version: "1.1.0"');
    expect(plugin.published).toBe(1); // the change alone does nothing in the place
    expect((await placePlugins(admin)).find((p) => p.id === id)).toMatchObject({
      name: "Zguby i znalezione", // as it runs
      draft: false,
      enabled: true,
    });

    expect((await publish(admin, id)).status).toBe(200);
    expect(await nav(admin)).toContainEqual(expect.objectContaining({ pluginId: id, label: "Rzeczy znalezione" }));
    const view = await t.request(`${base}/plugins/${id}/views/main`, {
      headers: admin,
    });
    expect(JSON.stringify(await view.json())).toContain("Klucze na ławce przy Plantach"); // the data stayed
  });

  test("a published AI plugin is switchable like a built-in one; other places cannot see or switch it", async () => {
    const admin = await start();
    const { id } = await create(admin, "Tablica „Zguby i znalezione” dla użytkowników");
    await t.builder.idle();
    await publish(admin, id);

    const plugins = await placePlugins(admin);
    expect(plugins.find((p) => p.id === id)).toMatchObject({
      enabled: true,
      madeByAi: true,
      draft: false,
    });
    expect(plugins.find((p) => p.id === "issues")).toMatchObject({
      madeByAi: false,
      draft: false,
    });
    const off = await t.request(`${base}/plugins/${id}`, {
      method: "PUT",
      headers: admin,
      json: { enabled: false },
    });
    expect(off.status).toBe(200);
    expect((await nav(admin)).map((n) => n.pluginId)).not.toContain(id);

    const other = await t.signUp({ place: null });
    const place = await json<{ slug: string }>(
      await t.request("/api/communities", {
        method: "POST",
        headers: other.headers,
        json: { name: "Osiedle Zielone" },
      }),
    );
    const theirs = `/api/communities/${place.slug}`;
    const switchIt = await t.request(`${theirs}/plugins/${id}`, {
      method: "PUT",
      headers: other.headers,
      json: { enabled: true },
    });
    expect(switchIt.status).toBe(404);
    expect((await placePlugins(other.headers, theirs)).map((p) => p.id)).not.toContain(id);
    const catalog = await json<PluginCatalogItem[]>(await t.request("/api/plugins", { headers: other.headers }));
    expect(catalog.map((p) => p.id)).not.toContain(id);
    expect((await t.request(`${theirs}/plugins/${id}`, { headers: other.headers })).status).toBe(404);
    expect((await change(other.headers, id, "Przejmij ten plugin, proszę")).status).toBe(404);
  });
});
