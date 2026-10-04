import { describe, expect, test } from "bun:test";
import type { PluginUser } from "@app/plugin-sdk";
import { testPlugin, textsOf } from "@app/plugin-sdk/testing";
import groups from "./index";

const ola = { id: "ola", name: "Ola", role: "user" } as const;
const bartek = { id: "bartek", name: "Bartek", role: "user" } as const;
const celina = { id: "celina", name: "Celina", role: "user" } as const;
const dawid = { id: "dawid", name: "Dawid", role: "user" } as const;
const city = { id: "city", name: "Urząd", role: "admin" } as const;

type T = Awaited<ReturnType<typeof testPlugin>>;
const PRIVATE = "To jest grupa prywatna. Posty widzą tylko jej członkowie.";

const create = async (t: T, user: PluginUser, name: string, visibility: "public" | "private" = "public") =>
  ((await t.as(user).tool("createGroup", { name, visibility })).data as { id: string }).id;
const post = async (t: T, user: PluginUser, group: string, text: string) =>
  ((await t.as(user).tool("createPost", { group, text })).data as { id: string } | undefined)?.id;
const memberRow = async (t: T, group: string, user: string) =>
  (await t.db.members!.findMany({ where: { group, user } }))[0];
const seen = async (t: T, user: PluginUser, view: string, id: string) =>
  textsOf(await t.as(user).view(view, { id })).join("\n");

describe("groups: public", () => {
  test("anyone reads; joining is instant and needed to post, comment and like", async () => {
    const t = await testPlugin(groups, { user: ola });
    const g = await create(t, ola, "Rowerzyści z Krzyków");
    const first = (await post(t, ola, g, "Wycieczka w sobotę!"))!;

    expect(await seen(t, bartek, "group", g)).toContain("Wycieczka w sobotę!");
    expect((await t.as(bartek).tool("createPost", { group: g, text: "Hej" })).error).toBe(
      "Aby pisać w grupie, najpierw do niej dołącz.",
    );
    expect((await t.as(bartek).tool("comment", { post: first, text: "Super" })).error).toBe(
      "Aby pisać w grupie, najpierw do niej dołącz.",
    );

    expect((await t.as(bartek).tool("join", { group: g })).data).toEqual({ status: "member" });
    await t.as(bartek).tool("comment", { post: first, text: "Jadę!" });
    expect((await t.as(bartek).tool("like", { post: first })).data).toEqual({ liked: true });
    expect(await seen(t, celina, "group", g)).toContain("Polubienia: 1 · Komentarze: 1");
    expect((await t.as(bartek).tool("like", { post: first })).data).toEqual({ liked: false });

    const { data } = await t.tool("listGroups");
    expect(data).toEqual([expect.objectContaining({ name: "Rowerzyści z Krzyków", visibility: "public", members: 2 })]);
    expect(t.invalidInput("createGroup", { name: "x" })?.[0]?.path).toEqual(["name"]);
    expect(t.invalidInput("createPost", { group: g, text: "  " })?.[0]?.message).toBe("Wpis nie może być pusty");
  });
});

describe("groups: private", () => {
  test("posts are hidden from non-members; joining needs acceptance", async () => {
    const t = await testPlugin(groups, { user: ola });
    const g = await create(t, ola, "Rada osiedla", "private");
    const secret = (await post(t, ola, g, "Budżet na przyszły rok"))!;

    expect(await seen(t, bartek, "list", "")).toContain("Rada osiedla");
    const outside = await seen(t, bartek, "group", g);
    expect(outside).toContain(PRIVATE);
    expect(outside).toContain("Poproś o dołączenie");
    expect(outside).not.toContain("Budżet na przyszły rok");
    expect(await seen(t, bartek, "post", secret)).toContain(PRIVATE);
    expect((await t.as(bartek).tool("listPosts", { group: g })).error).toBe(PRIVATE);
    const stream = await t.as(bartek).stream("posts", { group: g });
    expect(await stream.next()).toEqual({ done: true, value: undefined });

    expect((await t.as(bartek).tool("join", { group: g })).data).toEqual({ status: "pending" });
    expect(await seen(t, bartek, "group", g)).toContain("Twoja prośba o dołączenie czeka na akceptację.");
    expect((await t.as(bartek).tool("createPost", { group: g, text: "Hej" })).error).toBeDefined();
    expect(await seen(t, ola, "group", g)).toContain("Członkowie (prośby: 1)");
    expect(await seen(t, ola, "members", g)).toContain("Bartek");
    expect((await t.as(celina).tool("respondRequest", { member: (await memberRow(t, g, "bartek"))!.id, accept: true })).error).toBe(
      "To mogą zrobić tylko moderatorzy grupy.",
    );

    await t.tool("respondRequest", { member: (await memberRow(t, g, "bartek"))!.id, accept: true });
    expect(await seen(t, bartek, "group", g)).toContain("Budżet na przyszły rok");
    expect(await post(t, bartek, g, "Dzięki za przyjęcie")).toBeDefined();

    await t.as(celina).tool("join", { group: g });
    await t.tool("respondRequest", { member: (await memberRow(t, g, "celina"))!.id, accept: false });
    expect(await memberRow(t, g, "celina")).toBeUndefined();

    await t.as(dawid).tool("join", { group: g });
    expect((await t.as(dawid).tool("leave", { group: g })).toast).toBe("Prośba anulowana.");
    expect(await memberRow(t, g, "dawid")).toBeUndefined();
  });

  test("switching a group to public accepts pending requests", async () => {
    const t = await testPlugin(groups, { user: ola });
    const g = await create(t, ola, "Rada osiedla", "private");
    await t.as(bartek).tool("join", { group: g });
    expect((await t.as(bartek).tool("updateGroup", { id: g, name: "Moja grupa" })).error).toBe(
      "To może zrobić tylko właściciel grupy.",
    );
    await t.tool("updateGroup", { id: g, name: "Rada osiedla (otwarta)", visibility: "public" });
    expect((await memberRow(t, g, "bartek"))?.status).toBe("member");
    expect(await seen(t, celina, "group", g)).toContain("Rada osiedla (otwarta)");
  });
});

describe("groups: roles and moderation", () => {
  test("the owner appoints moderators; moderators moderate members, but not other moderators", async () => {
    const t = await testPlugin(groups, { user: ola });
    const g = await create(t, ola, "Sąsiedzi");
    for (const u of [bartek, celina, dawid]) await t.as(u).tool("join", { group: g });
    const b = (await memberRow(t, g, "bartek"))!.id;
    const c = (await memberRow(t, g, "celina"))!.id;
    const d = (await memberRow(t, g, "dawid"))!.id;

    expect((await t.as(bartek).tool("setRole", { member: c, role: "moderator" })).error).toBe(
      "To może zrobić tylko właściciel grupy.",
    );
    await t.tool("setRole", { member: b, role: "moderator" });
    await t.tool("setRole", { member: c, role: "moderator" });

    expect((await t.as(bartek).tool("removeMember", { member: c })).error).toBe(
      "Moderatora może usunąć tylko właściciel grupy.",
    );
    expect((await t.as(bartek).tool("setRole", { member: c, role: "member" })).error).toBe(
      "To może zrobić tylko właściciel grupy.",
    );
    const owner = (await memberRow(t, g, "ola"))!.id;
    expect((await t.as(bartek).tool("removeMember", { member: owner })).error).toBe("Nie można usunąć właściciela grupy.");
    expect((await t.tool("leave", { group: g })).error).toBe("Właściciel nie może opuścić grupy. Może ją usunąć.");

    const spam = (await post(t, dawid, g, "Spam"))!;
    expect((await t.as(celina).tool("deletePost", { id: spam })).toast).toBe("Post usunięty.");
    expect((await t.as(bartek).tool("removeMember", { member: d, ban: true })).toast).toBe("Użytkownik zablokowany.");
    expect((await t.as(dawid).tool("join", { group: g })).error).toBe("Masz blokadę w tej grupie.");
    expect(await seen(t, dawid, "group", g)).toContain("Masz blokadę w tej grupie.");
    expect(await seen(t, bartek, "members", g)).toContain("Zablokowani (1)");
    await t.as(bartek).tool("unban", { member: d });
    expect((await t.as(dawid).tool("join", { group: g })).data).toEqual({ status: "member" });

    expect(await seen(t, dawid, "members", g)).toContain("Członkami zarządzają moderatorzy grupy.");
    expect((await t.as(dawid).tool("removeMember", { member: b })).error).toBe("To mogą zrobić tylko moderatorzy grupy.");
  });

  test("authors edit and delete their own posts and comments; moderators delete and pin anything", async () => {
    const t = await testPlugin(groups, { user: ola });
    const g = await create(t, ola, "Sąsiedzi");
    await t.as(bartek).tool("join", { group: g });
    await t.as(celina).tool("join", { group: g });
    const p = (await post(t, bartek, g, "Zgubiłem klucze"))!;

    expect((await t.as(celina).tool("editPost", { id: p, text: "hack" })).error).toBe("Możesz edytować tylko swoje posty.");
    await t.as(bartek).tool("editPost", { id: p, text: "Zgubiłem klucze przy sklepie" });
    expect(await seen(t, celina, "post", p)).toContain("Zgubiłem klucze przy sklepie (edytowano)");
    expect((await t.as(celina).tool("deletePost", { id: p })).error).toBe("Możesz usuwać tylko swoje posty.");
    expect((await t.as(celina).tool("pinPost", { id: p, pinned: true })).error).toBe("To mogą zrobić tylko moderatorzy grupy.");

    const comment = (await t.as(celina).tool("comment", { post: p, text: "Mam je!" })).data as { id: string };
    expect((await t.as(bartek).tool("deleteComment", { id: comment.id })).error).toBe("Możesz usuwać tylko swoje komentarze.");
    expect((await t.tool("deleteComment", { id: comment.id })).toast).toBe("Komentarz usunięty.");

    await t.tool("pinPost", { id: p, pinned: true });
    await post(t, celina, g, "Nowszy post");
    const feed = textsOf(await t.as(celina).view("group", { id: g }));
    expect(feed.indexOf("Zgubiłem klucze przy sklepie")).toBeLessThan(feed.indexOf("Nowszy post"));
    expect(feed).toContain("Przypięty");

    await t.as(bartek).tool("deletePost", { id: p });
    expect(await t.db.posts!.get(p)).toBeNull();
  });
});

describe("groups: app admins", () => {
  test("admins read private groups, join without acceptance and moderate everywhere", async () => {
    const t = await testPlugin(groups, { user: ola });
    const g = await create(t, ola, "Rada osiedla", "private");
    await t.as(bartek).tool("join", { group: g });
    await t.tool("respondRequest", { member: (await memberRow(t, g, "bartek"))!.id, accept: true });
    const p = (await post(t, bartek, g, "Niestosowny wpis"))!;
    const comment = (await t.as(bartek).tool("comment", { post: p, text: "Też niestosowny" })).data as { id: string };

    const admin = await seen(t, city, "group", g);
    expect(admin).toContain("Niestosowny wpis");
    expect(admin).toContain("Dołącz do grupy");
    expect(admin).toContain("Ustawienia grupy");
    expect(await seen(t, city, "members", g)).toContain("Bartek");

    expect((await t.as(city).tool("join", { group: g })).data).toEqual({ status: "member" });
    await t.as(city).tool("pinPost", { id: p, pinned: true });
    expect((await t.as(city).tool("deleteComment", { id: comment.id })).toast).toBe("Komentarz usunięty.");
    expect((await t.as(city).tool("deletePost", { id: p })).toast).toBe("Post usunięty.");
    expect((await t.as(city).tool("removeMember", { member: (await memberRow(t, g, "bartek"))!.id, ban: true })).toast).toBe(
      "Użytkownik zablokowany.",
    );

    await post(t, ola, g, "Zostanie usunięte z grupą");
    expect((await t.as(city).tool("deleteGroup", { id: g })).toast).toBe("Grupa usunięta.");
    expect(await t.db.groups!.count()).toBe(0);
    expect(await t.db.members!.count()).toBe(0);
    expect(await t.db.posts!.count()).toBe(0);
  });

  test("an owner's deleted account does not delete the group", async () => {
    const t = await testPlugin(groups, { user: ola });
    const g = await create(t, ola, "Sąsiedzi");
    await t.deleteUser("ola");
    expect(await t.db.groups!.count()).toBe(1);
    expect(await seen(t, city, "group", g)).toContain("Ustawienia grupy");
  });
});

describe("groups: live and dashboard", () => {
  test("posts stream: snapshot first, then new posts", async () => {
    const t = await testPlugin(groups, { user: ola });
    const g = await create(t, ola, "Sąsiedzi");
    await post(t, ola, g, "Pierwszy");
    const live = await t.as(bartek).stream("posts", { group: g });
    const snapshot = (await live.next()).value as { type: string; rows: { text: string }[] };
    expect(snapshot).toMatchObject({ type: "snapshot" });
    expect(snapshot.rows.map((p) => p.text)).toEqual(["Pierwszy"]);
    await post(t, ola, g, "Drugi");
    expect((await live.next()).value).toMatchObject({ type: "create", row: { text: "Drugi" } });
    await live.return?.();
  });

  test("widget: hidden without groups; latest posts and join requests for moderators", async () => {
    const t = await testPlugin(groups, { user: ola });
    expect(await t.dashboardWidget("feed")).toBeNull();
    const g = await create(t, ola, "Rada osiedla", "private");
    expect(textsOf((await t.dashboardWidget("feed"))!)).toContain("Nic nowego w Twoich grupach.");
    await post(t, ola, g, "Zebranie we wtorek");
    await t.as(bartek).tool("join", { group: g });
    const texts = textsOf((await t.dashboardWidget("feed"))!);
    expect(texts).toEqual(expect.arrayContaining(["Prośby o dołączenie: 1", "Rada osiedla", "Ola: Zebranie we wtorek"]));
    expect(await t.as(bartek).dashboardWidget("feed")).toBeNull();
  });
});
