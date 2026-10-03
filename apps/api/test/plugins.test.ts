import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CommunityNavItem, ToolResult, UINode } from "@app/shared";
import { setupApi, TEST_ENV } from "@app/testing/api";
import { createApp } from "../src/app";
import { loadEnv } from "../src/env";
import { DEMO_COMMUNITY, seedDemo } from "../src/test-routes";
import { type Ctx, setup } from "./helpers";

let t: Ctx;
beforeEach(async () => {
  t = await setup();
  seedDemo(t.db);
});
afterEach(async () => {
  await t.close();
});

const base = `/api/communities/${DEMO_COMMUNITY.slug}`;
const admin = { authorization: `Bearer ${TEST_ENV.PLUGIN_ADMIN_TOKEN}` };

const view = async (headers: Record<string, string>, path: string) => {
  const res = await t.request(`${base}/plugins/${path}`, { headers });
  return { res, node: res.status === 200 ? ((await res.json()) as UINode) : undefined };
};
const tool = async (headers: Record<string, string>, path: string, args: Record<string, unknown>) => {
  const res = await t.request(`${base}/plugins/${path}`, { method: "POST", headers, json: { args } });
  return { res, result: res.status === 200 ? ((await res.json()) as ToolResult) : undefined };
};

/** Wszystkie węzły drzewa i ich teksty (do asercji bez zależności od układu). */
const flat = (n: UINode): UINode[] => [n, ...("children" in n && n.children ? n.children.flatMap(flat) : [])];
const texts = (n: UINode) =>
  flat(n).flatMap((x) =>
    (["title", "subtitle", "text", "label", "value"] as const).flatMap((k) => {
      const v = (x as Record<string, unknown>)[k];
      return typeof v === "string" ? [v] : [];
    }),
  );

describe("społeczności i nawigacja", () => {
  test("bez sesji: 401", async () => {
    expect((await t.request(`${base}/nav`)).status).toBe(401);
  });

  test("nawigacja pochodzi z zainstalowanych wtyczek", async () => {
    const u = await t.signUp();
    const nav = (await (await t.request(`${base}/nav`, { headers: u.headers })).json()) as CommunityNavItem[];
    expect(nav).toEqual([{ pluginId: "issues", icon: "🛠️", view: "list", label: "Zgłoszenia" }]);
    expect((await t.request("/api/communities/nie-ma", { headers: u.headers })).status).toBe(404);
  });

  test("nieznana społeczność, wtyczka albo widok: 404", async () => {
    const u = await t.signUp();
    expect((await t.request("/api/communities/nie-ma/plugins/issues/views/list", { headers: u.headers })).status).toBe(
      404,
    );
    expect((await view(u.headers, "nie-ma/views/list")).res.status).toBe(404);
    expect((await view(u.headers, "issues/views/nie-ma")).res.status).toBe(404);
    expect((await tool(u.headers, "issues/tools/nie-ma", {})).res.status).toBe(404);
  });
});

describe("wtyczka issues", () => {
  test("zgłoszenie -> lista -> szczegóły", async () => {
    const u = await t.signUp();
    const empty = await view(u.headers, "issues/views/list");
    expect(empty.node?.type).toBe("Screen");
    expect(flat(empty.node!).some((n) => n.type === "Empty")).toBe(true);

    const { res, result } = await tool(u.headers, "issues/tools/report", {
      title: "Nie świeci latarnia na Długiej",
      category: "lighting",
      description: "Przy numerze 12",
    });
    expect(res.status).toBe(200);
    expect(result?.toast).toContain("Dziękujemy");
    expect(result?.navigate?.view).toBe("detail");

    const list = await view(u.headers, "issues/views/list");
    expect(texts(list.node!)).toContain("Nie świeci latarnia na Długiej");

    const detail = await view(u.headers, `issues/views/detail?id=${result!.navigate!.params!.id}`);
    expect(texts(detail.node!)).toEqual(expect.arrayContaining(["Przy numerze 12", "Popierasz to zgłoszenie"]));
  });

  test("walidacja wejścia narzędzia: 400 z listą problemów", async () => {
    const u = await t.signUp();
    const { res } = await tool(u.headers, "issues/tools/report", { title: "x", category: "nie-ma" });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe("invalid_input");
  });

  test("podobne zgłoszenie w tej samej kategorii dokłada poparcie zamiast duplikatu", async () => {
    const alice = await t.signUp();
    const bob = await t.signUp();
    const first = await tool(alice.headers, "issues/tools/report", {
      title: "Latarnia Długa nie świeci",
      category: "lighting",
    });
    const second = await tool(bob.headers, "issues/tools/report", {
      title: "nie świeci latarnia",
      category: "lighting",
    });
    expect(second.result?.toast).toContain("już istnieje");
    expect(second.result?.navigate?.params?.id).toBe(first.result!.navigate!.params!.id!);

    const list = await view(bob.headers, "issues/views/list");
    const cards = flat(list.node!).filter((n) => n.type === "Card");
    expect(cards).toHaveLength(1);
    expect(texts(list.node!).join(" ")).toContain("2 osób popiera");
  });

  test("+1 jest idempotentne", async () => {
    const alice = await t.signUp();
    const bob = await t.signUp();
    const { result } = await tool(alice.headers, "issues/tools/report", {
      title: "Dziura w chodniku",
      category: "roads",
    });
    const id = result!.navigate!.params!.id!;
    await tool(bob.headers, "issues/tools/upvote", { id });
    await tool(bob.headers, "issues/tools/upvote", { id });
    const detail = await view(bob.headers, `issues/views/detail?id=${id}`);
    expect(texts(detail.node!)).toEqual(expect.arrayContaining(["2 osób popiera", "Popierasz to zgłoszenie"]));
  });

  test("izolacja: dane jednej społeczności nie są widoczne w innej", async () => {
    const u = await t.signUp();
    await tool(u.headers, "issues/tools/report", { title: "Sprawa z Krakowa", category: "other" });
    await t.request("/api/admin/communities", {
      method: "POST",
      headers: admin,
      json: { slug: "gdansk", name: "Gdańsk" },
    });
    const other = `/api/communities/gdansk/plugins/issues/views/list`;
    expect((await t.request(other, { headers: u.headers })).status).toBe(404); // nie zainstalowano

    await t.request("/api/admin/communities/gdansk/plugins", {
      method: "POST",
      headers: admin,
      json: { pluginId: "issues" },
    });
    const node = (await (await t.request(other, { headers: u.headers })).json()) as UINode;
    expect(texts(node)).not.toContain("Sprawa z Krakowa");
  });
});

const BENCHES = readFileSync(join(import.meta.dir, "../src/plugins/examples/benches.ts"), "utf8");

describe("wtyczki wgrywane w locie (admin)", () => {
  const upload = (source: string, headers: Record<string, string> = admin) =>
    t.request("/api/admin/plugins", { method: "POST", headers, json: { source } });
  const install = (pluginId: string) =>
    t.request(`/api/admin/communities/${DEMO_COMMUNITY.slug}/plugins`, {
      method: "POST",
      headers: admin,
      json: { pluginId },
    });

  test("bez tokenu albo ze złym tokenem: 401", async () => {
    expect((await upload(BENCHES, {})).status).toBe(401);
    expect((await upload(BENCHES, { authorization: "Bearer zly-token-zly-token-zly-token" })).status).toBe(401);
  });

  test("wgranie -> instalacja -> pojawia się w nawigacji i działa", async () => {
    const u = await t.signUp();
    const res = await upload(BENCHES);
    expect(res.status).toBe(201);
    expect(((await res.json()) as { id: string }).id).toBe("benches");
    expect((await install("benches")).status).toBe(201);

    const nav = (await (await t.request(`${base}/nav`, { headers: u.headers })).json()) as CommunityNavItem[];
    expect(nav.map((n) => n.pluginId)).toEqual(["issues", "benches"]);

    expect((await tool(u.headers, "benches/tools/report", { park: "Park Jordana" })).res.status).toBe(200);
    const { node } = await view(u.headers, "benches/views/main");
    expect(texts(node!)).toContain("Park Jordana");
  });

  test("wgrana wtyczka przetrwa restart (ładowana z bazy)", async () => {
    await upload(BENCHES);
    await install("benches");
    const u = await t.signUp();
    const restarted = createApp({ db: t.db, env: loadEnv(TEST_ENV) }).app;
    const res = await restarted.request(`${base}/nav`, { headers: u.headers });
    expect(((await res.json()) as CommunityNavItem[]).map((n) => n.pluginId)).toContain("benches");
  });

  test("odrzuca: błąd składni, zły manifest, nav bez widoku, nadpisanie wbudowanej", async () => {
    const bad = async (source: string) => {
      const res = await upload(source);
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

  test("wtyczka bez uprawnienia storage albo z błędnym UI: 500 plugin_error, API działa dalej", async () => {
    const u = await t.signUp();
    await upload(BENCHES.replace('id: "benches"', 'id: "nostore"').replace('permissions: ["storage"],', ""));
    await install("nostore");
    expect((await t.request(`${base}/plugins/nostore/views/main`, { headers: u.headers })).status).toBe(500);

    await upload(
      BENCHES.replace('id: "benches"', 'id: "badui"').replace(
        'ui.screen("Ławki w parkach", [',
        "ui.screen(42 as never, [",
      ),
    );
    await install("badui");
    const res = await t.request(`${base}/plugins/badui/views/main`, { headers: u.headers });
    expect(res.status).toBe(500);
    expect(((await res.json()) as { error: string }).error).toBe("plugin_error");

    expect((await view(u.headers, "issues/views/list")).res.status).toBe(200);
  });

  test("bez PLUGIN_ADMIN_TOKEN w env API administracyjne nie istnieje (404)", async () => {
    const noAdmin = await setupApi(
      (db) => createApp({ db, env: loadEnv({ ...TEST_ENV, PLUGIN_ADMIN_TOKEN: undefined }) }).app,
    );
    try {
      const res = await noAdmin.request("/api/admin/plugins", {
        method: "POST",
        headers: admin,
        json: { source: BENCHES },
      });
      expect(res.status).toBe(404);
    } finally {
      await noAdmin.close();
    }
  });
});
