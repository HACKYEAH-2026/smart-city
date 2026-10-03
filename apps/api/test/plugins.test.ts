import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ToolResult, UINode } from "@app/plugin-sdk";
import { textsOf } from "@app/plugin-sdk/testing";
import type { CommunityNavItem } from "@app/shared";
import type { LanguageModel } from "../src/ai/types";
import { createApp } from "../src/app";
import { loadEnv } from "../src/env";
import { TEST_ENV } from "../src/test-env";
import { DEMO_COMMUNITY } from "../src/test-routes";
import { type Ctx, setup } from "./helpers";

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
const BENCHES = readFileSync(join(import.meta.dir, "../../../plugins/benches/index.ts"), "utf8");

const view = async (headers: Record<string, string>, path: string) => {
  const res = await t.request(`${base}/plugins/${path}`, { headers });
  return { res, node: res.status === 200 ? ((await res.json()) as UINode) : undefined };
};
const tool = async (headers: Record<string, string>, path: string, args: Record<string, unknown>) => {
  const res = await t.request(`${base}/plugins/${path}`, { method: "POST", headers, json: { args } });
  return { res, result: res.status === 200 ? ((await res.json()) as ToolResult) : undefined };
};
const flat = (n: UINode): UINode[] => [n, ...("children" in n && n.children ? n.children.flatMap(flat) : [])];
const upload = (headers: Record<string, string>, file: File, plugin = "issues") => {
  const form = new FormData();
  form.set("file", file);
  return t.request(`${base}/plugins/${plugin}/files`, { method: "POST", headers, body: form });
};
const jpeg = () => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])], "lamp.jpg", { type: "image/jpeg" });

describe("communities, navigation, roles", () => {
  test("no session 401; navigation from installed plugins; unknown resources 404", async () => {
    await start();
    expect((await t.request(`${base}/nav`)).status).toBe(401);
    const u = await t.signUp();
    const nav = (await (await t.request(`${base}/nav`, { headers: u.headers })).json()) as CommunityNavItem[];
    expect(nav).toEqual([{ pluginId: "issues", icon: "🛠️", view: "list", label: "Zgłoszenia" }]);
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
    const { result } = await tool(u.headers, "issues/tools/report", { title: "Dziura w chodniku", category: "roads" });
    const id = result!.navigate!.params!.id!;

    expect((await tool(u.headers, "issues/tools/setStatus", { id, status: "fixed" })).res.status).toBe(403);
    expect((await tool(cityAdmin.headers, "issues/tools/setStatus", { id, status: "fixed" })).res.status).toBe(200);

    const grant = await t.request(`/api/admin/communities/${DEMO_COMMUNITY.slug}/admins`, {
      method: "POST",
      headers: platform,
      json: { email: u.email },
    });
    expect(grant.status).toBe(201);
    expect((await tool(u.headers, "issues/tools/setStatus", { id, status: "open" })).res.status).toBe(200);
  });

  test("tool input validation: 400 with a list of issues", async () => {
    await start();
    const u = await t.signUp();
    const { res } = await tool(u.headers, "issues/tools/report", { title: "x", category: "nie-ma" });
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

    const { result } = await tool(u.headers, "issues/tools/report", { title: "Zepsuta ławka", photo: fileId });
    const { node } = await view(u.headers, `issues/views/detail?id=${result!.navigate!.params!.id}`);
    const image = flat(node!).find((n) => n.type === "Image");
    expect(image).toMatchObject({ type: "Image", file: fileId });
    const url = new URL((image as { url: string }).url);

    const file = await t.request(`${url.pathname}${url.search}`);
    expect(file.status).toBe(200);
    expect(file.headers.get("content-type")).toBe("image/jpeg");
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(new Uint8Array(await jpeg().arrayBuffer()));

    expect((await t.request(`${url.pathname}?exp=${url.searchParams.get("exp")}&sig=zly`)).status).toBe(404);
  });

  test("rejects: non-image (400), someone else's file (400), plugin without files permission (404)", async () => {
    await start();
    const alice = await t.signUp();
    const bob = await t.signUp();
    expect((await upload(alice.headers, new File(["x"], "a.txt", { type: "text/plain" }))).status).toBe(400);

    const { fileId } = (await (await upload(alice.headers, jpeg())).json()) as { fileId: string };
    const stolen = await tool(bob.headers, "issues/tools/report", {
      title: "Cudze zdjęcie",
      photo: fileId,
      force: true,
    });
    expect(stolen.res.status).toBe(400);

    await t.request("/api/admin/plugins", { method: "POST", headers: platform, json: { source: BENCHES } });
    await t.request(`/api/admin/communities/${DEMO_COMMUNITY.slug}/plugins`, {
      method: "POST",
      headers: platform,
      json: { pluginId: "benches" },
    });
    expect((await upload(alice.headers, jpeg(), "benches")).status).toBe(404);
  });
});

describe("AI", () => {
  test("without a model findSimilar works lexically: similar title → merge prompt", async () => {
    await start();
    const alice = await t.signUp();
    const bob = await t.signUp();
    await tool(alice.headers, "issues/tools/report", { title: "Nie świeci latarnia na Długiej", category: "lighting" });
    const { result } = await tool(bob.headers, "issues/tools/report", { title: "latarnia Długiej nie świeci" });
    expect(result?.navigate?.view).toBe("merge");
  });

  test("with a model: findSimilar asks the model (with image) and returns its reason", async () => {
    const seen: { prompt: string; images: number }[] = [];
    const model: LanguageModel = {
      async generate(req) {
        seen.push({ prompt: req.prompt, images: req.images?.length ?? 0 });
        return { matches: [{ index: 0, score: 0.95, reason: "Ta sama latarnia" }] };
      },
    };
    await start({ ai: { language: model } });
    const alice = await t.signUp();
    const bob = await t.signUp();
    await tool(alice.headers, "issues/tools/report", { title: "Ciemno przy przystanku", category: "lighting" });
    const { fileId } = (await (await upload(bob.headers, jpeg())).json()) as { fileId: string };
    const { result } = await tool(bob.headers, "issues/tools/report", { title: "Lampa nie działa", photo: fileId });

    expect(result?.navigate?.view).toBe("merge");
    expect(result?.navigate?.params?.reason).toBe("Ta sama latarnia");
    expect(seen).toHaveLength(1);
    expect(seen[0]?.prompt).toContain("Ciemno przy przystanku");
    expect(seen[0]?.images).toBe(1);
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
    expect((await uploadPlugin(BENCHES, {})).status).toBe(401);
    expect((await uploadPlugin(BENCHES)).status).toBe(201);
    expect((await install("benches")).status).toBe(201);

    const nav = (await (await t.request(`${base}/nav`, { headers: u.headers })).json()) as CommunityNavItem[];
    expect(nav.map((n) => n.pluginId)).toEqual(["issues", "benches"]);
    expect((await tool(u.headers, "benches/tools/report", { park: "Park Jordana" })).res.status).toBe(200);
    expect(textsOf((await view(u.headers, "benches/views/main")).node!)).toContain("Park Jordana");

    const restarted = createApp({ db: t.db, env: loadEnv(TEST_ENV) }).app;
    const res = await restarted.request(`${base}/nav`, { headers: u.headers });
    expect(((await res.json()) as CommunityNavItem[]).map((n) => n.pluginId)).toContain("benches");
  });

  test("onInstall writes seed data on first install (once)", async () => {
    await start();
    const u = await t.signUp();
    const seeded = BENCHES.replace('id: "benches"', 'id: "seeded"').replace(
      "    views: {",
      '    onInstall: async (ctx) => {\n      await ctx.db.create("benches", { park: "Planty", problem: "z instalacji" });\n    },\n    views: {',
    );
    expect((await uploadPlugin(seeded)).status).toBe(201);
    await install("seeded");
    await install("seeded");
    const texts = textsOf((await view(u.headers, "seeded/views/main")).node!);
    expect(texts.filter((x) => x === "Planty")).toHaveLength(1);
  });

  test("rejects: syntax error, bad manifest, nav without a view, overriding a built-in", async () => {
    await start();
    const bad = async (source: string) => {
      const res = await uploadPlugin(source);
      expect(res.status).toBe(400);
      return ((await res.json()) as { message: string }).message;
    };
    expect(await bad("export default (sdk => {")).toContain("does not compile");
    expect(await bad("export default ({ definePlugin }) => definePlugin({ id: 'X', views: {} })")).toContain(
      "Invalid manifest",
    );
    expect(await bad(BENCHES.replace('view: "main"', 'view: "missing"'))).toContain("missing view");
    expect(await bad(BENCHES.replace('id: "benches"', 'id: "issues"'))).toContain("built-in");
  });

  test("plugin without db permission or with invalid UI: 500 plugin_error, API keeps working", async () => {
    await start();
    const u = await t.signUp();
    await uploadPlugin(BENCHES.replace('id: "benches"', 'id: "nostore"').replace('permissions: ["db"],', ""));
    await install("nostore");
    expect((await view(u.headers, "nostore/views/main")).res.status).toBe(500);

    await uploadPlugin(
      BENCHES.replace('id: "benches"', 'id: "badui"').replace(
        'ui.screen("Ławki w parkach", [',
        "ui.screen(42 as never, [",
      ),
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
        json: { source: BENCHES },
      });
      expect(res.status).toBe(404);
    } finally {
      await noAdmin.close();
    }
  });
});
