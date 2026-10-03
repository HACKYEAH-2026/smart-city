import { afterEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import type { PluginCheck } from "@app/plugin-sdk";
import type { CommunityNavItem, PlacePlugin, PluginCatalogItem, PluginDraft, PluginDraftItem } from "@app/shared";
import type { AuthorTask, PluginAuthor } from "../src/services/ai/author";
import { TestPluginAuthor } from "../src/test-author";
import { DEMO_COMMUNITY } from "../src/test-routes";
import { type Ctx, setup } from "./helpers";

/**
 * The plugin builder (routes/drafts.ts): a place's admin describes a feature, the AI writes it as a plugin in the
 * background and checks it like an upload, the admin gives feedback (revisions) and publishes it into the place.
 * Only the place's admins; tests use a fake author (src/test-author.ts), never a model.
 */
// Every revision type-checks a whole plugin (~1 s on an idle machine, more when verify runs builds in parallel).
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
  const res = await t.request(`${base}/drafts`, { method: "POST", headers, json: { request } });
  expect(res.status).toBe(201);
  return json<PluginDraft>(res);
};
/** The draft once no revision is being written. */
const settled = async (headers: Headers, id: string) => {
  await t.drafts.idle();
  return json<PluginDraft>(await t.request(`${base}/drafts/${id}`, { headers }));
};
/** An author that waits for `release()` before writing: the revision stays "working" until then. */
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

describe("access", () => {
  test("no session 401; a non-member 404; a member who is not an admin 403", async () => {
    const admin = await start();
    const draft = await create(admin, "Tablica „Zguby i znalezione” dla mieszkańców");
    const member = await t.signUp();
    const stranger = await t.signUp({ place: null });
    const routes: [string, string, unknown?][] = [
      ["GET", `${base}/drafts`],
      ["POST", `${base}/drafts`, { request: "Plugin do zgłaszania usterek" }],
      ["GET", `${base}/drafts/${draft.id}`],
      ["POST", `${base}/drafts/${draft.id}/revisions`, { request: "Dodaj pole na zdjęcie" }],
      ["POST", `${base}/drafts/${draft.id}/publish`],
    ];
    const statuses = async (headers?: Headers) =>
      Promise.all(
        routes.map(async ([method, path, body]) => (await t.request(path, { method, headers, json: body })).status),
      );
    expect(await statuses()).toEqual([401, 401, 401, 401, 401]);
    expect(await statuses(stranger.headers)).toEqual([404, 404, 404, 404, 404]);
    expect(await statuses(member.headers)).toEqual([403, 403, 403, 403, 403]);
    await t.drafts.idle();
  });

  test("without a model on the server: 503 ai_unavailable; a too short request 400", async () => {
    const admin = await start(null);
    const res = await t.request(`${base}/drafts`, {
      method: "POST",
      headers: admin,
      json: { request: "Plugin X Y Z!" },
    });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "ai_unavailable" });
    const short = await t.request(`${base}/drafts`, { method: "POST", headers: admin, json: { request: "krótko" } });
    expect(short.status).toBe(400);
  });
});

describe("writing", () => {
  test("a description becomes a ready revision: the plugin passed every check; its source is stored", async () => {
    const admin = await start();
    const created = await create(admin, "Tablica „Zguby i znalezione” dla mieszkańców");
    expect(created).toMatchObject({ status: "working", published: null, revisions: [{ n: 1, status: "working" }] });
    expect(created.pluginId).toMatch(/^ai-[a-z0-9]{10}$/);

    const draft = await settled(admin, created.id);
    const [revision] = draft.revisions;
    expect(draft.status).toBe("ready");
    expect(revision).toMatchObject({
      n: 1,
      request: "Tablica „Zguby i znalezione” dla mieszkańców",
      status: "ready",
      attempts: 1,
      error: null,
      summary: expect.stringContaining("Zguby i znalezione"),
      plugin: { name: "Zguby i znalezione", icon: "📌", views: ["main"], tools: ["add"], tables: ["notes"] },
    });
    expect(revision?.source).toContain(`id: "${created.pluginId}"`);
    const list = await json<PluginDraftItem[]>(await t.request(`${base}/drafts`, { headers: admin }));
    expect(list).toEqual([
      {
        id: created.id,
        pluginId: created.pluginId,
        title: "Zguby i znalezione",
        icon: "📌",
        status: "ready",
        published: null,
        revisions: 1,
      },
    ]);
    // Not published: residents do not see it, no other place can install it.
    expect((await nav(admin)).map((n) => n.pluginId)).not.toContain(created.pluginId);
  });

  test("the author fixes what a check reports (every check counts); one that never passes fails the revision", async () => {
    const admin = await start(new TestPluginAuthor({ firstTry: "typo" }));
    const fixed = await settled(admin, (await create(admin, "Tablica wpisów dla sąsiadów")).id);
    expect(fixed.revisions[0]).toMatchObject({ status: "ready", attempts: 2 });
    await t.close();

    const failing = await start(new TestPluginAuthor({ firstTry: "never" }));
    const failed = await settled(failing, (await create(failing, "Tablica wpisów dla sąsiadów")).id);
    expect(failed).toMatchObject({ status: "failed" });
    expect(failed.revisions[0]).toMatchObject({ status: "failed", error: "check_failed", attempts: 1, source: null });
  });

  test("a plugin under another id than the draft's never becomes ready", async () => {
    const thief: PluginAuthor = {
      write: async (task: AuthorTask, check: (source: string) => Promise<PluginCheck>, signal: AbortSignal) => {
        const honest = await new TestPluginAuthor().write(task, check);
        void signal;
        return { ...honest, source: honest.source.replace(`id: "${task.pluginId}"`, 'id: "notes"') };
      },
    };
    const admin = await start(thief);
    const draft = await settled(admin, (await create(admin, "Tablica wpisów dla sąsiadów")).id);
    expect(draft.revisions[0]).toMatchObject({ status: "failed", error: "check_failed" });
    expect(t.plugins.get("notes")).toBeUndefined();
  });
});

describe("publishing and feedback", () => {
  test("publish installs it in the place; feedback writes a new revision from the current source; republish replaces it", async () => {
    const first = gated();
    const admin = await start(first.author);
    const { id, pluginId } = await create(admin, "Tablica „Zguby i znalezione” dla mieszkańców");
    const early = await t.request(`${base}/drafts/${id}/publish`, { method: "POST", headers: admin });
    expect(early.status).toBe(409); // still being written
    const busy = await t.request(`${base}/drafts/${id}/revisions`, {
      method: "POST",
      headers: admin,
      json: { request: "I jeszcze dodaj zdjęcia" },
    });
    expect(busy.status).toBe(409); // one revision at a time
    first.release();
    await t.drafts.idle();

    const published = await t.request(`${base}/drafts/${id}/publish`, { method: "POST", headers: admin });
    expect(published.status).toBe(200);
    expect(await json<PluginDraft>(published)).toMatchObject({ published: 1 });
    expect(await nav(admin)).toContainEqual(expect.objectContaining({ pluginId, label: "Zguby i znalezione" }));
    const add = await t.request(`${base}/plugins/${pluginId}/tools/add`, {
      method: "POST",
      headers: admin,
      json: { args: { title: "Klucze na ławce przy Plantach" } },
    });
    expect(add.status).toBe(200);

    const revise = (request: string) =>
      t.request(`${base}/drafts/${id}/revisions`, { method: "POST", headers: admin, json: { request } });
    const second = await revise("Zmień nazwę na „Rzeczy znalezione”, proszę");
    expect(second.status).toBe(201);
    const draft = await settled(admin, id);
    expect(draft.revisions.map((r) => [r.n, r.status, r.plugin?.name])).toEqual([
      [1, "ready", "Zguby i znalezione"],
      [2, "ready", "Rzeczy znalezione"],
    ]);
    expect(draft.revisions[1]?.source).toContain('version: "1.1.0"');
    expect(draft.published).toBe(1); // feedback alone changes nothing in the place

    expect((await t.request(`${base}/drafts/${id}/publish`, { method: "POST", headers: admin })).status).toBe(200);
    expect(await nav(admin)).toContainEqual(expect.objectContaining({ pluginId, label: "Rzeczy znalezione" }));
    const view = await json<{ children: unknown[] }>(
      await t.request(`${base}/plugins/${pluginId}/views/main`, { headers: admin }),
    );
    expect(JSON.stringify(view)).toContain("Klucze na ławce przy Plantach"); // the data stayed
  });

  test("a published AI plugin is one of the place's plugins (switchable); other places cannot see or switch it", async () => {
    const admin = await start();
    const { id, pluginId } = await create(admin, "Tablica „Zguby i znalezione” dla mieszkańców");
    await t.drafts.idle();
    await t.request(`${base}/drafts/${id}/publish`, { method: "POST", headers: admin });

    const plugins = await json<PlacePlugin[]>(await t.request(`${base}/plugins`, { headers: admin }));
    expect(plugins.find((p) => p.id === pluginId)).toEqual({
      id: pluginId,
      name: "Zguby i znalezione",
      icon: "📌",
      description: "Krótkie wpisy członków miejsca.",
      enabled: true,
      madeByAi: true,
    });
    expect(plugins.find((p) => p.id === "issues")).toMatchObject({ madeByAi: false });
    const off = await t.request(`${base}/plugins/${pluginId}`, {
      method: "PUT",
      headers: admin,
      json: { enabled: false },
    });
    expect(off.status).toBe(200);
    expect((await nav(admin)).map((n) => n.pluginId)).not.toContain(pluginId);

    const other = await t.signUp({ place: null });
    const place = await json<{ slug: string }>(
      await t.request("/api/communities", {
        method: "POST",
        headers: other.headers,
        json: { name: "Osiedle Zielone" },
      }),
    );
    const theirs = `/api/communities/${place.slug}`;
    const switchIt = await t.request(`${theirs}/plugins/${pluginId}`, {
      method: "PUT",
      headers: other.headers,
      json: { enabled: true },
    });
    expect(switchIt.status).toBe(404);
    const listed = await json<PlacePlugin[]>(await t.request(`${theirs}/plugins`, { headers: other.headers }));
    expect(listed.map((p) => p.id)).not.toContain(pluginId);
    const catalog = await json<PluginCatalogItem[]>(await t.request("/api/plugins", { headers: other.headers }));
    expect(catalog.map((p) => p.id)).not.toContain(pluginId);
    const draft = await t.request(`${theirs}/drafts/${id}`, { headers: other.headers });
    expect(draft.status).toBe(404);
  });
});
