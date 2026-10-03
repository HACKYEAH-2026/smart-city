import { afterEach, describe, expect, test } from "bun:test";
import type { NotificationInbox, Place } from "@app/shared";
import { RecordId } from "surrealdb";
import { TEST_ENV } from "../src/test-env";
import { DEMO_COMMUNITY } from "../src/test-routes";
import { type Ctx, setup, type TestUser } from "./helpers";

/**
 * Notifications: ctx.notify (users / near / everyone) → the resident's inbox, saved places and the current
 * location used for "near". The plugin never sees where residents are; the host picks the recipients.
 */
let t: Ctx;
afterEach(async () => {
  await t.close();
});

const base = `/api/communities/${DEMO_COMMUNITY.slug}`;
const platform = { authorization: `Bearer ${TEST_ENV.PLUGIN_ADMIN_TOKEN}` };

/** Kraków: Ruczaj (a boar sighting), a block 300 m away, and the Main Square (~5 km away). */
const SIGHTING = { lat: 50.0228, lng: 19.9025 };
const NEXT_BLOCK = { lat: 50.0255, lng: 19.9025 };
const MAIN_SQUARE = { lat: 50.0617, lng: 19.9373 };

/** A plugin whose only job is to call ctx.notify with what the test passes (`to` is validated by the host). */
const notifier = (id: string, permissions: string) => `
import type { PluginModule } from "@app/plugin-sdk";

const notifier: PluginModule = ({ definePlugin, ui, z }) =>
  definePlugin({
    id: "${id}",
    name: "Powiadomienia (test)",
    version: "1.0.0",
    permissions: ${permissions},
    nav: [{ view: "main", label: "Test" }],
    views: { main: () => ui.screen("Test", []), detail: () => ui.screen("Szczegóły", []) },
    tools: {
      send: {
        description: "Wyślij powiadomienie",
        input: z.object({
          to: z.unknown(),
          title: z.string(),
          tone: z.enum(["info", "success", "warning", "danger"]).optional(),
          view: z.string().optional(),
        }),
        handler: async (ctx, input) => {
          await ctx.notify({
            to: input.to as never, // unchecked on purpose: the tests send invalid audiences
            title: input.title,
            body: "Treść",
            ...(input.tone ? { tone: input.tone } : {}),
            ...(input.view ? { open: ui.navigate(input.view, { id: "42" }) } : {}),
          });
          return { toast: "Wysłano." };
        },
      },
    },
  });

export default notifier;
`;

const start = async (pluginId = "notifier", permissions = '["notify"]') => {
  t = await setup();
  await t.seed();
  const up = await t.request("/api/admin/plugins", {
    method: "POST",
    headers: platform,
    json: { source: notifier(pluginId, permissions) },
  });
  expect(up.status).toBe(201);
  const install = await t.request(`/api/admin/communities/${DEMO_COMMUNITY.slug}/plugins`, {
    method: "POST",
    headers: platform,
    json: { pluginId },
  });
  expect(install.status).toBe(201);
};

/** A signed-up resident who has opened the community (membership). */
const member = async () => {
  const u = await t.signUp();
  expect((await t.request(base, { headers: u.headers })).status).toBe(200);
  return u;
};
const send = (u: TestUser, args: Record<string, unknown>, pluginId = "notifier") =>
  t.request(`${base}/plugins/${pluginId}/tools/send`, { method: "POST", headers: u.headers, json: { args } });
const inbox = async (u: TestUser) => {
  const res = await t.request("/api/me/notifications", { headers: u.headers });
  expect(res.status).toBe(200);
  return (await res.json()) as NotificationInbox;
};
const titles = async (u: TestUser) => (await inbox(u)).items.map((n) => n.title);
const addPlace = (u: TestUser, place: { label: string; lat: number; lng: number }) =>
  t.request("/api/me/places", { method: "POST", headers: u.headers, json: place });
const shareLocation = (u: TestUser, point: { lat: number; lng: number }) =>
  t.request("/api/me/location", { method: "PUT", headers: u.headers, json: point });

describe("inbox", () => {
  test("no session 401", async () => {
    await start();
    expect((await t.request("/api/me/notifications")).status).toBe(401);
    expect((await t.request("/api/me/notifications/read", { method: "POST", json: {} })).status).toBe(401);
    expect((await t.request("/api/me/places")).status).toBe(401);
    expect((await t.request("/api/me/location", { method: "PUT", json: SIGHTING })).status).toBe(401);
  });

  test("users: the recipient gets it with a link to the plugin view; the sender and non-members do not", async () => {
    await start();
    const anna = await member();
    const bartek = await member();
    const stranger = await t.signUp({ place: null }); // not a member of the community
    expect(await inbox(anna)).toEqual({ items: [], unread: 0 });

    const res = await send(bartek, {
      to: { users: [anna.id, bartek.id, stranger.id] },
      title: "Dzik przy placu zabaw",
      tone: "danger",
      view: "detail",
    });
    expect(res.status).toBe(200);

    const box = await inbox(anna);
    expect(box.unread).toBe(1);
    expect(box.items).toEqual([
      {
        id: expect.any(String),
        community: { slug: DEMO_COMMUNITY.slug, name: DEMO_COMMUNITY.name },
        pluginId: "notifier",
        title: "Dzik przy placu zabaw",
        body: "Treść",
        tone: "danger",
        open: { type: "navigate", view: "detail", params: { id: "42" } },
        createdAt: expect.any(String),
        read: false,
      },
    ]);
    expect(Number.isNaN(Date.parse(box.items[0]!.createdAt))).toBe(false);
    expect(await titles(bartek)).toEqual([]);
    expect(await titles(stranger)).toEqual([]);
  });

  test("everyone: all members except the sender; newest first", async () => {
    await start();
    const [anna, bartek, city] = [await member(), await member(), await member()];
    await send(city, { to: { everyone: true }, title: "Ostrzeżenie: upał" });
    await send(city, { to: { everyone: true }, title: "Alarm: brak wody" });
    expect(await titles(anna)).toEqual(["Alarm: brak wody", "Ostrzeżenie: upał"]);
    expect(await titles(bartek)).toEqual(["Alarm: brak wody", "Ostrzeżenie: upał"]);
    expect(await titles(city)).toEqual([]);
    const [first] = (await inbox(anna)).items;
    expect(first).toMatchObject({ tone: "info", open: null });
  });

  test("mark read: chosen ids, then all; only your own notifications", async () => {
    await start();
    const [anna, bartek, city] = [await member(), await member(), await member()];
    await send(city, { to: { everyone: true }, title: "Pierwsze" });
    await send(city, { to: { everyone: true }, title: "Drugie" });
    const [newest] = (await inbox(anna)).items;

    const read = (u: TestUser, json: unknown) =>
      t.request("/api/me/notifications/read", { method: "POST", headers: u.headers, json });
    // Bartek cannot mark Anna's notification as read.
    expect(await (await read(bartek, { ids: [newest!.id] })).json()).toEqual({ unread: 2 });
    expect((await inbox(anna)).unread).toBe(2);

    expect(await (await read(anna, { ids: [newest!.id] })).json()).toEqual({ unread: 1 });
    expect((await inbox(anna)).items.map((n) => [n.title, n.read])).toEqual([
      ["Drugie", true],
      ["Pierwsze", false],
    ]);
    expect(await (await read(anna, {})).json()).toEqual({ unread: 0 });
    expect((await inbox(bartek)).unread).toBe(2);
    expect((await read(anna, { ids: "all" })).status).toBe(400);
  });
});

describe("near: saved places and the current location", () => {
  test("residents with a place within the radius get it; farther, stale or non-member ones do not", async () => {
    await start();
    const [reporter, near, far, walking, stale] = [
      await member(),
      await member(),
      await member(),
      await member(),
      await member(),
    ];
    const outsider = await t.signUp({ place: null }); // a place nearby, but not a member of the community
    expect((await addPlace(near, { label: "Dom", ...NEXT_BLOCK })).status).toBe(201);
    expect((await addPlace(far, { label: "Praca", ...MAIN_SQUARE })).status).toBe(201);
    expect((await addPlace(outsider, { label: "Dom", ...SIGHTING })).status).toBe(201);
    expect((await addPlace(reporter, { label: "Dom", ...SIGHTING })).status).toBe(201);
    expect((await shareLocation(walking, NEXT_BLOCK)).status).toBe(204);
    expect((await shareLocation(stale, NEXT_BLOCK)).status).toBe(204);
    await t.db.query("UPDATE $l SET at = time::now() - 2h;", { l: new RecordId("user_location", stale.id) });

    const res = await send(reporter, { to: { near: { ...SIGHTING, radius: 500 } }, title: "Uwaga, dzik!" });
    expect(res.status).toBe(200);

    expect(await titles(near)).toEqual(["Uwaga, dzik!"]);
    expect(await titles(walking)).toEqual(["Uwaga, dzik!"]);
    expect(await titles(far)).toEqual([]);
    expect(await titles(stale)).toEqual([]);
    expect(await titles(outsider)).toEqual([]);
    expect(await titles(reporter)).toEqual([]);
  });

  test("two places in range give one notification; stopping location sharing removes the position", async () => {
    await start();
    const [reporter, anna, bartek] = [await member(), await member(), await member()];
    await addPlace(anna, { label: "Dom", ...NEXT_BLOCK });
    await addPlace(anna, { label: "Szkoła dziecka", ...SIGHTING });
    await shareLocation(anna, SIGHTING);
    await shareLocation(bartek, SIGHTING);
    expect((await t.request("/api/me/location", { method: "DELETE", headers: bartek.headers })).status).toBe(204);

    await send(reporter, { to: { near: { ...SIGHTING, radius: 500 } }, title: "Uwaga, dzik!" });
    expect(await titles(anna)).toEqual(["Uwaga, dzik!"]);
    expect(await titles(bartek)).toEqual([]);
  });
});

describe("places", () => {
  test("add, list (own only), remove; someone else's place is 404", async () => {
    await start();
    const [anna, bartek] = [await member(), await member()];
    const res = await addPlace(anna, { label: "Dom", ...NEXT_BLOCK });
    expect(res.status).toBe(201);
    const place = (await res.json()) as Place;
    expect(place).toEqual({ id: expect.any(String), label: "Dom", ...NEXT_BLOCK });

    const list = async (u: TestUser) =>
      (await (await t.request("/api/me/places", { headers: u.headers })).json()) as Place[];
    expect(await list(anna)).toEqual([place]);
    expect(await list(bartek)).toEqual([]);

    const remove = (u: TestUser, id: string) =>
      t.request(`/api/me/places/${id}`, { method: "DELETE", headers: u.headers });
    expect((await remove(bartek, place.id)).status).toBe(404);
    expect((await remove(anna, place.id)).status).toBe(204);
    expect(await list(anna)).toEqual([]);
    expect((await remove(anna, place.id)).status).toBe(404);
  });

  test("the web app may PUT the location (CORS preflight allows the method)", async () => {
    await start();
    const res = await t.request("/api/me/location", {
      method: "OPTIONS",
      headers: { origin: "http://localhost:4173", "access-control-request-method": "PUT" },
    });
    expect(res.headers.get("access-control-allow-methods")?.split(",")).toContain("PUT");
  });

  test("validation: coordinates, label, at most 10 places", async () => {
    await start();
    const anna = await member();
    expect((await addPlace(anna, { label: "Dom", lat: 91, lng: 19.9 })).status).toBe(400);
    expect((await addPlace(anna, { label: "", ...SIGHTING })).status).toBe(400);
    expect((await shareLocation(anna, { lat: 50, lng: 181 })).status).toBe(400);
    for (const i of Array.from({ length: 10 }, (_, n) => n)) {
      expect((await addPlace(anna, { label: `Miejsce ${i}`, ...SIGHTING })).status).toBe(201);
    }
    const res = await addPlace(anna, { label: "Jedenaste", ...SIGHTING });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "too_many_places" });
  });
});

describe("plugin errors", () => {
  test("without the notify permission: 500 plugin_error, nothing sent", async () => {
    await start("silent", "[]");
    const [anna, bartek] = [await member(), await member()];
    const res = await send(anna, { to: { everyone: true }, title: "Nie wyjdzie" }, "silent");
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "plugin_error" });
    expect(await titles(bartek)).toEqual([]);
  });

  test("invalid notification (unknown view, bad audience, radius too big): 500 plugin_error", async () => {
    await start();
    const [anna, bartek] = [await member(), await member()];
    const bad = [
      { to: { everyone: true }, title: "x", view: "missing" },
      { to: { nobody: true }, title: "x" },
      { to: { near: { ...SIGHTING, radius: 100_000 } }, title: "x" },
      { to: { everyone: true }, title: "" },
    ];
    for (const args of bad) expect((await send(anna, args)).status).toBe(500);
    expect(await titles(bartek)).toEqual([]);
  });
});

describe("push to phones", () => {
  const token = (device: string) => `ExponentPushToken[${device}]`;
  const register = (u: TestUser, value: string) =>
    t.request("/api/me/push-tokens", { method: "POST", headers: u.headers, json: { token: value } });
  const unregister = (u: TestUser, value: string) =>
    t.request("/api/me/push-tokens", { method: "DELETE", headers: u.headers, json: { token: value } });
  const pushedTo = () => t.push.sent.map((m) => m.to).sort();

  test("no session 401; a token that is not an Expo push token 400", async () => {
    await start();
    expect((await t.request("/api/me/push-tokens", { method: "POST", json: { token: token("a") } })).status).toBe(401);
    const anna = await member();
    expect((await register(anna, "not-a-token")).status).toBe(400);
    expect((await register(anna, token("anna-phone"))).status).toBe(204);
  });

  test("every device of each recipient gets a push that opens the notification; not the sender or non-members", async () => {
    await start();
    const [anna, bartek] = [await member(), await member()];
    const stranger = await t.signUp({ place: null });
    await register(anna, token("anna-phone"));
    await register(anna, token("anna-tablet"));
    await register(bartek, token("bartek-phone"));
    await register(stranger, token("stranger-phone"));

    await send(bartek, { to: { everyone: true }, title: "Alarm: brak wody", tone: "danger", view: "detail" });
    expect(pushedTo()).toEqual([token("anna-phone"), token("anna-tablet")]);
    const [notification] = (await inbox(anna)).items;
    expect(t.push.sent.find((m) => m.to === token("anna-phone"))).toEqual({
      to: token("anna-phone"),
      title: "Alarm: brak wody",
      body: "Treść",
      data: {
        notificationId: notification!.id,
        community: DEMO_COMMUNITY.slug,
        pluginId: "notifier",
        open: { type: "navigate", view: "detail", params: { id: "42" } },
      },
      sound: "default",
      priority: "high",
      channelId: "alerts",
    });

    t.push.sent.length = 0;
    await send(anna, { to: { users: [bartek.id] }, title: "Dzięki za zgłoszenie" });
    expect(t.push.sent).toMatchObject([
      { to: token("bartek-phone"), priority: "default", channelId: "default", data: { open: null } },
    ]);
  });

  test("a token belongs to whoever registered it last; removing it stops pushes", async () => {
    await start();
    const [anna, bartek, city] = [await member(), await member(), await member()];
    await register(anna, token("shared-phone"));
    await register(bartek, token("shared-phone")); // Bartek signs in on Anna's old phone
    await send(city, { to: { users: [anna.id] }, title: "Do Anny" });
    expect(pushedTo()).toEqual([]);
    await send(city, { to: { users: [bartek.id] }, title: "Do Bartka" });
    expect(pushedTo()).toEqual([token("shared-phone")]);

    t.push.sent.length = 0;
    expect((await unregister(anna, token("shared-phone"))).status).toBe(204); // not hers: ignored
    await send(city, { to: { users: [bartek.id] }, title: "Nadal do Bartka" });
    expect(pushedTo()).toEqual([token("shared-phone")]);

    t.push.sent.length = 0;
    expect((await unregister(bartek, token("shared-phone"))).status).toBe(204);
    await send(city, { to: { users: [bartek.id] }, title: "Już bez telefonu" });
    expect(pushedTo()).toEqual([]);
    expect(await titles(bartek)).toContain("Już bez telefonu");
  });

  test("a device the push service reports as unregistered is forgotten", async () => {
    await start();
    const [anna, city] = [await member(), await member()];
    await register(anna, token("old-phone"));
    await register(anna, token("new-phone"));
    t.push.unregistered.add(token("old-phone"));
    await send(city, { to: { users: [anna.id] }, title: "Pierwsze" });
    await t.notifications.drain();

    t.push.sent.length = 0;
    await send(city, { to: { users: [anna.id] }, title: "Drugie" });
    expect(pushedTo()).toEqual([token("new-phone")]);
  });

  test("a failing push service does not fail the plugin; the notification is in the inbox", async () => {
    await start();
    const [anna, city] = [await member(), await member()];
    await register(anna, token("anna-phone"));
    t.push.failure = new Error("Expo is down");
    expect((await send(city, { to: { users: [anna.id] }, title: "Mimo awarii" })).status).toBe(200);
    await t.notifications.drain();
    expect(await titles(anna)).toEqual(["Mimo awarii"]);
  });
});
