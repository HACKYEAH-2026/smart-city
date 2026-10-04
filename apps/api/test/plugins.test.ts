import { afterEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { DashboardWidgetSize, ToolResult, UINode } from "@app/plugin-sdk";
import { textsOf } from "@app/plugin-sdk/testing";
import type { CommunityNavItem, DashboardLayout, PluginCatalogItem } from "@app/shared";
import { createApp } from "../src/app";
import { loadEnv } from "../src/env";
import type { EmbeddingModel, LanguageModel } from "../src/services/ai/types";
import { TEST_ENV } from "../src/test-env";
import { DEMO_ADDRESS, DEMO_COMMUNITY, DEMO_LOCATION } from "../src/test-routes";
import { type Ctx, setup } from "./helpers";

// Uploading a plugin type-checks it (~1 s on an idle machine, more when verify runs builds in parallel).
setDefaultTimeout(30_000);

/**
 * Plugin host: routing, roles, files, AI, isolation, admin API.
 * The issues plugin's own logic is tested by plugins/issues/issues.test.ts (no API).
 */
let t: Ctx;
let cityAdmin: { headers: Record<string, string> };

const start = async (opts: Parameters<typeof setup>[1] = {}) => {
  t = await setup({}, opts);
  cityAdmin = (await t.seed()).admin;
};
afterEach(async () => {
  await t.close();
});

const base = `/api/communities/${DEMO_COMMUNITY.slug}`;
const platform = { authorization: `Bearer ${TEST_ENV.PLUGIN_ADMIN_TOKEN}` };
const NOTES = readFileSync(join(import.meta.dir, "fixtures/notes-plugin.ts"), "utf8");
const DEDUPE = readFileSync(join(import.meta.dir, "fixtures/dedupe-plugin.ts"), "utf8");

const view = async (headers: Record<string, string>, path: string) => {
  const res = await t.request(`${base}/plugins/${path}`, { headers });
  return { res, node: res.status === 200 ? ((await res.json()) as UINode) : undefined };
};
const tool = async (headers: Record<string, string>, path: string, args: Record<string, unknown>) => {
  const res = await t.request(`${base}/plugins/${path}`, { method: "POST", headers, json: { args } });
  return { res, result: res.status === 200 ? ((await res.json()) as ToolResult) : undefined };
};
const flat = (n: UINode): UINode[] => [n, ...("children" in n && n.children ? n.children.flatMap(flat) : [])];
/** The widgets of the new built-in plugins, in catalog order (after the first three). */
const NEW_WIDGETS = [
  "disruptions/now",
  "events/upcoming",
  "faq/top",
  "groups/feed",
  "help/open",
  "market/latest",
  "questions/pending",
];

/** The navigation of every built-in plugin, in order: a plugin with two sections has two entries. */
const NAV_IDS = [
  "issues",
  "announcements",
  "discussions",
  "disruptions",
  "disruptions",
  "events",
  "events",
  "faq",
  "groups",
  "help",
  "help",
  "market",
  "market",
  "questions",
];

const upload = (headers: Record<string, string>, file: File, plugin = "issues") => {
  const form = new FormData();
  form.set("file", file);
  return t.request(`${base}/plugins/${plugin}/files`, { method: "POST", headers, body: form });
};
const jpeg = () => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])], "lamp.jpg", { type: "image/jpeg" });
/** The id of the report a tool result opened (the "sent" screen). */
const reportId = (result: ToolResult | undefined) => {
  const id = result?.navigate?.params?.id;
  if (!id) throw new Error(`no report id in ${JSON.stringify(result)}`);
  return id;
};

describe("communities, navigation, roles", () => {
  test("no session 401; navigation from installed plugins; unknown resources 404", async () => {
    await start();
    expect((await t.request(`${base}/nav`)).status).toBe(401);
    const u = await t.signUp();
    const nav = (await (await t.request(`${base}/nav`, { headers: u.headers })).json()) as CommunityNavItem[];
    expect(nav.map((n) => n.pluginId)).toEqual(NAV_IDS);
    expect(nav.find((n) => n.pluginId === "disruptions")).toEqual({
      pluginId: "disruptions",
      icon: "🚧",
      view: "map",
      label: "Mapa utrudnień",
    });
    expect((await t.request("/api/communities/nie-ma", { headers: u.headers })).status).toBe(404);
    expect((await view(u.headers, "nie-ma/views/list")).res.status).toBe(404);
    expect((await view(u.headers, "issues/views/nie-ma")).res.status).toBe(404);
    expect((await tool(u.headers, "issues/tools/nie-ma", {})).res.status).toBe(404);
  });

  test("first visit grants the user role; the demo account is an admin", async () => {
    await start();
    const u = await t.signUp();
    const role = async (headers: Record<string, string>) =>
      ((await (await t.request(base, { headers })).json()) as { role: string }).role;
    expect(await role(u.headers)).toBe("user");
    expect(await role(cityAdmin.headers)).toBe("admin");
  });

  test("requires: admin — user gets 403, admin is allowed; admin granted via the platform API", async () => {
    await start();
    const u = await t.signUp();
    const { result } = await tool(u.headers, "issues/tools/report", { title: "Dziura w chodniku" });
    const id = reportId(result);

    expect((await tool(u.headers, "issues/tools/setClosed", { id, closed: true })).res.status).toBe(403);
    expect((await tool(cityAdmin.headers, "issues/tools/setClosed", { id, closed: true })).res.status).toBe(200);

    const grant = await t.request(`/api/admin/communities/${DEMO_COMMUNITY.slug}/admins`, {
      method: "POST",
      headers: platform,
      json: { email: u.email },
    });
    expect(grant.status).toBe(201);
    expect((await tool(u.headers, "issues/tools/setClosed", { id, closed: false })).res.status).toBe(200);
  });

  test("tool input validation: 400 with a list of issues", async () => {
    await start();
    const u = await t.signUp();
    const { res } = await tool(u.headers, "issues/tools/report", { title: "x", photos: ["nie-plik"] });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe("invalid_input");
  });
});

describe("files", () => {
  test("upload → report with photo → signed URL in UI → download", async () => {
    await start();
    const u = await t.signUp();
    const up = await upload(u.headers, jpeg());
    expect(up.status).toBe(201);
    const { fileId } = (await up.json()) as { fileId: string };

    const { result } = await tool(u.headers, "issues/tools/report", { title: "Zepsuta ławka", photos: [fileId] });
    const { node } = await view(u.headers, `issues/views/detail?id=${reportId(result)}`);
    const [photo] = (node ? flat(node) : []).flatMap((n) => (n.type === "Gallery" ? n.items : []));
    expect(photo?.file).toBe(fileId);
    const url = new URL(photo?.url ?? "http://missing");
    expect(url.pathname).toBe(`/api/files/${fileId}`);

    const file = await t.request(`${url.pathname}${url.search}`);
    expect(file.status).toBe(200);
    expect(file.headers.get("content-type")).toBe("image/jpeg");
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(new Uint8Array(await jpeg().arrayBuffer()));

    expect((await t.request(`${url.pathname}?exp=${url.searchParams.get("exp")}&sig=zly`)).status).toBe(404);
  });

  test("rejects: non-image (400), someone else's file (refused), plugin without files permission (404)", async () => {
    await start();
    const alice = await t.signUp();
    const bob = await t.signUp();
    expect((await upload(alice.headers, new File(["x"], "a.txt", { type: "text/plain" }))).status).toBe(400);

    const { fileId } = (await (await upload(alice.headers, jpeg())).json()) as { fileId: string };
    const stolen = await tool(bob.headers, "issues/tools/report", {
      title: "Cudze zdjęcie",
      photos: [fileId],
      force: true,
    });
    // The issues plugin checks who uploaded each photo (ctx.files.info) before saving anything.
    expect(stolen.result?.error).toBe("Nie można dodać tego zdjęcia. Dodaj je jeszcze raz.");

    await t.request("/api/admin/plugins", { method: "POST", headers: platform, json: { source: NOTES } });
    await t.request(`/api/admin/communities/${DEMO_COMMUNITY.slug}/plugins`, {
      method: "POST",
      headers: platform,
      json: { pluginId: "notes" },
    });
    expect((await upload(alice.headers, jpeg(), "notes")).status).toBe(404);
  });
});

describe("plugin catalog", () => {
  test("no session 401; the built-in plugins in order, not uploaded ones", async () => {
    await start();
    expect((await t.request("/api/plugins")).status).toBe(401);
    await t.request("/api/admin/plugins", { method: "POST", headers: platform, json: { source: NOTES } });
    const u = await t.signUp();
    const res = await t.request("/api/plugins", { headers: u.headers });
    expect(res.status).toBe(200);
    const catalog = (await res.json()) as PluginCatalogItem[];
    expect(catalog.map(({ id, name, icon }) => ({ id, name, icon }))).toEqual([
      { id: "issues", name: "Zgłoszenia", icon: "🛠️" },
      { id: "announcements", name: "Ogłoszenia", icon: "📢" },
      { id: "discussions", name: "Dyskusje", icon: "💬" },
      { id: "disruptions", name: "Utrudnienia", icon: "🚧" },
      { id: "events", name: "Wydarzenia", icon: "📅" },
      { id: "faq", name: "FAQ", icon: "💡" },
      { id: "groups", name: "Grupy", icon: "👥" },
      { id: "help", name: "Pomoc sąsiedzka", icon: "🤝" },
      { id: "market", name: "Giełda sąsiedzka", icon: "🏷️" },
      { id: "questions", name: "Pytania i odpowiedzi", icon: "❓" },
    ]);
    expect(catalog.every((plugin) => plugin.description.length > 0)).toBe(true);
  });
});

describe("AI", () => {
  test("without a model findSimilar works lexically: similar title → merge prompt", async () => {
    await start();
    const alice = await t.signUp();
    const bob = await t.signUp();
    await tool(alice.headers, "issues/tools/report", { title: "Nie świeci latarnia na Długiej" });
    const { result } = await tool(bob.headers, "issues/tools/report", { title: "latarnia Długiej nie świeci" });
    expect(result?.navigate?.view).toBe("merge");
  });

  test("with a model: a new report gets its category (ctx.ai.call); findSimilar asks with the image", async () => {
    const seen: { prompt: string; images: number }[] = [];
    // The issues plugin asks for a category after a report is saved, and findSimilar before the next one.
    const model: LanguageModel = {
      async generate(req) {
        seen.push({ prompt: req.prompt, images: req.images?.length ?? 0 });
        return req.prompt.startsWith("Pick the category")
          ? { category: "Oświetlenie" }
          : { matches: [{ index: 0, score: 0.95, reason: "Ta sama latarnia" }] };
      },
    };
    await start({ ai: { language: model } });
    const alice = await t.signUp();
    const bob = await t.signUp();
    const first = await tool(alice.headers, "issues/tools/report", { title: "Ciemno przy przystanku" });
    const { fileId } = (await (await upload(bob.headers, jpeg())).json()) as { fileId: string };
    const { result } = await tool(bob.headers, "issues/tools/report", { title: "Lampa nie działa", photos: [fileId] });

    expect(result?.navigate).toMatchObject({ view: "merge", present: "sheet" });
    expect(result?.data).toMatchObject({ reason: "Ta sama latarnia" });
    expect(seen.map((call) => call.prompt.split("\n")[0])).toEqual([
      expect.stringContaining("Pick the category"),
      expect.stringContaining("A resident is reporting a problem"),
    ]);
    expect(seen[1]?.prompt).toContain("Ciemno przy przystanku");
    expect(seen[1]?.images).toBe(1);

    // Only admins see the category: it is the selected option of the admin detail's menu.
    const admin = await view(cityAdmin.headers, `issues/views/adminDetail?id=${reportId(first.result)}`);
    const menu = (admin.node ? flat(admin.node) : []).find((n) => n.type === "Menu");
    expect(menu?.type === "Menu" ? menu.options.find((o) => o.selected)?.label : undefined).toBe("Oświetlenie");
  });

  const startDedupe = async (embedding?: EmbeddingModel) => {
    await start(embedding ? { ai: { embedding } } : {});
    await t.request("/api/admin/plugins", { method: "POST", headers: platform, json: { source: DEDUPE } });
    await t.request(`/api/admin/communities/${DEMO_COMMUNITY.slug}/plugins`, {
      method: "POST",
      headers: platform,
      json: { pluginId: "dedupe" },
    });
  };

  test("with an embedding model: a plugin stores ctx.ai.embed vectors and compares them itself", async () => {
    const embedded: string[] = [];
    // One axis per topic: texts about the same thing get the same direction.
    const embedding: EmbeddingModel = {
      async embed(text) {
        embedded.push(text);
        return [/latarni/i.test(text) ? 1 : 0, /dziur/i.test(text) ? 1 : 0, 0.1];
      },
    };
    await startDedupe(embedding);
    const alice = await t.signUp();
    const bob = await t.signUp();

    const lamp = await tool(alice.headers, "dedupe/tools/add", { title: "Nie świeci latarnia na Długiej" });
    const hole = await tool(alice.headers, "dedupe/tools/add", { title: "Dziura w jezdni na Kopernika" });
    const again = await tool(bob.headers, "dedupe/tools/add", { title: "Zepsuta latarnia przy Długiej" });

    const lampId = (lamp.result?.data as { id?: string } | undefined)?.id;
    expect(lampId).toBeString();
    expect(hole.result?.data).toHaveProperty("id");
    expect(again.result?.data).toEqual({ duplicateOf: lampId });
    expect(embedded).toEqual([
      "Nie świeci latarnia na Długiej",
      "Dziura w jezdni na Kopernika",
      "Zepsuta latarnia przy Długiej",
    ]);
  });

  test("without an embedding model ctx.ai.embed fails (plugin_error)", async () => {
    await startDedupe();
    const u = await t.signUp();
    const { res } = await tool(u.headers, "dedupe/tools/add", { title: "Latarnia" });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "plugin_error" });
  });
});

describe("isolation and plugins uploaded on the fly", () => {
  const install = (pluginId: string, slug: string = DEMO_COMMUNITY.slug) =>
    t.request(`/api/admin/communities/${slug}/plugins`, { method: "POST", headers: platform, json: { pluginId } });
  const uploadPlugin = (source: string, headers: Record<string, string> = platform) =>
    t.request("/api/admin/plugins", { method: "POST", headers, json: { source } });

  test("one community's data is not visible in another", async () => {
    await start();
    const u = await t.signUp();
    await tool(u.headers, "issues/tools/report", { title: "Sprawa z Krakowa", category: "other" });
    await t.request("/api/admin/communities", {
      method: "POST",
      headers: platform,
      json: { slug: "gdansk", name: "Gdańsk" },
    });
    const other = "/api/communities/gdansk/plugins/issues/views/list";
    expect((await t.request(other, { headers: u.headers })).status).toBe(404);
    await install("issues", "gdansk");
    const node = (await (await t.request(other, { headers: u.headers })).json()) as UINode;
    expect(textsOf(node)).not.toContain("Sprawa z Krakowa");
  });

  test("no platform token 401; upload → install → navigation and usage; survives restart", async () => {
    await start();
    const u = await t.signUp();
    expect((await uploadPlugin(NOTES, {})).status).toBe(401);
    expect((await uploadPlugin(NOTES)).status).toBe(201);
    expect((await install("notes")).status).toBe(201);

    const nav = (await (await t.request(`${base}/nav`, { headers: u.headers })).json()) as CommunityNavItem[];
    expect(nav.map((n) => n.pluginId)).toEqual([...NAV_IDS, "notes"]);
    expect((await tool(u.headers, "notes/tools/add", { title: "Klucz do piwnicy" })).res.status).toBe(200);
    expect(textsOf((await view(u.headers, "notes/views/main")).node!)).toContain("Klucz do piwnicy");

    const restarted = createApp({ db: t.db, env: loadEnv(TEST_ENV) }).app;
    const res = await restarted.request(`${base}/nav`, { headers: u.headers });
    expect(((await res.json()) as CommunityNavItem[]).map((n) => n.pluginId)).toContain("notes");
  });

  test("onInstall writes seed data on first install (once)", async () => {
    await start();
    const u = await t.signUp();
    const seeded = NOTES.replace('id: "notes"', 'id: "seeded"').replace(
      "    views: {",
      '    onInstall: async (ctx) => {\n      await ctx.db.notes.insert({ title: "Planty", body: "z instalacji" });\n    },\n    views: {',
    );
    expect((await uploadPlugin(seeded)).status).toBe(201);
    await install("seeded");
    await install("seeded");
    const texts = textsOf((await view(u.headers, "seeded/views/main")).node!);
    expect(texts.filter((x) => x === "Planty")).toHaveLength(1);
  });

  test("rejects: syntax error, bad manifest, nav without a view, overriding a built-in (stages: plugin-check.test.ts)", async () => {
    await start();
    const bad = async (source: string) => {
      const res = await uploadPlugin(source);
      expect(res.status).toBe(400);
      const body = (await res.json()) as { stage: string; message: string };
      return `${body.stage} ${body.message}`;
    };
    expect(await bad("export default (sdk => {")).toStartWith("syntax");
    expect(await bad(NOTES.replace('id: "notes"', 'id: "X"'))).toContain("Invalid manifest");
    expect(await bad(NOTES.replace('view: "main"', 'view: "missing"'))).toContain("missing view");
    expect(await bad(NOTES.replace('id: "notes"', 'id: "issues"'))).toContain("built-in");
  });

  test("plugin without db permission or with invalid UI: 500 plugin_error, API keeps working", async () => {
    await start();
    const u = await t.signUp();
    await uploadPlugin(NOTES.replace('id: "notes"', 'id: "nostore"').replace('permissions: ["db"],', ""));
    await install("nostore");
    expect((await view(u.headers, "nostore/views/main")).res.status).toBe(500);

    await uploadPlugin(
      NOTES.replace('id: "notes"', 'id: "badui"').replace('ui.screen("Tablica notatek", [', "ui.screen(42 as never, ["),
    );
    await install("badui");
    const res = await view(u.headers, "badui/views/main");
    expect(res.res.status).toBe(500);
    expect(((await res.res.json()) as { error: string }).error).toBe("plugin_error");
    expect((await view(u.headers, "issues/views/list")).res.status).toBe(200);
  });

  test("without PLUGIN_ADMIN_TOKEN in env the admin API does not exist (404)", async () => {
    await start();
    const noAdmin = await setup({ PLUGIN_ADMIN_TOKEN: undefined });
    try {
      const res = await noAdmin.request("/api/admin/plugins", {
        method: "POST",
        headers: platform,
        json: { source: NOTES },
      });
      expect(res.status).toBe(404);
    } finally {
      await noAdmin.close();
    }
  });
});

describe("maps", () => {
  test("ctx.community.location is the place's pin; a report placed on the map shows its pin", async () => {
    await start();
    const u = await t.signUp();
    const located = NOTES.replace('id: "notes"', 'id: "located"').replace(
      'return ui.screen("Tablica notatek", [',
      // biome-ignore lint/suspicious/noTemplateCurlyInString: plugin source text; the plugin evaluates the template
      'return ui.screen("Tablica notatek", [\n          ui.text(`Pinezka: ${JSON.stringify(ctx.community.location)}`),',
    );
    expect(
      (await t.request("/api/admin/plugins", { method: "POST", headers: platform, json: { source: located } })).status,
    ).toBe(201);
    await t.request(`/api/admin/communities/${DEMO_COMMUNITY.slug}/plugins`, {
      method: "POST",
      headers: platform,
      json: { pluginId: "located" },
    });
    expect(textsOf((await view(u.headers, "located/views/main")).node!)).toContain(
      `Pinezka: ${JSON.stringify(DEMO_LOCATION)}`,
    );

    const where = { ...DEMO_LOCATION, address: DEMO_ADDRESS };
    const { result } = await tool(u.headers, "issues/tools/report", { title: "Dziura w jezdni", location: where });
    const id = reportId(result);
    const detail = (await view(u.headers, `issues/views/detail?id=${id}`)).node;
    expect(detail ? flat(detail).filter((n) => n.type === "Map") : []).toHaveLength(0);
    expect(detail ? flat(detail).find((n) => n.type === "Place") : undefined).toMatchObject({
      text: DEMO_ADDRESS,
      action: { type: "navigate", view: "map", params: { id } },
    });
    const { node } = await view(u.headers, `issues/views/map?id=${id}`);
    const map = (node ? flat(node) : []).find((n) => n.type === "Map");
    expect(map).toMatchObject({ label: "Miejsce zgłoszenia" });
    expect(map ? textsOf(map) : []).toEqual(expect.arrayContaining(["Dziura w jezdni", DEMO_ADDRESS]));
  });
});

describe("dashboard", () => {
  type Dashboard = { canEdit: boolean; widgets: { key: string; size: { w: number; h: number }; node: UINode }[] };
  const dashboard = async (headers: Record<string, string>) => {
    const res = await t.request(`${base}/dashboard`, { headers });
    const body = res.status === 200 ? ((await res.json()) as Dashboard) : { canEdit: false, widgets: [] };
    return { res, ...body, keys: body.widgets.map((w) => w.key) };
  };
  const nodeOf = (d: Dashboard, key: string) => d.widgets.find((w) => w.key === key)!.node;
  const setOrder = (headers: Record<string, string>, order: unknown) =>
    t.request(`${base}/dashboard`, { method: "PATCH", headers, json: { order } });
  const uploadAndInstall = async (source: string, pluginId: string) => {
    const up = await t.request("/api/admin/plugins", { method: "POST", headers: platform, json: { source } });
    expect(up.status).toBe(201);
    await t.request(`/api/admin/communities/${DEMO_COMMUNITY.slug}/plugins`, {
      method: "POST",
      headers: platform,
      json: { pluginId },
    });
  };
  /** The notes fixture with its one widget replaced by `widgets` (the body of `dashboardWidgets: { … }`). */
  const withWidgets = (id: string, widgets: string) =>
    NOTES.replace('id: "notes"', `id: "${id}"`).replace(
      / {4}dashboardWidgets: \{\n[\s\S]*?\n {4}\},\n/,
      `    dashboardWidgets: { ${widgets} },\n`,
    );
  const withWidget = (id: string, widget: string) => withWidgets(id, `w: ${widget}`);

  test("no session 401, unknown community 404; every plugin's widget shows, even without data", async () => {
    await start();
    expect((await t.request(`${base}/dashboard`)).status).toBe(401);
    const u = await t.signUp();
    expect((await t.request("/api/communities/nie-ma/dashboard", { headers: u.headers })).status).toBe(404);
    const d = await dashboard(u.headers);
    expect(d.keys).toEqual([
      "issues/summary",
      "announcements/latest",
      "discussions/recent",
      "disruptions/now",
      "events/upcoming",
      "faq/top",
      "groups/feed",
      "help/open",
      "market/latest",
      "questions/pending",
    ]);
    expect(d.canEdit).toBe(false);
    expect((await dashboard(cityAdmin.headers)).canEdit).toBe(true);
  });

  test("lastVisit: new announcements until the user opens the plugin, then nothing new", async () => {
    await start();
    const u = await t.signUp();
    await tool(cityAdmin.headers, "announcements/tools/publish", { title: "Zamknięcie ulicy Długiej" });

    const before = await dashboard(u.headers);
    expect(before.widgets.map(({ key, size }) => ({ key, size }))).toEqual([
      { key: "issues/summary", size: { w: 3, h: 2 } },
      { key: "announcements/latest", size: { w: 3, h: 2 } },
      { key: "discussions/recent", size: { w: 3, h: 3 } },
      { key: "disruptions/now", size: { w: 3, h: 3 } },
      { key: "events/upcoming", size: { w: 3, h: 3 } },
      { key: "faq/top", size: { w: 3, h: 3 } },
      { key: "groups/feed", size: { w: 3, h: 3 } },
      { key: "help/open", size: { w: 3, h: 3 } },
      { key: "market/latest", size: { w: 3, h: 3 } },
      { key: "questions/pending", size: { w: 3, h: 2 } },
    ]);
    // Tapping a tile opens the plugin view its widget names.
    expect(nodeOf(before, "issues/summary")).toMatchObject({ onPress: { type: "navigate", view: "list" } });
    expect(textsOf(nodeOf(before, "announcements/latest"))).toContain("1 nowe ogłoszenie od Twojej ostatniej wizyty");

    expect((await view(u.headers, "announcements/views/list")).res.status).toBe(200);
    const after = await dashboard(u.headers);
    expect(textsOf(nodeOf(after, "announcements/latest"))).toContain("Nic nowego od Twojej ostatniej wizyty.");
    // Visits are per user: the admin who has not opened the plugin still sees it as new.
    expect(textsOf(nodeOf(await dashboard(cityAdmin.headers), "announcements/latest"))).toContain(
      "1 nowe ogłoszenie od Twojej ostatniej wizyty",
    );
  });

  test("admins reorder the dashboard for everyone; residents get 403; new widgets go last", async () => {
    await start();
    const u = await t.signUp();
    await tool(cityAdmin.headers, "announcements/tools/publish", { title: "Zebranie" });
    expect((await setOrder(u.headers, ["announcements/latest", "issues/summary"])).status).toBe(403);
    expect((await setOrder(cityAdmin.headers, "nie-lista")).status).toBe(400);
    expect((await setOrder(cityAdmin.headers, ["announcements/latest", "issues/summary"])).status).toBe(200);
    expect((await dashboard(u.headers)).keys).toEqual([
      "announcements/latest",
      "issues/summary",
      "discussions/recent",
      "disruptions/now",
      "events/upcoming",
      "faq/top",
      "groups/feed",
      "help/open",
      "market/latest",
      "questions/pending",
    ]);

    await uploadAndInstall(
      withWidget("tiles", "{ size: { w: 1, h: 1 }, render: () => ui.widget('Notatki', []) }"),
      "tiles",
    );
    expect((await dashboard(u.headers)).keys).toEqual([
      "announcements/latest",
      "issues/summary",
      "discussions/recent",
      "disruptions/now",
      "events/upcoming",
      "faq/top",
      "groups/feed",
      "help/open",
      "market/latest",
      "questions/pending",
      "tiles/w",
    ]);
    const res = await t.request("/api/communities/nie-ma/dashboard", {
      method: "PATCH",
      headers: cityAdmin.headers,
      json: { order: [] },
    });
    expect(res.status).toBe(404);
  });

  test("a throwing or invalid widget is skipped; the rest of the dashboard renders", async () => {
    await start();
    const u = await t.signUp();
    await uploadAndInstall(
      withWidget("throws", "{ size: { w: 1, h: 1 }, render: () => { throw new Error('boom'); } }"),
      "throws",
    );
    await uploadAndInstall(
      withWidget(
        "withform",
        "{ size: { w: 1, h: 1 }, render: () => ui.widget('x', [ui.button('Usuń', ui.tool('add'))]) }",
      ),
      "withform",
    );
    const d = await dashboard(u.headers);
    expect(d.res.status).toBe(200);
    expect(d.keys).toEqual([
      "issues/summary",
      "announcements/latest",
      "discussions/recent",
      "disruptions/now",
      "events/upcoming",
      "faq/top",
      "groups/feed",
      "help/open",
      "market/latest",
      "questions/pending",
    ]);
  });

  test("a widget without a valid size is rejected on upload", async () => {
    await start();
    const source = withWidget("huge", "{ size: { w: 4, h: 1 }, render: () => ui.widget('x', []) }");
    const res = await t.request("/api/admin/plugins", { method: "POST", headers: platform, json: { source } });
    expect(res.status).toBe(400);
  });

  test("a plugin needs exactly one widget: none or two are rejected on upload", async () => {
    await start();
    const upload = async (source: string) => {
      const res = await t.request("/api/admin/plugins", { method: "POST", headers: platform, json: { source } });
      expect(res.status).toBe(400);
      return ((await res.json()) as { message: string }).message;
    };
    const tile = "{ size: { w: 1, h: 1 }, render: () => ui.widget('x', []) }";
    expect(await upload(withWidgets("none", ""))).toContain("exactly one dashboard widget");
    expect(await upload(withWidgets("two", `a: ${tile}, b: ${tile}`))).toContain("exactly one dashboard widget");
  });

  describe("layout", () => {
    const layoutPath = `${base}/dashboard/layout`;
    const getLayout = async (headers: Record<string, string>) => {
      const res = await t.request(layoutPath, { headers });
      expect(res.status).toBe(200);
      return (await res.json()) as DashboardLayout;
    };
    const putLayout = (headers: Record<string, string>, widgets: unknown) =>
      t.request(layoutPath, { method: "PUT", headers, json: { widgets } });
    const tall: DashboardWidgetSize = { w: 3, h: 3 };
    const short: DashboardWidgetSize = { w: 3, h: 2 };

    test("no session 401, unknown community 404, residents 403", async () => {
      await start();
      const u = await t.signUp();
      expect((await t.request(layoutPath)).status).toBe(401);
      expect((await putLayout({}, [])).status).toBe(401);
      expect((await t.request("/api/communities/nie-ma/dashboard/layout", { headers: cityAdmin.headers })).status).toBe(
        404,
      );
      const elsewhere = await t.request("/api/communities/nie-ma/dashboard/layout", {
        method: "PUT",
        headers: cityAdmin.headers,
        json: { widgets: [] },
      });
      expect(elsewhere.status).toBe(404);
      expect((await t.request(layoutPath, { headers: u.headers })).status).toBe(403);
      expect((await putLayout(u.headers, [])).status).toBe(403);
    });

    test("declared widgets of the enabled plugins, with titles and the sizes their plugins allow", async () => {
      await start();
      const layout = await getLayout(cityAdmin.headers);
      expect(layout).toEqual({
        columns: 3,
        widgets: [
          {
            key: "issues/summary",
            pluginId: "issues",
            pluginName: "Zgłoszenia",
            pluginIcon: "🛠️",
            title: "Zgłoszenia",
            size: short,
            sizes: [short, tall],
          },
          {
            key: "announcements/latest",
            pluginId: "announcements",
            pluginName: "Ogłoszenia",
            pluginIcon: "📢",
            title: "Ogłoszenia",
            size: short,
            sizes: [short, tall],
          },
          {
            key: "discussions/recent",
            pluginId: "discussions",
            pluginName: "Dyskusje",
            pluginIcon: "💬",
            title: "Dyskusje",
            size: tall,
            sizes: [tall, short],
          },
          {
            key: "disruptions/now",
            pluginId: "disruptions",
            pluginName: "Utrudnienia",
            pluginIcon: "🚧",
            title: "Utrudnienia",
            size: { w: 3, h: 3 },
            sizes: [{ w: 3, h: 3 }],
          },
          {
            key: "events/upcoming",
            pluginId: "events",
            pluginName: "Wydarzenia",
            pluginIcon: "📅",
            title: "Wydarzenia",
            size: { w: 3, h: 3 },
            sizes: [{ w: 3, h: 3 }],
          },
          {
            key: "faq/top",
            pluginId: "faq",
            pluginName: "FAQ",
            pluginIcon: "💡",
            title: "FAQ",
            size: { w: 3, h: 3 },
            sizes: [{ w: 3, h: 3 }],
          },
          {
            key: "groups/feed",
            pluginId: "groups",
            pluginName: "Grupy",
            pluginIcon: "👥",
            title: "Grupy",
            size: { w: 3, h: 3 },
            sizes: [{ w: 3, h: 3 }],
          },
          {
            key: "help/open",
            pluginId: "help",
            pluginName: "Pomoc sąsiedzka",
            pluginIcon: "🤝",
            title: "Pomoc sąsiedzka",
            size: { w: 3, h: 3 },
            sizes: [{ w: 3, h: 3 }],
          },
          {
            key: "market/latest",
            pluginId: "market",
            pluginName: "Giełda sąsiedzka",
            pluginIcon: "🏷️",
            title: "Giełda sąsiedzka",
            size: { w: 3, h: 3 },
            sizes: [{ w: 3, h: 3 }],
          },
          {
            key: "questions/pending",
            pluginId: "questions",
            pluginName: "Pytania i odpowiedzi",
            pluginIcon: "❓",
            title: "Pytania i odpowiedzi",
            size: { w: 3, h: 2 },
            sizes: [{ w: 3, h: 2 }],
          },
        ],
        available: [],
      });
    });

    test("400 for an unknown key, a size the plugin does not allow, repeated keys or a bad body", async () => {
      await start();
      const invalid = async (widgets: unknown) => {
        const res = await putLayout(cityAdmin.headers, widgets);
        expect(res.status).toBe(400);
        return res;
      };
      const unknown = await invalid([{ key: "nie/ma", size: tall }]);
      expect(((await unknown.json()) as { error: string }).error).toBe("invalid_layout");
      const disallowed = await invalid([{ key: "issues/summary", size: { w: 1, h: 1 } }]);
      expect(((await disallowed.json()) as { error: string }).error).toBe("invalid_layout");
      await invalid([
        { key: "issues/summary", size: tall },
        { key: "issues/summary", size: short },
      ]);
      await invalid([{ key: "issues/summary", size: { w: 4, h: 1 } }]);
      await invalid("nie-lista");
    });

    test("a removed widget leaves the dashboard and is available; a chosen size and order are used", async () => {
      await start();
      const u = await t.signUp();
      const res = await putLayout(cityAdmin.headers, [{ key: "announcements/latest", size: tall }]);
      expect(res.status).toBe(200);
      const saved = (await res.json()) as DashboardLayout;
      expect(saved.widgets.map(({ key, size }) => ({ key, size }))).toEqual([
        { key: "announcements/latest", size: tall },
      ]);
      expect(saved.available.map((w) => w.key)).toEqual([
        "issues/summary",
        "discussions/recent",
        "disruptions/now",
        "events/upcoming",
        "faq/top",
        "groups/feed",
        "help/open",
        "market/latest",
        "questions/pending",
      ]);
      expect(await getLayout(cityAdmin.headers)).toEqual(saved);

      const d = await dashboard(u.headers);
      expect(d.widgets.map(({ key, size }) => ({ key, size }))).toEqual([{ key: "announcements/latest", size: tall }]);

      // Added back: issues first, discussions last, both at their default size.
      await putLayout(cityAdmin.headers, [
        { key: "issues/summary", size: tall },
        { key: "announcements/latest", size: tall },
        { key: "discussions/recent", size: tall },
      ]);
      expect((await dashboard(u.headers)).widgets.map(({ key, size }) => ({ key, size }))).toEqual([
        { key: "issues/summary", size: tall },
        { key: "announcements/latest", size: tall },
        { key: "discussions/recent", size: tall },
      ]);
      expect((await getLayout(cityAdmin.headers)).available.map((w) => w.key)).toEqual(NEW_WIDGETS);
    });

    test("reordering on the dashboard (PATCH) keeps the chosen sizes and removed widgets", async () => {
      await start();
      const u = await t.signUp();
      await uploadAndInstall(
        withWidget(
          "tiles",
          "{ size: { w: 1, h: 1 }, sizes: [{ w: 2, h: 1 }], render: () => ui.widget('Notatki', []) }",
        ),
        "tiles",
      );
      await putLayout(cityAdmin.headers, [
        { key: "issues/summary", size: short },
        { key: "tiles/w", size: { w: 2, h: 1 } },
      ]);
      expect((await setOrder(cityAdmin.headers, ["tiles/w", "issues/summary"])).status).toBe(200);
      const layout = await getLayout(cityAdmin.headers);
      expect(layout.widgets.map(({ key, size }) => ({ key, size }))).toEqual([
        { key: "tiles/w", size: { w: 2, h: 1 } },
        { key: "issues/summary", size: short },
      ]);
      expect(layout.available.map((w) => w.key)).toEqual([
        "announcements/latest",
        "discussions/recent",
        "disruptions/now",
        "events/upcoming",
        "faq/top",
        "groups/feed",
        "help/open",
        "market/latest",
        "questions/pending",
      ]);
      expect((await dashboard(u.headers)).keys).toEqual(["tiles/w", "issues/summary"]);
    });

    test("widgets of a plugin enabled after saving go last, visible, at their default size", async () => {
      await start();
      await putLayout(cityAdmin.headers, [
        { key: "announcements/latest", size: short },
        { key: "issues/summary", size: tall },
      ]);
      await uploadAndInstall(
        withWidget("tiles", "{ size: { w: 1, h: 1 }, title: 'Kafelek', render: () => ui.widget('Notatki', []) }"),
        "tiles",
      );
      const layout = await getLayout(cityAdmin.headers);
      expect(layout.widgets.map(({ key, title, size }) => ({ key, title, size }))).toEqual([
        { key: "announcements/latest", title: "Ogłoszenia", size: short },
        { key: "issues/summary", title: "Zgłoszenia", size: tall },
        { key: "tiles/w", title: "Kafelek", size: { w: 1, h: 1 } },
      ]);
      expect(layout.available.map((w) => w.key)).toEqual([
        "discussions/recent",
        "disruptions/now",
        "events/upcoming",
        "faq/top",
        "groups/feed",
        "help/open",
        "market/latest",
        "questions/pending",
      ]);
      expect((await dashboard(cityAdmin.headers)).keys).toEqual(["announcements/latest", "issues/summary", "tiles/w"]);
    });
  });
});

describe("catalog on the host", () => {
  const CATALOG = readFileSync(join(import.meta.dir, "fixtures/catalog-plugin.ts"), "utf8");
  const installCatalog = async () => {
    const up = await t.request("/api/admin/plugins", { method: "POST", headers: platform, json: { source: CATALOG } });
    expect(up.status).toBe(201);
    await t.request(`/api/admin/communities/${DEMO_COMMUNITY.slug}/plugins`, {
      method: "POST",
      headers: platform,
      json: { pluginId: "catalog" },
    });
  };

  test("adminView: no session 401, a member 403, the place's admin 200; the other views as usual", async () => {
    await start();
    await installCatalog();
    const u = await t.signUp();
    expect((await t.request(`${base}/plugins/catalog/views/admin`)).status).toBe(401);
    const denied = await view(u.headers, "catalog/views/admin");
    expect(denied.res.status).toBe(403);
    expect(await denied.res.json()).toEqual({ error: "forbidden" });
    const allowed = await view(cityAdmin.headers, "catalog/views/admin");
    expect(allowed.res.status).toBe(200);
    expect(allowed.node ? textsOf(allowed.node) : []).toEqual(["Panel", "aktywnych", "8"]);
    expect((await view(u.headers, "catalog/views/main")).res.status).toBe(200);
  });

  test("a widget renders at the size it has on this dashboard", async () => {
    await start();
    await installCatalog();
    const texts = async () => {
      const res = await t.request(`${base}/dashboard`, { headers: cityAdmin.headers });
      const body = (await res.json()) as { widgets: { key: string; node: UINode }[] };
      const tile = body.widgets.find((w) => w.key === "catalog/tile");
      return tile ? textsOf(tile.node) : [];
    };
    expect(await texts()).toContain("Rozmiar 3x2");
    const put = await t.request(`${base}/dashboard/layout`, {
      method: "PUT",
      headers: cityAdmin.headers,
      json: { widgets: [{ key: "catalog/tile", size: { w: 3, h: 3 } }] },
    });
    expect(put.status).toBe(200);
    expect(await texts()).toContain("Rozmiar 3x3");
  });

  test("photos in a Gallery, a Card's thumbnail and an ImagePicker's value get signed URLs", async () => {
    await start();
    await installCatalog();
    const u = await t.signUp();
    const { fileId } = (await (await upload(u.headers, jpeg(), "catalog")).json()) as { fileId: string };
    const { node } = await view(u.headers, `catalog/views/main?photo=${fileId}`);
    const nodes = node ? flat(node) : [];
    const gallery = nodes.flatMap((n) => (n.type === "Gallery" ? n.items : []));
    const thumbs = nodes.flatMap((n) => (n.type === "Card" && n.image ? [n.image] : []));
    const prefilled = nodes.flatMap((n) => (n.type === "ImagePicker" ? (n.value ?? []) : []));
    const signed = expect.stringContaining(`/api/files/${fileId}?exp=`);
    expect([...gallery, ...thumbs, ...prefilled].map((photo) => photo.url)).toEqual([signed, signed, signed]);

    // The signed address serves the photo.
    const url = new URL(gallery[0]?.url ?? "http://missing");
    expect((await t.request(`${url.pathname}${url.search}`)).status).toBe(200);
  });

  test("only photos the viewer may see here are signed: not another installation's, not someone's pending upload", async () => {
    await start();
    await installCatalog();
    const alice = await t.signUp();
    const bob = await t.signUp();
    const fileOf = async (res: Response) => ((await res.json()) as { fileId: string }).fileId;
    const elsewhere = await fileOf(await upload(alice.headers, jpeg(), "issues"));
    const pending = await fileOf(await upload(alice.headers, jpeg(), "catalog"));
    const urls = async (headers: Record<string, string>, file: string) => {
      const { node } = await view(headers, `catalog/views/main?photo=${file}`);
      return (node ? flat(node) : []).flatMap((n) => (n.type === "Gallery" ? n.items.map((item) => item.url) : []));
    };
    expect(await urls(alice.headers, elsewhere)).toEqual([undefined]);
    expect(await urls(bob.headers, pending)).toEqual([undefined]);
    expect(await urls(alice.headers, pending)).toEqual([expect.stringContaining(`/api/files/${pending}?exp=`)]);
  });

  test("issues: the form's photos param shows only the user's own uploads, never a signed foreign file", async () => {
    await start();
    await installCatalog();
    const alice = await t.signUp();
    const bob = await t.signUp();
    const fileOf = async (res: Response) => ((await res.json()) as { fileId: string }).fileId;
    const foreign = await fileOf(await upload(bob.headers, jpeg(), "issues"));
    const elsewhere = await fileOf(await upload(alice.headers, jpeg(), "catalog"));
    const own = await fileOf(await upload(alice.headers, jpeg(), "issues"));
    const photos = encodeURIComponent(JSON.stringify([foreign, elsewhere, own]));
    const { node } = await view(alice.headers, `issues/views/form?photos=${photos}`);
    const prefilled = (node ? flat(node) : []).flatMap((n) => (n.type === "ImagePicker" ? (n.value ?? []) : []));
    expect(prefilled.map((photo) => photo.file)).toEqual([own]);
    expect(prefilled[0]?.url).toContain(`/api/files/${own}?exp=`);
    expect(JSON.stringify(node)).not.toContain(foreign);
    expect(JSON.stringify(node)).not.toContain(elsewhere);
  });
});
