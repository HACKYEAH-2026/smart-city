import { describe, expect, test } from "bun:test";
import type { PluginUser, UINode } from "@app/plugin-sdk";
import { ForbiddenError, testPlugin, textsOf } from "@app/plugin-sdk/testing";
import discussions from "./index";

const anna = { id: "anna", name: "Anna", role: "user" } as const;
const bartek = { id: "bartek", name: "Bartek", role: "user" } as const;
const moderator = { id: "city", name: "Urząd", role: "admin" } as const;

const start = async () => {
  const t = await testPlugin(discussions, { user: anna });
  const created = await t.tool("createDiscussion", { title: "Zieleń na Grzegórzkach", body: "Co sadzimy?" });
  return { t, discussion: (created.data as { id: string }).id };
};
const send = async (t: Awaited<ReturnType<typeof testPlugin>>, user: PluginUser, discussion: string, text: string) =>
  (await t.as(user).tool("sendMessage", { discussion, text })).data as { id: string } | undefined;

describe("discussions", () => {
  test("create, post, reply, list for AI", async () => {
    const { t, discussion } = await start();
    const first = await send(t, anna, discussion, "Proponuję lipy");
    const reply = await t.as(bartek).tool("sendMessage", { discussion, text: "Raczej klony", replyTo: first!.id });
    expect(reply.data).toBeDefined();
    expect((await t.db.messages!.findFirst({ where: { id: (reply.data as { id: string }).id } }))?.replyTo).toBe(
      first!.id,
    );
    const { data } = await t.tool("listDiscussions");
    expect(data).toEqual([expect.objectContaining({ title: "Zieleń na Grzegórzkach", messages: 2, locked: false })]);
  });

  test("validation: empty message, too short title, reply to a message from another discussion", async () => {
    const { t, discussion } = await start();
    expect(t.invalidInput("sendMessage", { discussion, text: "   " })?.[0]?.message).toBe(
      "Wiadomość nie może być pusta",
    );
    expect(t.invalidInput("createDiscussion", { title: "x" })).not.toBeNull();
    const other = (await t.tool("createDiscussion", { title: "Parkingi" })).data as { id: string };
    const elsewhere = await send(t, anna, other.id, "Za mało miejsc");
    const res = await t.tool("sendMessage", { discussion, text: "?", replyTo: elsewhere!.id });
    expect(res.error).toBe("Nie można odpowiedzieć na tę wiadomość.");
  });

  test("only the author edits a message; author or moderator deletes it", async () => {
    const { t, discussion } = await start();
    const msg = await send(t, anna, discussion, "Proponuję lipy");
    expect((await t.as(bartek).tool("editMessage", { id: msg!.id, text: "hack" })).error).toBe(
      "Możesz edytować tylko swoje wiadomości.",
    );
    expect((await t.as(moderator).tool("editMessage", { id: msg!.id, text: "hack" })).error).toBeDefined();
    await t.tool("editMessage", { id: msg!.id, text: "Proponuję lipy i klony" });
    const edited = await t.db.messages!.get(msg!.id);
    expect(edited).toMatchObject({ text: "Proponuję lipy i klony" });
    expect(edited?.editedAt).toBeInstanceOf(Date);

    expect((await t.as(bartek).tool("deleteMessage", { id: msg!.id })).error).toBe(
      "Możesz usuwać tylko swoje wiadomości.",
    );
    const theirs = await send(t, bartek, discussion, "Spam");
    await t.as(moderator).tool("deleteMessage", { id: theirs!.id });
    await t.tool("deleteMessage", { id: msg!.id });
    expect(await t.db.messages!.count()).toBe(0);
  });

  test("deleting a discussion: only its author or a moderator; messages go with it", async () => {
    const { t, discussion } = await start();
    await send(t, bartek, discussion, "Hej");
    expect((await t.as(bartek).tool("deleteDiscussion", { id: discussion })).error).toBe(
      "Możesz usuwać tylko swoje dyskusje.",
    );
    await t.tool("deleteDiscussion", { id: discussion });
    expect(await t.db.discussions!.count()).toBe(0);
    expect(await t.db.messages!.count()).toBe(0);

    const second = (await t.as(bartek).tool("createDiscussion", { title: "Psy w parku" })).data as { id: string };
    await t.as(moderator).tool("deleteDiscussion", { id: second.id });
    expect(await t.db.discussions!.count()).toBe(0);
  });

  test("moderators lock a discussion; users cannot post or lock, moderators still can post", async () => {
    const { t, discussion } = await start();
    await expect(t.tool("lockDiscussion", { id: discussion, locked: true })).rejects.toBeInstanceOf(ForbiddenError);
    await t.as(moderator).tool("lockDiscussion", { id: discussion, locked: true });
    expect((await t.as(bartek).tool("sendMessage", { discussion, text: "Halo?" })).error).toBe(
      "Ta dyskusja jest zamknięta.",
    );
    expect((await t.as(moderator).tool("sendMessage", { discussion, text: "Zamykam temat." })).error).toBeUndefined();
  });

  test("a deleted author's messages are removed (reference cascade)", async () => {
    const { t, discussion } = await start();
    await send(t, bartek, discussion, "Hej");
    await t.deleteUser("bartek");
    expect(await t.db.messages!.count()).toBe(0);
  });
});

/** Every node of a type in a UI tree, in order. */
const nodesOf = <T extends UINode["type"]>(node: UINode | null, type: T): Extract<UINode, { type: T }>[] => {
  if (!node) return [];
  const own = node.type === type ? [node as Extract<UINode, { type: T }>] : [];
  const children = "children" in node && node.children ? node.children.flatMap((c) => nodesOf(c, type)) : [];
  return [...own, ...children];
};
const at = (minute: number) => new Date(Date.UTC(2026, 9, 4, 8, minute));

describe("discussions: dashboard widget and views", () => {
  test("widget without discussions: an invitation to start one; the header opens them all", async () => {
    const t = await testPlugin(discussions, { user: anna });
    const widget = await t.dashboardWidget("recent");
    expect(widget).toMatchObject({
      title: "Dyskusje",
      icon: "chat",
      link: { label: "Wszystkie", action: { type: "navigate", view: "list" } },
      onPress: { type: "navigate", view: "list" },
    });
    expect(widget).not.toHaveProperty("subtitle");
    expect(textsOf(widget!)).toEqual(["Dyskusje", "Nikt jeszcze nie zaczął rozmowy.", "Nowa dyskusja"]);
    expect(nodesOf(widget, "Button")[0]?.action).toEqual({ type: "navigate", view: "new" });
  });

  test("widget: the 3 latest by activity with the last message, new ones since the last visit", async () => {
    const t = await testPlugin(discussions, { user: anna });
    const create = async (minute: number, title: string, body?: string) => {
      t.setNow(at(minute));
      return ((await t.tool("createDiscussion", { title, ...(body ? { body } : {}) })).data as { id: string }).id;
    };
    const green = await create(0, "Zieleń przy Rondzie", "Co sadzimy?");
    t.setNow(at(1));
    await send(t, anna, green, "Proponuję lipy");
    await create(2, "Parking pod blokiem");
    await create(3, "Psy w parku", "Gdzie zrobić wybieg?");
    await create(4, "Festyn sąsiedzki");

    // Bartek never opened discussions: everything is new; only the 3 latest show.
    const first = await t.as(bartek).dashboardWidget("recent");
    expect(first).toMatchObject({ subtitle: "4 z nowymi wpisami" });
    expect(nodesOf(first, "Activity").map((a) => [a.title, a.text, a.person, a.unread])).toEqual([
      ["Festyn sąsiedzki", "Nowa dyskusja", "Anna", true],
      ["Psy w parku", "Gdzie zrobić wybieg?", "Anna", true],
      ["Parking pod blokiem", "Nowa dyskusja", "Anna", true],
    ]);

    // Both open discussions; Bartek replies in the oldest one, which moves to the top as his own.
    t.setNow(at(5));
    await t.view("list");
    await t.as(bartek).view("thread", { id: green });
    t.setNow(at(6));
    await send(t, bartek, green, "Raczej klony");
    t.setNow(at(7));
    await t.as(bartek).view("thread", { id: green }); // the app refreshes the view after a tool call

    const his = await t.as(bartek).dashboardWidget("recent");
    expect(his).toMatchObject({ subtitle: "4 dyskusje" });
    expect(nodesOf(his, "Activity")[0]).toEqual({
      type: "Activity",
      title: "Zieleń przy Rondzie",
      text: "Ty: Raczej klony",
      person: "Bartek",
      at: at(6).toISOString(),
      onPress: { type: "navigate", view: "thread", params: { id: green } },
    });
    const hers = await t.dashboardWidget("recent");
    expect(hers).toMatchObject({ subtitle: "1 z nowymi wpisami" });
    expect(nodesOf(hers, "Activity").map((a) => [a.text, a.unread ?? false])).toEqual([
      ["Bartek: Raczej klony", true],
      ["Nowa dyskusja", false],
      ["Gdzie zrobić wybieg?", false],
    ]);
  });

  test("an administrator's message is marked for the accent colour in the chat", async () => {
    const { t, discussion } = await start();
    t.setNow(at(1));
    await send(t, bartek, discussion, "Posadzimy w jesieni");
    t.setNow(at(2));
    await t.as(moderator).tool("sendMessage", { discussion, text: "Dziękujemy, sadzonki są zamówione." });
    const thread = await t.view("thread", { id: discussion });
    expect(nodesOf(thread, "Chat")[0]?.messages).toEqual([
      { id: expect.any(String), person: "Bartek", text: "Posadzimy w jesieni", at: at(1).toISOString() },
      {
        id: expect.any(String),
        person: "Urząd",
        text: "Dziękujemy, sadzonki są zamówione.",
        at: at(2).toISOString(),
        admin: true,
      },
    ]);
  });

  test("thread: the opening post, a chat with my messages marked, the message field; locking from the header", async () => {
    const { t, discussion } = await start();
    t.setNow(at(1));
    await send(t, bartek, discussion, "Raczej klony");
    t.setNow(at(2));
    const mine = await send(t, anna, discussion, "Lipy dają cień");
    await t.tool("editMessage", { id: mine!.id, text: "Lipy dają więcej cienia" });
    const thread = await t.view("thread", { id: discussion });
    expect(nodesOf(thread, "Activity").map((a) => [a.title, a.text])).toEqual([["Ty", "Co sadzimy?"]]);
    expect(nodesOf(thread, "Chat")[0]?.messages).toEqual([
      { id: expect.any(String), person: "Bartek", text: "Raczej klony", at: at(1).toISOString() },
      {
        id: mine!.id,
        person: "Anna",
        text: "Lipy dają więcej cienia",
        at: at(2).toISOString(),
        mine: true,
        note: "edytowano",
      },
    ]);
    expect(nodesOf(thread, "Composer")[0]).toMatchObject({
      name: "text",
      label: "Twoja wiadomość",
      sendLabel: "Wyślij",
      submit: { type: "tool", tool: "sendMessage", args: { discussion } },
    });
    expect(thread).not.toHaveProperty("actions"); // residents do not moderate

    const moderated = await t.as(moderator).view("thread", { id: discussion });
    expect(moderated).toMatchObject({
      actions: [
        {
          icon: "lock",
          variant: "icon",
          label: "Zamknij dyskusję",
          action: { type: "tool", tool: "lockDiscussion", args: { id: discussion, locked: true } },
          confirm: { title: "Zamknąć dyskusję?", confirmLabel: "Zamknij" },
        },
      ],
    });

    await t.as(moderator).tool("lockDiscussion", { id: discussion, locked: true });
    const locked = await t.as(bartek).view("thread", { id: discussion });
    expect(textsOf(locked)).toContain("Dyskusja jest zamknięta. Nowe wiadomości piszą tylko moderatorzy.");
    expect(nodesOf(locked, "Composer")).toEqual([]);
    expect(nodesOf(await t.dashboardWidget("recent"), "Activity")[0]?.text).toBe(
      "Zamknięta · Ty: Lipy dają więcej cienia",
    );

    const reopen = await t.as(moderator).view("thread", { id: discussion });
    expect(nodesOf(reopen, "Composer")).toHaveLength(1);
    expect(reopen).toMatchObject({
      actions: [{ icon: "unlock", label: "Otwórz dyskusję", action: { args: { id: discussion, locked: false } } }],
    });
    expect(reopen).not.toHaveProperty("actions.0.confirm");
  });

  test("thread without a description or messages: no opening post, an invitation to write", async () => {
    const t = await testPlugin(discussions, { user: anna });
    const id = ((await t.tool("createDiscussion", { title: "Parking pod blokiem" })).data as { id: string }).id;
    const thread = await t.view("thread", { id });
    expect(nodesOf(thread, "Activity")).toEqual([]);
    expect(textsOf(thread)).toContain("Nie ma jeszcze wiadomości. Napisz pierwszą.");
  });

  test("list: a card per discussion with the last message, when, how many people and messages, what is new", async () => {
    const t = await testPlugin(discussions, { user: anna });
    const create = async (minute: number, title: string, body?: string) => {
      t.setNow(at(minute));
      return ((await t.tool("createDiscussion", { title, ...(body ? { body } : {}) })).data as { id: string }).id;
    };
    const green = await create(0, "Zieleń przy Rondzie", "Co sadzimy?");
    t.setNow(at(1));
    await send(t, bartek, green, "Proponuję lipy");
    const quiet = await create(2, "Psy w parku", "Gdzie zrobić wybieg?");
    await t.as(moderator).tool("lockDiscussion", { id: quiet, locked: true });
    t.setNow(at(3));
    await t.view("list");
    const reply = async (minute: number, user: PluginUser, text: string) => {
      t.setNow(at(minute));
      await send(t, user, green, text);
    };
    await reply(4, bartek, "Raczej klony");
    await reply(5, anna, "Może jedno i drugie");
    await reply(6, moderator, "Zapiszę na zebranie");

    t.setNow(at(7));
    const cards = nodesOf(await t.view("list"), "Card");
    expect(cards).toEqual([
      {
        type: "Card",
        title: "Zieleń przy Rondzie",
        subtitle: "Urząd: Zapiszę na zebranie",
        meta: [
          { at: at(6).toISOString() },
          { text: "3 osoby", icon: "people" },
          { text: "4 wiadomości", icon: "chat" },
        ],
        unread: true,
        count: 2,
        onPress: { type: "navigate", view: "thread", params: { id: green } },
      },
      {
        type: "Card",
        title: "Psy w parku",
        subtitle: "Gdzie zrobić wybieg?",
        tags: [{ text: "Zamknięta", icon: "lock", tone: "neutral" }],
        meta: [
          { at: at(2).toISOString() },
          { text: "1 osoba", icon: "people" },
          { text: "0 wiadomości", icon: "chat" },
        ],
        onPress: { type: "navigate", view: "thread", params: { id: quiet } },
      },
    ]);
    expect(nodesOf(await t.as(bartek).view("list"), "Card")[0]).toMatchObject({
      subtitle: "Urząd: Zapiszę na zebranie",
      unread: true,
    });
    expect(nodesOf(await t.view("list"), "Card")[0]).not.toHaveProperty("unread");
  });

  test("starting a discussion from the app: the header's button opens a form that calls createDiscussion", async () => {
    const t = await testPlugin(discussions, { user: anna });
    const list = await t.view("list");
    expect(list).toMatchObject({
      actions: [{ label: "Nowa dyskusja", icon: "plus", action: { type: "navigate", view: "new" } }],
    });
    expect(nodesOf(list, "Fab")).toEqual([]);
    expect(nodesOf(list, "Empty")).toHaveLength(1);
    const form = nodesOf(await t.view("new"), "Form")[0];
    expect(form?.submit).toEqual({ type: "tool", tool: "createDiscussion" });
    expect(nodesOf(form ?? null, "TextInput").map((i) => i.name)).toEqual(["title", "body"]);
  });
});

describe("discussions: live streams", () => {
  type Event = {
    type: string;
    rows?: { text: string; author: { name: string } }[];
    row?: { id: string; text: string };
    id?: string;
  };
  const next = async (it: AsyncIterator<unknown>) => (await it.next()).value as Event;

  test("messages: snapshot first, then new, edited and deleted messages of this discussion only", async () => {
    const { t, discussion } = await start();
    await send(t, anna, discussion, "Pierwsza");
    const other = (await t.tool("createDiscussion", { title: "Inny temat" })).data as { id: string };

    const live = await t.as(bartek).stream("messages", { discussion });
    const snapshot = await next(live);
    expect(snapshot.type).toBe("snapshot");
    expect(snapshot.rows?.map((m) => `${m.author.name}: ${m.text}`)).toEqual(["Anna: Pierwsza"]);

    await send(t, anna, other.id, "Gdzie indziej");
    const created = await send(t, bartek, discussion, "Druga");
    expect(await next(live)).toMatchObject({
      type: "create",
      row: { id: created!.id, text: "Druga", author: { name: "Bartek" } },
    });

    await t.as(bartek).tool("editMessage", { id: created!.id, text: "Druga (poprawiona)" });
    expect(await next(live)).toMatchObject({ type: "update", row: { text: "Druga (poprawiona)" } });

    await t.as(moderator).tool("deleteMessage", { id: created!.id });
    expect(await next(live)).toEqual({ type: "delete", id: created!.id });
    await live.return?.();
  });

  test("deleting the discussion streams the deletion of its messages; unknown discussion ends at once", async () => {
    const { t, discussion } = await start();
    const msg = await send(t, anna, discussion, "Pierwsza");
    const live = await t.stream("messages", { discussion });
    await next(live);
    await t.tool("deleteDiscussion", { id: discussion });
    expect(await next(live)).toEqual({ type: "delete", id: msg!.id });
    await live.return?.();

    const none = await t.stream("messages", { discussion: "nie-ma" });
    expect(await none.next()).toEqual({ done: true, value: undefined });
  });

  test("discussions list stream reacts to new discussions and activity", async () => {
    const { t, discussion } = await start();
    const live = await t.stream("discussions");
    expect((await next(live)).rows?.length).toBe(1);
    await t.as(bartek).tool("createDiscussion", { title: "Psy w parku" });
    expect(await next(live)).toMatchObject({ type: "create", row: { title: "Psy w parku" } });
    t.setNow(new Date(Date.UTC(2026, 0, 2)));
    await send(t, anna, discussion, "Podbijam");
    expect(await next(live)).toMatchObject({ type: "update", row: { id: discussion } });
    await live.return?.();
  });
});
