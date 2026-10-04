import { describe, expect, test } from "bun:test";
import type { PluginUser } from "@app/plugin-sdk";
import { ForbiddenError, testPlugin, textsOf } from "@app/plugin-sdk/testing";
import market from "./index";

const anna = { id: "anna", name: "Anna", role: "user" } as const;
const bartek = { id: "bartek", name: "Bartek", role: "user" } as const;
const celina = { id: "celina", name: "Celina", role: "user" } as const;
const dawid = { id: "dawid", name: "Dawid", role: "user" } as const;
const city = { id: "city", name: "Urząd", role: "admin" } as const;

type T = Awaited<ReturnType<typeof testPlugin>>;
const post = async (t: T, user: PluginUser, input: Record<string, unknown>) =>
  ((await t.as(user).tool("createListing", input)).data as { id: string }).id;
const chatWith = async (t: T, user: PluginUser, listing: string) =>
  ((await t.as(user).tool("startChat", { listing })).data as { id: string }).id;
const seen = async (t: T, user: PluginUser, view: string, params: Record<string, string> = {}) =>
  textsOf(await t.as(user).view(view, params)).join("\n");

const start = async () => {
  const t = await testPlugin(market, { user: anna });
  const bike = await post(t, anna, { kind: "sell", title: "Rower dziecięcy", price: "150 zł", description: "Mało używany." });
  return { t, bike };
};

describe("market: listings", () => {
  test("posting with kind, price and photo; filtering by kind; AI listing", async () => {
    const t = await testPlugin(market, { user: anna });
    const photo = await t.files.fake();
    const bike = await post(t, anna, { kind: "sell", title: "Rower dziecięcy", price: "150 zł", photo });
    await post(t, anna, { kind: "give", title: "Kanapa za darmo" });
    expect(await t.files.isKept(photo)).toBe(true);

    const all = await seen(t, bartek, "list");
    expect(all).toContain("Rower dziecięcy");
    expect(all).toContain("Kanapa za darmo");
    const gifts = await seen(t, bartek, "list", { kind: "give" });
    expect(gifts).toContain("Kanapa za darmo");
    expect(gifts).not.toContain("Rower dziecięcy");

    const detail = await seen(t, bartek, "listing", { id: bike });
    for (const s of ["Sprzedam", "Aktywne", "150 zł", "Autor: Anna", "Zdjęcie: Rower dziecięcy", "Napisz do autora"])
      expect(detail).toContain(s);
    expect(detail).toContain("Płatność i przekazanie odbywają się poza aplikacją.");

    expect(t.invalidInput("createListing", { kind: "rent", title: "x" })?.map((i) => i.path[0])).toEqual([
      "kind",
      "title",
    ]);
    const { data } = await t.tool("listListings", { kind: "sell" });
    expect(data).toEqual([expect.objectContaining({ id: bike, kind: "sell", price: "150 zł", status: "active" })]);
  });

  test("the author reserves and closes; closed listings leave the public list; others cannot change it", async () => {
    const { t, bike } = await start();
    const withBartek = await chatWith(t, bartek, bike);
    const withCelina = await chatWith(t, celina, bike);

    expect((await t.as(bartek).tool("setStatus", { id: bike, status: "closed" })).error).toBe(
      "Możesz zmieniać tylko swoje ogłoszenia.",
    );
    const other = await post(t, anna, { kind: "exchange", title: "Wymienię książki" });
    const elsewhere = await chatWith(t, celina, other);
    expect((await t.tool("setStatus", { id: bike, status: "reserved", conversation: elsewhere })).error).toBe(
      "Ta rozmowa nie dotyczy tego ogłoszenia.",
    );

    expect((await t.tool("setStatus", { id: bike, status: "reserved", conversation: withBartek })).toast).toBe(
      "Oznaczono jako zarezerwowane.",
    );
    expect(await seen(t, bartek, "listing", { id: bike })).toContain("Zarezerwowane dla Ciebie.");
    const forCelina = await seen(t, celina, "listing", { id: bike });
    expect(forCelina).toContain("Zarezerwowane");
    expect(forCelina).not.toContain("dla Ciebie");
    expect(await seen(t, anna, "listing", { id: bike })).toContain("Zarezerwowane dla: Bartek");
    expect(await seen(t, celina, "list")).toContain("Rower dziecięcy");

    await t.tool("setStatus", { id: bike, status: "closed", conversation: withBartek });
    expect((await t.db.listings!.get(bike))?.partner).toBe("bartek");
    expect(await seen(t, celina, "list")).not.toContain("Rower dziecięcy");
    expect(await seen(t, anna, "mine")).toContain("Rower dziecięcy");
    expect((await t.as(dawid).tool("startChat", { listing: bike })).error).toBe("To ogłoszenie jest już zakończone.");
    expect((await t.as(celina).tool("sendMessage", { conversation: withCelina, text: "Szkoda!" })).error).toBeUndefined();

    await t.tool("setStatus", { id: bike, status: "active" });
    expect((await t.db.listings!.get(bike))?.partner ?? null).toBeNull();
    expect(await seen(t, celina, "list")).toContain("Rower dziecięcy");
  });

  test("the author or an admin removes a listing, its chats and flags go with it; others cannot", async () => {
    const { t, bike } = await start();
    const c = await chatWith(t, bartek, bike);
    await t.as(bartek).tool("sendMessage", { conversation: c, text: "Aktualne?" });
    await t.as(celina).tool("flag", { id: bike });

    expect((await t.as(bartek).tool("remove", { id: bike })).error).toBe("Możesz usuwać tylko swoje ogłoszenia.");
    expect((await t.as(city).tool("remove", { id: bike })).toast).toBe("Ogłoszenie usunięte.");
    expect(await t.db.listings!.count()).toBe(0);
    expect(await t.db.conversations!.count()).toBe(0);
    expect(await t.db.messages!.count()).toBe(0);
    expect(await t.db.flags!.count()).toBe(0);

    const own = await post(t, anna, { kind: "buy", title: "Kupię wózek" });
    expect((await t.tool("remove", { id: own })).toast).toBe("Ogłoszenie usunięte.");
  });
});

describe("market: chat", () => {
  test("anyone chats privately with the author; one conversation per person; outsiders have no access", async () => {
    const { t, bike } = await start();
    const c = await chatWith(t, bartek, bike);
    expect(await chatWith(t, bartek, bike)).toBe(c);
    expect((await t.tool("startChat", { listing: bike })).error).toBe("To Twoje ogłoszenie.");

    await t.as(bartek).tool("sendMessage", { conversation: c, text: "Czy 120 zł pasuje?" });
    await t.tool("sendMessage", { conversation: c, text: "Może być 130 zł." });
    const thread = await seen(t, anna, "conversation", { id: c });
    for (const s of ["Rozmowa z: Bartek", "Czy 120 zł pasuje?", "Może być 130 zł.", "Zarezerwuj dla: Bartek"])
      expect(thread).toContain(s);
    expect(await seen(t, bartek, "conversation", { id: c })).not.toContain("Zarezerwuj dla");

    expect(await seen(t, celina, "conversation", { id: c })).toContain("Nie masz dostępu do tej rozmowy.");
    expect((await t.as(celina).tool("sendMessage", { conversation: c, text: "?" })).error).toBe(
      "Nie masz dostępu do tej rozmowy.",
    );
    expect(await seen(t, anna, "chats")).toContain("Rozmowa z: Bartek");
    expect(await seen(t, bartek, "chats")).toContain("Rower dziecięcy");
  });

  test("conversation stream: snapshot, then new messages; outsiders get nothing", async () => {
    const { t, bike } = await start();
    const c = await chatWith(t, bartek, bike);
    await t.as(bartek).tool("sendMessage", { conversation: c, text: "Dzień dobry" });

    const live = await t.stream("conversation", { conversation: c });
    const snapshot = (await live.next()).value as { type: string; rows: { text: string }[] };
    expect(snapshot.type).toBe("snapshot");
    expect(snapshot.rows.map((m) => m.text)).toEqual(["Dzień dobry"]);
    await t.as(bartek).tool("sendMessage", { conversation: c, text: "Mogę odebrać jutro" });
    expect((await live.next()).value).toMatchObject({ type: "create", row: { text: "Mogę odebrać jutro" } });
    await live.return?.();

    const outsider = await t.as(celina).stream("conversation", { conversation: c });
    expect(await outsider.next()).toEqual({ done: true, value: undefined });
  });
});

describe("market: moderation", () => {
  test("residents flag listings; admins review, dismiss or remove", async () => {
    const { t, bike } = await start();
    expect((await t.tool("flag", { id: bike })).error).toBe("Nie możesz zgłosić własnego ogłoszenia.");
    await t.as(bartek).tool("flag", { id: bike, reason: "Podejrzana oferta" });
    await t.as(bartek).tool("flag", { id: bike, reason: "Podejrzana oferta" });
    expect(await t.db.flags!.count()).toBe(1);

    expect(await seen(t, bartek, "moderation")).toContain("Moderacja jest dostępna tylko dla administratorów.");
    expect(await seen(t, city, "list")).toContain("Moderacja (1)");
    const review = await seen(t, city, "moderation");
    expect(review).toContain("Rower dziecięcy");
    expect(review).toContain("Zgłoszenia: 1 · Podejrzana oferta");

    await expect(t.as(bartek).tool("dismissFlags", { id: bike })).rejects.toBeInstanceOf(ForbiddenError);
    expect((await t.as(city).tool("dismissFlags", { id: bike })).toast).toBe("Zgłoszenia odrzucone.");
    expect(await seen(t, city, "moderation")).toContain("Brak zgłoszonych ogłoszeń.");

    expect((await t.as(city).tool("setStatus", { id: bike, status: "closed" })).error).toBeUndefined();
  });
});

describe("market: dashboard", () => {
  test("widget shows the newest active listings; hidden when there are none", async () => {
    const t = await testPlugin(market, { user: bartek });
    expect(await t.dashboardWidget("latest")).toBeNull();
    await post(t, anna, { kind: "give", title: "Oddam meble" });
    const texts = textsOf((await t.dashboardWidget("latest"))!);
    expect(texts).toEqual(expect.arrayContaining(["Giełda sąsiedzka", "Oddam meble", "Zobacz wszystkie"]));
  });
});
