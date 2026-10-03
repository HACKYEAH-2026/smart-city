import { describe, expect, test } from "bun:test";
import type { PluginUser } from "@app/plugin-sdk";
import { ForbiddenError, testPlugin } from "@app/plugin-sdk/testing";
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
