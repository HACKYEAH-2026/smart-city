import { describe, expect, test } from "bun:test";
import type { PluginUser } from "@app/plugin-sdk";
import { ForbiddenError, testPlugin, textsOf } from "@app/plugin-sdk/testing";
import events from "./index";

const city = { id: "city", name: "Urząd", role: "admin" } as const;
const anna = { id: "anna", name: "Anna", role: "user" } as const;
const bartek = { id: "bartek", name: "Bartek", role: "user" } as const;

type T = Awaited<ReturnType<typeof testPlugin>>;
const TODAY = new Date("2026-10-04T08:00:00Z");

const start = async () => {
  const t = await testPlugin(events, { user: anna });
  t.setNow(TODAY);
  return t;
};
const add = async (t: T, input: Record<string, unknown>) =>
  ((await t.as(city).tool("createEvent", input)).data as { id: string }).id;
const festyn = (t: T) =>
  add(t, {
    title: "Festyn sąsiedzki",
    startsAt: "2026-10-12 18:00",
    endsAt: "2026-10-12 20:00",
    location: "Park Południowy",
    description: "Muzyka, grill i zabawy dla dzieci.",
  });
const chat = async (t: T, user: PluginUser, event?: string) =>
  ((await t.as(user).tool("startChat", event ? { event } : {})).data as { id: string }).id;
const seen = async (t: T, user: PluginUser, view: string, params: Record<string, string> = {}) =>
  textsOf(await t.as(user).view(view, params)).join("\n");

describe("events: calendar", () => {
  test("admins add events; dates are read and shown in the community time zone", async () => {
    const t = await start();
    const id = await festyn(t);
    const winter = await add(t, { title: "Kiermasz świąteczny", startsAt: "2026-12-05 10:00" });

    expect((await t.db.events!.get(id))?.startsAt).toEqual(new Date("2026-10-12T16:00:00Z"));
    expect((await t.db.events!.get(winter))?.startsAt).toEqual(new Date("2026-12-05T09:00:00Z"));

    const detail = await seen(t, anna, "event", { id });
    for (const s of [
      "Festyn sąsiedzki",
      "poniedziałek, 12 października 2026, 18:00–20:00",
      "Park Południowy",
      "Muzyka, grill i zabawy dla dzieci.",
      "Zapytaj organizatora",
    ])
      expect(detail).toContain(s);
    expect(detail).not.toContain("Edytuj");
    expect(await seen(t, anna, "event", { id: winter })).toContain("sobota, 5 grudnia 2026, 10:00");

    const list = await seen(t, anna, "list");
    expect(list).toContain("Październik 2026");
    expect(list).toContain("Grudzień 2026");
    expect(list.indexOf("Festyn sąsiedzki")).toBeLessThan(list.indexOf("Kiermasz świąteczny"));

    const { data } = await t.tool("listEvents");
    expect(data).toEqual([
      expect.objectContaining({ id, when: "poniedziałek, 12 października 2026, 18:00–20:00" }),
      expect.objectContaining({ id: winter }),
    ]);
  });

  test("residents cannot manage events; validation of dates", async () => {
    const t = await start();
    await expect(t.tool("createEvent", { title: "Moje", startsAt: "2026-10-12 18:00" })).rejects.toBeInstanceOf(ForbiddenError);
    expect(await seen(t, anna, "new")).toContain("Wydarzenia dodają administratorzy.");
    expect(t.invalidInput("createEvent", { title: "Festyn", startsAt: "12.10.2026" })?.[0]?.message).toBe(
      "Podaj datę i godzinę w formacie RRRR-MM-DD GG:MM",
    );
    expect(t.invalidInput("createEvent", { title: "Festyn", startsAt: "2026-02-30 10:00" })).not.toBeNull();
    expect(t.invalidInput("createEvent", { title: "Festyn", startsAt: "2026-10-12T16:00:00Z" })).toBeNull();
    expect(
      (await t.as(city).tool("createEvent", { title: "Festyn", startsAt: "2026-10-12 18:00", endsAt: "2026-10-12 17:00" })).error,
    ).toBe("Koniec musi być po rozpoczęciu.");
  });

  test("past events move to their own list; events without an end stay upcoming for a few hours", async () => {
    const t = await start();
    await add(t, { title: "Sprzątanie parku", startsAt: "2026-10-04 09:00" });
    await festyn(t);

    t.setNow(new Date("2026-10-04T09:00:00Z")); // 11:00 in Warsaw, the clean-up started at 9:00
    expect(await seen(t, anna, "list")).toContain("Sprzątanie parku");
    t.setNow(new Date("2026-10-04T11:00:00Z")); // 13:00 in Warsaw
    expect(await seen(t, anna, "list")).not.toContain("Sprzątanie parku");
    const past = await seen(t, anna, "list", { past: "1" });
    expect(past).toContain("Sprzątanie parku");
    expect(past).not.toContain("Festyn sąsiedzki");
    expect((await t.tool("listEvents", { past: true })).data).toEqual([expect.objectContaining({ title: "Sprzątanie parku" })]);
  });

  test("admins edit and delete events", async () => {
    const t = await start();
    const id = await festyn(t);
    await t.as(city).tool("updateEvent", { id, title: "Festyn jesienny", startsAt: "2026-10-13 17:30", location: "Rynek" });
    const detail = await seen(t, anna, "event", { id });
    expect(detail).toContain("Festyn jesienny");
    expect(detail).toContain("wtorek, 13 października 2026, 17:30");
    expect(detail).toContain("Rynek");
    expect(await seen(t, city, "event", { id })).toContain("Edytuj");

    await expect(t.tool("deleteEvent", { id })).rejects.toBeInstanceOf(ForbiddenError);
    expect((await t.as(city).tool("deleteEvent", { id })).toast).toBe("Wydarzenie usunięte.");
    expect((await t.as(city).tool("deleteEvent", { id })).error).toBe("To wydarzenie nie istnieje.");
    expect(await seen(t, anna, "list")).toContain("Nie ma zaplanowanych wydarzeń.");
  });
});

describe("events: contacting the admin", () => {
  test("a resident asks about an event; admins see it as new, reply, and the resident sees the reply", async () => {
    const t = await start();
    const id = await festyn(t);
    const c = await chat(t, anna, id);
    expect(await chat(t, anna, id)).toBe(c);

    await t.tool("sendMessage", { conversation: c, text: "Czy można przyjść z psem?" });
    expect(await seen(t, city, "list")).toContain("Wiadomości od mieszkańców (nowe: 1)");
    const inbox = await seen(t, city, "inbox");
    expect(inbox).toContain("Festyn sąsiedzki");
    expect(inbox).toContain("Anna");
    expect(inbox).toContain("Nowa wiadomość");
    expect(await seen(t, city, "event", { id })).toContain("Pytania mieszkańców (1)");

    const thread = await seen(t, city, "conversation", { id: c });
    expect(thread).toContain("Mieszkaniec: Anna");
    expect(thread).toContain("Czy można przyjść z psem?");
    expect(await seen(t, city, "inbox")).not.toContain("Nowa wiadomość");

    await t.as(city).tool("sendMessage", { conversation: c, text: "Tak, na smyczy." });
    expect(await seen(t, anna, "list")).toContain("Moje wiadomości (nowe: 1)");
    expect(await seen(t, anna, "conversation", { id: c })).toContain("Tak, na smyczy.");
    expect(await seen(t, anna, "list")).not.toContain("(nowe:");
  });

  test("general chats; only the resident and admins have access; admins do not start chats", async () => {
    const t = await start();
    const general = await chat(t, anna);
    await t.tool("sendMessage", { conversation: general, text: "Kiedy następne zebranie?" });
    expect(await seen(t, city, "inbox")).toContain("Wiadomość do administratora");

    expect(await seen(t, bartek, "conversation", { id: general })).toContain("Nie masz dostępu do tej rozmowy.");
    expect((await t.as(bartek).tool("sendMessage", { conversation: general, text: "?" })).error).toBe(
      "Nie masz dostępu do tej rozmowy.",
    );
    expect(await seen(t, bartek, "inbox")).toContain("Nie ma jeszcze wiadomości.");
    expect((await t.as(city).tool("startChat", {})).error).toBe("Administratorzy odpowiadają w skrzynce wiadomości.");
    expect((await t.tool("startChat", { event: "nie-ma" })).error).toBe("To wydarzenie nie istnieje.");
  });

  test("conversation stream: snapshot, then new messages; outsiders get nothing", async () => {
    const t = await start();
    const c = await chat(t, anna);
    await t.tool("sendMessage", { conversation: c, text: "Dzień dobry" });
    const live = await t.as(city).stream("conversation", { conversation: c });
    const snapshot = (await live.next()).value as { type: string; rows: { text: string }[] };
    expect(snapshot.type).toBe("snapshot");
    expect(snapshot.rows.map((m) => m.text)).toEqual(["Dzień dobry"]);
    await t.as(city).tool("sendMessage", { conversation: c, text: "Dzień dobry, w czym pomóc?" });
    expect((await live.next()).value).toMatchObject({ type: "create", row: { text: "Dzień dobry, w czym pomóc?" } });
    await live.return?.();

    const outsider = await t.as(bartek).stream("conversation", { conversation: c });
    expect(await outsider.next()).toEqual({ done: true, value: undefined });
  });
});

describe("events: dashboard", () => {
  test("widget: hidden with nothing to show; next events and unread messages", async () => {
    const t = await start();
    expect(await t.dashboardWidget("upcoming")).toBeNull();
    await festyn(t);
    expect(textsOf((await t.dashboardWidget("upcoming"))!)).toEqual(
      expect.arrayContaining(["Wydarzenia", "Festyn sąsiedzki", "Kalendarz wydarzeń"]),
    );
    const c = await chat(t, anna);
    await t.tool("sendMessage", { conversation: c, text: "Pytanie" });
    expect(textsOf((await t.as(city).dashboardWidget("upcoming"))!)).toContain("Nowe wiadomości: 1");
  });
});
