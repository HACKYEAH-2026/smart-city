import { describe, expect, test } from "bun:test";
import type { PluginUser } from "@app/plugin-sdk";
import { testPlugin, textsOf } from "@app/plugin-sdk/testing";
import help from "./index";

const helena = { id: "helena", name: "Helena", role: "user" } as const;
const bartek = { id: "bartek", name: "Bartek", role: "user" } as const;
const celina = { id: "celina", name: "Celina", role: "user" } as const;
const dawid = { id: "dawid", name: "Dawid", role: "user" } as const;
const city = { id: "city", name: "Urząd", role: "admin" } as const;

type T = Awaited<ReturnType<typeof testPlugin>>;
const PHONE = "tel. 600 100 200";

const start = async (title = "Wniesienie paczki na 4. piętro") => {
  const t = await testPlugin(help, { user: helena });
  const res = await t.tool("createRequest", { title, category: "carrying", when: "Dziś do 18:00", contact: PHONE });
  return { t, request: (res.data as { id: string }).id };
};
const create = async (t: T, title: string) =>
  ((await t.as(helena).tool("createRequest", { title })).data as { id: string }).id;
const offer = async (t: T, user: PluginUser, request: string) =>
  ((await t.as(user).tool("offer", { request })).data as { id: string }).id;
const accept = (t: T, helper: string, yes = true) => t.as(helena).tool("respond", { helper, accept: yes });
const seen = async (t: T, user: PluginUser, view: string, id: string) =>
  textsOf(await t.as(user).view(view, { id })).join("\n");

describe("help: requests", () => {
  test("a request is listed for neighbours; validation; AI listing has no contact details", async () => {
    const { t, request } = await start();
    expect(textsOf(await t.as(bartek).view("list"))).toContain("Wniesienie paczki na 4. piętro");
    expect(await seen(t, bartek, "request", request)).toContain("Na kiedy: Dziś do 18:00");
    expect(t.invalidInput("createRequest", { title: "x" })?.[0]?.path).toEqual(["title"]);

    const { data } = await t.as(bartek).tool("listRequests");
    expect(data).toEqual([expect.objectContaining({ id: request, title: "Wniesienie paczki na 4. piętro" })]);
    expect(JSON.stringify(data)).not.toContain("600 100 200");
  });

  test("the author or an admin deletes a request, chats go with it; others cannot", async () => {
    const { t, request } = await start();
    const helper = await offer(t, bartek, request);
    await t.as(bartek).tool("sendMessage", { helper, text: "Mogę o 17." });
    await t.tool("sendGroupMessage", { request, text: "Dziękuję!" });

    expect((await t.as(bartek).tool("deleteRequest", { id: request })).error).toBe("Możesz usuwać tylko swoje prośby.");
    expect((await t.as(city).tool("deleteRequest", { id: request })).toast).toBe("Prośba usunięta.");
    expect(await t.db.requests!.count()).toBe(0);
    expect(await t.db.helpers!.count()).toBe(0);
    expect(await t.db.threadMessages!.count()).toBe(0);
    expect(await t.db.groupMessages!.count()).toBe(0);

    const own = await create(t, "Zakupy w sobotę");
    expect((await t.tool("deleteRequest", { id: own })).toast).toBe("Prośba usunięta.");
  });
});

describe("help: volunteering", () => {
  test("private chat before offering; only the author and that volunteer have access", async () => {
    const { t, request } = await start();
    const opened = await t.as(bartek).tool("contact", { request });
    expect(opened.navigate?.view).toBe("thread");
    const helper = (opened.data as { id: string }).id;

    await t.as(bartek).tool("sendMessage", { helper, text: "Jak ciężka jest paczka?" });
    await t.tool("sendMessage", { helper, text: "Około 15 kg." });
    const thread = await seen(t, helena, "thread", helper);
    expect(thread).toContain("Rozmowa z: Bartek");
    expect(thread).toContain("Jak ciężka jest paczka?");
    expect(thread).toContain("Około 15 kg.");

    expect(await seen(t, dawid, "thread", helper)).toContain("Nie masz dostępu do tej rozmowy.");
    expect((await t.as(dawid).tool("sendMessage", { helper, text: "?" })).error).toBe("Nie masz dostępu do tej rozmowy.");

    expect(await offer(t, bartek, request)).toBe(helper);
    expect((await t.db.helpers!.get(helper))?.status).toBe("offered");
    expect((await t.tool("offer", { request })).error).toBe("Nie możesz zgłosić się do własnej prośby.");
    expect((await t.tool("contact", { request })).error).toBe("Nie możesz zgłosić się do własnej prośby.");
  });

  test("contact details stay hidden until the author accepts the volunteer", async () => {
    const { t, request } = await start();
    expect(await seen(t, bartek, "request", request)).not.toContain("600 100 200");
    expect(await seen(t, helena, "request", request)).toContain(PHONE);

    const b = await offer(t, bartek, request);
    const c = await offer(t, celina, request);
    expect(await seen(t, bartek, "request", request)).toContain(
      "Dane kontaktowe zobaczysz, gdy autor przyjmie Twoją pomoc.",
    );

    await accept(t, b);
    await accept(t, c, false);
    expect(await seen(t, bartek, "request", request)).toContain(`Kontakt: ${PHONE}`);
    expect(await seen(t, celina, "request", request)).not.toContain("600 100 200");
    expect(await seen(t, dawid, "request", request)).not.toContain("600 100 200");
    expect(await seen(t, city, "request", request)).not.toContain("600 100 200");
    expect((await t.as(celina).tool("offer", { request })).error).toBe("Autor nie przyjął Twojej oferty pomocy.");
  });

  test("the author accepts several volunteers; only they share the group chat", async () => {
    const { t, request } = await start();
    const b = await offer(t, bartek, request);
    const c = await offer(t, celina, request);
    const d = await offer(t, dawid, request);

    expect((await t.as(bartek).tool("respond", { helper: c, accept: true })).error).toBe(
      "Tylko autor prośby może przyjmować pomocników.",
    );
    await accept(t, b);
    await accept(t, c);
    await accept(t, d, false);

    expect((await t.as(bartek).tool("sendGroupMessage", { request, text: "Będę o 17." })).error).toBeUndefined();
    expect((await t.as(dawid).tool("sendGroupMessage", { request, text: "A ja?" })).error).toBe(
      "Czat grupowy jest dostępny dla autora i przyjętych pomocników.",
    );
    const group = await seen(t, celina, "group", request);
    expect(group).toContain("Uczestnicy: Helena, Bartek, Celina");
    expect(group).toContain("Będę o 17.");
    expect(group).toContain(`Kontakt: ${PHONE}`);
    expect(await seen(t, dawid, "group", request)).toContain(
      "Czat grupowy jest dostępny dla autora i przyjętych pomocników.",
    );

    const asking = (await t.as(city).tool("contact", { request })).data as { id: string };
    expect((await accept(t, asking.id)).error).toBe("Ta osoba nie zaoferowała jeszcze pomocy.");
  });
});

describe("help: completion and ranking", () => {
  test("done per volunteer or for everyone; points go to the ranking", async () => {
    const { t, request } = await start();
    const b = await offer(t, bartek, request);
    const c = await offer(t, celina, request);
    const d = await offer(t, dawid, request);
    await accept(t, b);
    await accept(t, c);

    expect((await t.as(bartek).tool("markDone", { request, helper: b })).error).toBe(
      "Tylko autor prośby może potwierdzić wykonanie.",
    );
    expect((await t.tool("markDone", { request, helper: d })).error).toBe(
      "Wykonanie można potwierdzić tylko przyjętemu pomocnikowi.",
    );
    expect((await t.tool("markDone", { request, helper: b })).toast).toBe("Dziękujemy! Pomocnik otrzymał punkty.");
    expect((await t.tool("ranking")).data).toEqual([expect.objectContaining({ name: "Bartek", points: 10, helps: 1 })]);

    await accept(t, d);
    expect((await t.tool("markDone", { request })).data).toEqual({ marked: 2 });
    expect((await t.db.requests!.get(request))?.status).toBe("done");
    expect((await t.tool("markDone", { request })).error).toBe("Nikt nie ma przyjętej pomocy do potwierdzenia.");
    expect((await t.as(city).tool("offer", { request })).error).toBe("Ta prośba jest już zakończona.");

    const second = await create(t, "Odbiór paczki z paczkomatu");
    await accept(t, await offer(t, bartek, second));
    await t.tool("markDone", { request: second });

    const { data } = await t.tool("ranking");
    expect((data as { name: string; points: number }[]).map((r) => `${r.name}: ${r.points}`)).toEqual([
      "Bartek: 20",
      "Celina: 10",
      "Dawid: 10",
    ]);
    const view = textsOf(await t.as(bartek).view("ranking"));
    expect(view).toEqual(expect.arrayContaining(["1. Bartek", "20 pkt · 2 pomoce", "2. Celina", "20"]));
  });
});

describe("help: live chat and dashboard", () => {
  test("thread stream: snapshot, then new messages; outsiders get nothing", async () => {
    const { t, request } = await start();
    const helper = await offer(t, bartek, request);
    await t.as(bartek).tool("sendMessage", { helper, text: "Dzień dobry" });

    const live = await t.stream("thread", { helper });
    const snapshot = (await live.next()).value as { type: string; rows: { text: string }[] };
    expect(snapshot.type).toBe("snapshot");
    expect(snapshot.rows.map((m) => m.text)).toEqual(["Dzień dobry"]);
    await t.as(bartek).tool("sendMessage", { helper, text: "Będę za 10 minut" });
    expect((await live.next()).value).toMatchObject({ type: "create", row: { text: "Będę za 10 minut" } });
    await live.return?.();

    const outsider = await t.as(dawid).stream("thread", { helper });
    expect(await outsider.next()).toEqual({ done: true, value: undefined });
  });

  test("widget shows other people's open requests", async () => {
    const { t } = await start();
    const neighbour = textsOf((await t.as(bartek).dashboardWidget("open"))!);
    expect(neighbour).toEqual(expect.arrayContaining(["1 prośba o pomoc", "Wniesienie paczki na 4. piętro"]));
    expect(textsOf((await t.dashboardWidget("open"))!)).toContain("Nikt teraz nie potrzebuje pomocy.");
  });
});
