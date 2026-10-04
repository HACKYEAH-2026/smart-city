import { describe, expect, test } from "bun:test";
import type { FileId, GeoLocation, PluginUser, ToolResult, UINode } from "@app/plugin-sdk";
import { ForbiddenError, testPlugin, textsOf } from "@app/plugin-sdk/testing";
import issues from "./index";

const alice: PluginUser = { id: "alice", name: "Alice", role: "user" };
const bob: PluginUser = { id: "bob", name: "Bob", role: "user" };
const carol: PluginUser = { id: "carol", name: "Carol", role: "user" };
const dave: PluginUser = { id: "dave", name: "Dave", role: "user" };
const admin: PluginUser = { id: "urzad", name: "Urząd", role: "admin" };
const admin2: PluginUser = { id: "zarzad", name: "Zarząd", role: "admin" };

const oldTownAddress: GeoLocation = { lat: 50.06274, lng: 19.93986, address: "Floriańska 15, 31-019 Kraków" };

type Harness = Awaited<ReturnType<typeof testPlugin>>;
type Acting = Pick<Harness, "tool" | "view">;

const setup = async (user: PluginUser = alice) => {
  const plugin = await testPlugin(issues, { user });
  await plugin.install();
  return plugin;
};

/** The report's id from a tool result that opened it (sent, joined). */
const idOf = (result: ToolResult) => {
  const id = result.navigate?.params?.id;
  if (!id) throw new Error(`no report id in ${JSON.stringify(result)}`);
  return id;
};
const report = async (as: Acting, title: string, extra: Record<string, unknown> = {}) =>
  idOf(await as.tool("report", { title, ...extra }));

const flat = (node: UINode): UINode[] => [
  node,
  ...("children" in node && node.children ? node.children.flatMap(flat) : []),
];
const isType =
  <T extends UINode["type"]>(type: T) =>
  (node: UINode): node is Extract<UINode, { type: T }> =>
    node.type === type;
const nodes = <T extends UINode["type"]>(view: UINode, type: T) => flat(view).filter(isType(type));
const cards = (view: UINode) => nodes(view, "Card");
const titles = (view: UINode) => cards(view).map((c) => c.title);
const tabLabels = (view: UINode) => nodes(view, "Tabs").flatMap((tabs) => tabs.options.map((o) => o.label));
const buttons = (view: UINode) => nodes(view, "Button").map((b) => b.label);
const hasText = (view: UINode, text: string) => JSON.stringify(view).includes(text);

/** The AI "sees" the same problem when the text mentions a lamp ("latarnia"). */
const lampsAreTheSame = (plugin: Harness) =>
  plugin.ai.mockSimilar((query, candidates) =>
    query.text.toLowerCase().includes("latarnia")
      ? candidates.slice(0, 1).map((item) => ({ item, score: 0.9, reason: "Ta sama latarnia" }))
      : [],
  );

const configure = (plugin: Harness, settings: Record<string, unknown>) => plugin.as(admin).tool("configure", settings);

describe("issues: reporting", () => {
  test("photo step → form → report: photos kept, the author's own vote, the sent screen and the details", async () => {
    const plugin = await setup();
    const step = await plugin.view("new");
    expect(step).toMatchObject({ title: "Zrób zdjęcie" });
    expect(nodes(step, "ImagePicker")).toEqual([
      expect.objectContaining({ name: "photos", label: "Pokaż problem z bliska — do 3 zdjęć", max: 3 }),
    ]);
    expect(nodes(step, "Form")[0]).toMatchObject({ submitLabel: "Dalej", submit: { tool: "photos" } });
    expect(nodes(step, "Button")).toEqual([
      expect.objectContaining({
        label: "Pomiń zdjęcie",
        action: { type: "navigate", view: "form", replace: true },
      }),
    ]);

    const cover = await plugin.files.fake();
    const photos = [cover, await plugin.files.fake()];
    const next = await plugin.tool("photos", { photos });
    expect(next.navigate).toEqual({
      type: "navigate",
      view: "form",
      params: { photos: JSON.stringify(photos) },
      replace: true,
    });
    const form = await plugin.view("form", next.navigate?.params);
    expect(nodes(form, "ImagePicker")[0]?.value?.map((p) => p.file)).toEqual(photos);
    expect(nodes(form, "Switch")).toEqual([expect.objectContaining({ name: "anonymous", label: "Zgłoś anonimowo" })]);
    expect(nodes(form, "Form")[0]).toMatchObject({ submitLabel: "Wyślij zgłoszenie", submit: { tool: "report" } });

    const res = await plugin.tool("report", { title: "Nie świeci lampa", description: "Klatka A", photos });
    expect(res.navigate).toMatchObject({ view: "sent", replace: true });
    const id = idOf(res);
    expect(await plugin.files.isKept(cover)).toBe(true);
    expect(await plugin.db.photos?.count()).toBe(2);
    expect(await plugin.db.votes?.count({ where: { issue: id, voter: alice.id } })).toBe(1);

    const sent = await plugin.view("sent", { id });
    expect(textsOf(sent)).toEqual(
      expect.arrayContaining([
        "Dziękujemy za zgłoszenie",
        "Administratorzy miejsca już je widzą. Powiadomimy Cię o odpowiedzi administratora.",
        "Nie świeci lampa",
        "Udostępnij sąsiadom",
        "Wróć do pulpitu",
      ]),
    );
    expect(nodes(sent, "Button").find((b) => b.label === "Wróć do pulpitu")?.action).toEqual({
      type: "app",
      screen: "dashboard",
    });

    const detail = await plugin.view("detail", { id });
    expect(nodes(detail, "Gallery")[0]?.items).toHaveLength(2);
    expect(nodes(detail, "Button").find((b) => b.label === "Podbite 1")).toMatchObject({ pressed: true });
    expect(textsOf(detail)).toEqual(expect.arrayContaining(["Alice", "Klatka A", "Historia", "Zgłoszone"]));
  });

  test("required photo: no skip, and both the photo step and the report refuse without one", async () => {
    const plugin = await setup();
    await configure(plugin, { requirePhoto: true });
    expect(buttons(await plugin.view("new"))).not.toContain("Pomiń zdjęcie");
    expect((await plugin.tool("photos", {})).error).toBe("Dodaj co najmniej jedno zdjęcie.");
    expect((await plugin.tool("report", { title: "Bez zdjęcia" })).error).toBe(
      "W tym miejscu zgłoszenie musi mieć zdjęcie.",
    );
    expect(await plugin.db.issues?.count()).toBe(0);
    expect(
      (await plugin.tool("report", { title: "Ze zdjęciem", photos: [await plugin.files.fake()] })).navigate?.view,
    ).toBe("sent");
  });

  test("anonymous: members never see the name, the author and admins do; off = no switch and refused", async () => {
    const plugin = await setup();
    const id = await report(plugin, "Więcej ławek w parku", { anonymous: true });
    const asBob = await plugin.as(bob).view("detail", { id });
    expect(textsOf(asBob)).toContain("Zgłoszenie anonimowe");
    expect(hasText(asBob, "Alice")).toBe(false);
    expect(textsOf(await plugin.view("detail", { id }))).toContain("Alice (anonimowo)");
    expect(textsOf(await plugin.as(admin).view("adminDetail", { id }))).toContain("Alice (anonimowo)");

    await configure(plugin, { allowAnonymous: false });
    expect(nodes(await plugin.view("form"), "Switch")).toEqual([]);
    expect((await plugin.tool("report", { title: "Anonimowo", anonymous: true })).error).toBe(
      "Zgłoszenia anonimowe są wyłączone w tym miejscu.",
    );
  });

  test("input validation", async () => {
    const plugin = await setup();
    expect(plugin.invalidInput("report", { title: "x" })?.[0]?.message).toBe("Opisz problem w kilku słowach");
    const four = [
      await plugin.files.fake(),
      await plugin.files.fake(),
      await plugin.files.fake(),
      await plugin.files.fake(),
    ];
    expect(plugin.invalidInput("report", { title: "Latarnia", photos: four })?.[0]?.message).toBe(
      "Dodaj najwyżej 3 zdjęcia",
    );
    expect(plugin.invalidInput("report", { title: "Latarnia", photos: ["nie-plik"] })?.[0]?.path).toEqual([
      "photos",
      0,
    ]);
    expect(plugin.invalidInput("report", { title: "Latarnia", location: { lat: 100, lng: 19 } })?.[0]?.path).toEqual([
      "location",
      "lat",
    ]);
  });
});

const FOREIGN_PHOTO = "Nie można dodać tego zdjęcia. Dodaj je jeszcze raz.";

describe("issues: photos", () => {
  test("someone else's photo, pending or already on a report, is refused by report and join", async () => {
    const plugin = await setup();
    const kept = await plugin.files.fake();
    const first = await report(plugin, "Latarnia Alicji", { photos: [kept] });
    expect(await plugin.files.isKept(kept)).toBe(true);
    const pending = await plugin.files.fake();

    for (const photo of [kept, pending]) {
      expect((await plugin.as(bob).tool("report", { title: "Cudze zdjęcie", photos: [photo] })).error).toBe(
        FOREIGN_PHOTO,
      );
      const draft = JSON.stringify({ title: "Dołączam", photos: [photo] });
      expect((await plugin.as(bob).tool("join", { target: first, draft })).error).toBe(FOREIGN_PHOTO);
    }
    expect(await plugin.db.issues?.count()).toBe(1);
    expect(await plugin.db.photos?.count()).toBe(1);
    expect(await plugin.db.reports?.count()).toBe(0);
  });

  test("one bad photo among good ones: nothing is created", async () => {
    const plugin = await setup();
    const own = await plugin.as(bob).files.fake();
    const foreign = await plugin.files.fake();
    const res = await plugin.as(bob).tool("report", { title: "Dwa zdjęcia", photos: [own, foreign] });
    expect(res.error).toBe(FOREIGN_PHOTO);
    expect([await plugin.db.issues?.count(), await plugin.db.photos?.count(), await plugin.db.votes?.count()]).toEqual([
      0, 0, 0,
    ]);
    expect(await plugin.files.isKept(own)).toBe(false);
  });

  test("the form prefills only the user's own uploads from its param", async () => {
    const plugin = await setup();
    const own = await plugin.as(bob).files.fake();
    const foreign = await plugin.files.fake();
    const form = await plugin.as(bob).view("form", { photos: JSON.stringify([foreign, own]) });
    expect(nodes(form, "ImagePicker")[0]?.value?.map((p) => p.file)).toEqual([own]);
  });

  test("a retried join adds each photo once", async () => {
    const plugin = await setup();
    const first = await report(plugin, "Pierwsza usterka");
    const photo = await plugin.as(bob).files.fake();
    const draft = JSON.stringify({ title: "Też to widzę", photos: [photo, photo] });
    await plugin.as(bob).tool("join", { target: first, draft });
    await plugin.as(bob).tool("join", { target: first, draft });
    expect(await plugin.db.photos?.count({ where: { issue: first } })).toBe(1);
  });

  test("the gallery shows at most 10 photos: the author's first, then the oldest", async () => {
    const plugin = await setup();
    const fakes = async (user: PluginUser, n: number) => {
      const files: FileId[] = [];
      for (const _ of Array.from({ length: n })) files.push(await plugin.as(user).files.fake());
      return files;
    };
    const own = await fakes(alice, 3);
    const first = await report(plugin, "Dziura", { photos: own });
    const join = async (user: PluginUser, n: number) => {
      const draft = JSON.stringify({ title: "Dołączam", photos: await fakes(user, n) });
      expect((await plugin.as(user).tool("join", { target: first, draft })).error).toBeUndefined();
    };
    await join(bob, 3);
    await join(carol, 3);
    await join(dave, 2);
    expect(await plugin.db.photos?.count({ where: { issue: first } })).toBe(11);
    const gallery = nodes(await plugin.view("detail", { id: first }), "Gallery")[0];
    expect(gallery?.items).toHaveLength(10);
    expect(gallery?.items.slice(0, 3).map((item) => item.file)).toEqual(own);
  });
});

describe("issues: AI category", () => {
  test("the AI picks one of the place's categories; members never see it, admins do", async () => {
    const plugin = await setup();
    const prompts: string[] = [];
    plugin.ai.mockCall((req) => {
      prompts.push(req.prompt);
      return { category: "oświetlenie" };
    });
    const id = await report(plugin, "Ciemno przy wejściu", { description: "Od tygodnia" });
    const lighting = await plugin.db.categories?.findFirst({ where: { name: "Oświetlenie" } });
    expect(await plugin.db.issues?.get(id)).toMatchObject({ categoryId: lighting?.id, categorySource: "ai" });
    expect(prompts[0]).toContain("Ciemno przy wejściu");
    expect(prompts[0]).toContain('"Oświetlenie"');
    expect(prompts[0]).toContain('"Inne"');

    const memberTrees = [
      await plugin.view("list"),
      await plugin.view("list", { tab: "mine" }),
      await plugin.view("detail", { id }),
      await plugin.view("sent", { id }),
      await plugin.dashboardWidget("summary"),
      await plugin.as(admin).view("list"),
      await plugin.as(admin).view("detail", { id }),
    ];
    for (const tree of memberTrees) expect(hasText(tree, "Oświetlenie")).toBe(false);
    expect(JSON.stringify((await plugin.tool("list")).data)).not.toContain("ategor");

    const menu = nodes(await plugin.as(admin).view("adminDetail", { id }), "Menu")[0];
    expect(menu?.label).toBe("Zmień kategorię");
    expect(menu?.options.map((o) => [o.label, o.selected])).toEqual([
      ["Czystość", false],
      ["Drogi i chodniki", false],
      ["Oświetlenie", true],
      ["Zieleń", false],
      ["Inne", false],
    ]);
  });

  test("an unknown answer or a failing AI leaves the report in Inne, and the report still goes in", async () => {
    const plugin = await setup();
    plugin.ai.mockCall(() => ({ category: "Kosmos" }));
    const unknown = await report(plugin, "Coś dziwnego");
    expect(await plugin.db.issues?.get(unknown)).toMatchObject({ categoryId: null });
    plugin.ai.mockCall(() => {
      throw new Error("model down");
    });
    const failed = await report(plugin, "Model nie działa");
    expect(await plugin.db.issues?.get(failed)).toMatchObject({ categoryId: null });
  });

  test("a model that does not answer in time leaves the report in Inne, and the report still goes in", async () => {
    const plugin = await setup();
    const asked: (number | undefined)[] = [];
    plugin.ai.mockCall((req) => {
      asked.push(req.timeoutMs);
      return { category: "Zieleń" };
    });
    await report(plugin, "Krzaki przy bramie");
    expect(asked).toEqual([3000]);
    plugin.ai.mockTimeout();
    const slow = await report(plugin, "Model się zamyślił");
    expect(await plugin.db.issues?.get(slow)).toMatchObject({ categoryId: null });
  });

  test("an admin's category sticks (categorySource admin); Inne is a choice too", async () => {
    const plugin = await setup();
    plugin.ai.mockCall(() => ({ category: "Zieleń" }));
    const id = await report(plugin, "Krzaki zasłaniają przejście");
    const roads = await plugin.db.categories?.findFirst({ where: { name: "Drogi i chodniki" } });
    expect((await plugin.as(admin).tool("setCategory", { id, category: roads?.id ?? "" })).toast).toBe(
      "Kategoria: Drogi i chodniki",
    );
    expect(await plugin.db.issues?.get(id)).toMatchObject({ categoryId: roads?.id, categorySource: "admin" });
    await plugin.as(admin).tool("setCategory", { id, category: "other" });
    expect(await plugin.db.issues?.get(id)).toMatchObject({ categoryId: null, categorySource: "admin" });
  });
});

describe("issues: similar reports", () => {
  test("the AI finds the same active problem → the sheet asks; nothing is saved yet", async () => {
    const plugin = await setup();
    lampsAreTheSame(plugin);
    const first = await report(plugin, "Pierwsza usterka", { location: oldTownAddress });
    const photo = await plugin.as(bob).files.fake();
    const near = { ...oldTownAddress, lat: oldTownAddress.lat + 0.0001 };
    const ask = await plugin.as(bob).tool("report", { title: "Nie działa latarnia", photos: [photo], location: near });
    expect(ask.navigate).toMatchObject({ view: "merge", present: "sheet", params: { target: first } });
    expect(await plugin.db.issues?.count()).toBe(1);
    expect(await plugin.files.isKept(photo)).toBe(false);

    const sheet = await plugin.as(bob).view("merge", ask.navigate?.params);
    expect(sheet).toMatchObject({ title: "Czy to ten sam problem?", eyebrow: "Wykryliśmy podobne zgłoszenie" });
    expect(textsOf(sheet)).toEqual(
      expect.arrayContaining([
        "Ktoś zgłosił już coś podobnego w tym miejscu. Dołącz, a Twój głos podbije zgłoszenie.",
        "Pierwsza usterka",
        "10 m od Ciebie",
        "Tak, dołącz i podbij",
        "Nie, to inny problem",
      ]),
    );
    expect(cards(sheet)[0]?.counter).toEqual({ label: "1 głos", value: 1 });
  });

  test("the AI compares what the problem is, not where: the address is left out, the place is the scope", async () => {
    const plugin = await setup();
    const asked: string[] = [];
    plugin.ai.mockSimilar((query) => {
      asked.push(query.text);
      return [];
    });
    await report(plugin, "Pierwsza usterka", { location: oldTownAddress });
    const lema = { lat: 50.0697, lng: 19.9638, address: "Stanisława Lema 7, 31-571 Kraków" };
    const cups = { title: "Kubki i śmieci", description: "Ktoś zostawia kubki", location: lema };
    await plugin.as(bob).tool("report", cups);
    expect(asked).toEqual(["Pierwsza usterka", "Kubki i śmieci. Ktoś zostawia kubki"]);
  });

  test("joining adds the photos, a vote (once) and a follow; the sheet says how many votes it has now", async () => {
    const plugin = await setup();
    lampsAreTheSame(plugin);
    const first = await report(plugin, "Pierwsza usterka");
    const photo = await plugin.as(bob).files.fake();
    const ask = await plugin.as(bob).tool("report", { title: "Latarnia nie świeci", photos: [photo] });
    const draft = ask.navigate?.params?.draft ?? "";

    const joined = await plugin.as(bob).tool("join", { target: first, draft });
    expect(joined.navigate).toEqual({
      type: "navigate",
      view: "joined",
      params: { id: first, photos: "1" },
      present: "sheet",
    });
    expect(await plugin.files.isKept(photo)).toBe(true);
    expect(await plugin.db.issues?.count()).toBe(1);
    expect(await plugin.db.photos?.count({ where: { issue: first } })).toBe(1);
    expect(await plugin.db.votes?.count({ where: { issue: first } })).toBe(2);
    expect(await plugin.db.reports?.count({ where: { issue: first, author: bob.id } })).toBe(1);

    const done = await plugin.as(bob).view("joined", joined.navigate?.params);
    expect(done).toMatchObject({ title: "Dołączono i podbito" });
    expect(textsOf(done)).toContain(
      "Twoje zdjęcie trafiło do zgłoszenia, które ma teraz 2 głosy. Powiadomimy Cię o zmianach.",
    );
    expect(nodes(done, "Button").map((b) => [b.label, b.action])).toEqual([
      ["Zobacz zgłoszenie", { type: "navigate", view: "detail", params: { id: first } }],
      ["Wróć do pulpitu", { type: "app", screen: "dashboard" }],
    ]);

    await plugin.as(bob).tool("join", { target: first, draft: JSON.stringify({ title: "Znowu ja" }) });
    expect(await plugin.db.votes?.count({ where: { issue: first } })).toBe(2);
  });

  test('"Nie, to inny problem" creates a new report', async () => {
    const plugin = await setup();
    lampsAreTheSame(plugin);
    await report(plugin, "Pierwsza usterka");
    const res = await plugin.as(bob).tool("report", { title: "Latarnia na Krótkiej", force: true });
    expect(res.navigate?.view).toBe("sent");
    expect(await plugin.db.issues?.count()).toBe(2);
  });

  test("only active reports are candidates; private places never offer joining; voting off joins without a vote", async () => {
    const plugin = await setup();
    plugin.ai.mockSimilar((_query, candidates) =>
      candidates.slice(0, 1).map((item) => ({ item, score: 1, reason: "" })),
    );
    const closed = await report(plugin, "Zamknięta usterka", { force: true });
    await plugin.as(admin).tool("setClosed", { id: closed, closed: true });
    expect((await plugin.as(bob).tool("report", { title: "Nowa usterka" })).navigate?.view).toBe("sent");

    const active = await report(plugin, "Aktywna usterka", { force: true });
    await configure(plugin, { visibility: "adminsAndAuthor" });
    expect((await plugin.as(bob).tool("report", { title: "Prywatna usterka" })).navigate?.view).toBe("sent");
    expect(
      (await plugin.as(bob).tool("join", { target: active, draft: JSON.stringify({ title: "Dołącz" }) })).error,
    ).toBe("To zgłoszenie już nie istnieje.");

    await configure(plugin, { visibility: "members", votingEnabled: false });
    const ask = await plugin.as(carol).tool("report", { title: "Carol też to widzi" });
    expect(ask.navigate?.view).toBe("merge");
    expect(buttons(await plugin.as(carol).view("merge", ask.navigate?.params))).toContain("Tak, dołącz");
    const target = ask.navigate?.params?.target ?? "";
    const votes = await plugin.db.votes?.count({ where: { issue: target } });
    await plugin.as(carol).tool("join", { target, draft: ask.navigate?.params?.draft ?? "" });
    expect(await plugin.db.votes?.count({ where: { issue: target } })).toBe(votes);
    expect(await plugin.as(carol).view("joined", { id: target, photos: "0" })).toMatchObject({ title: "Dołączono" });
  });
});

describe("issues: list", () => {
  test("Popularne by votes, Najnowsze newest; closed ones only in Moje, marked", async () => {
    const plugin = await setup();
    const hole = await report(plugin, "Dziura w jezdni");
    plugin.setNow(new Date(Date.UTC(2026, 0, 2)));
    const rack = await report(plugin.as(bob), "Stojaki na rowery");
    plugin.setNow(new Date(Date.UTC(2026, 0, 3)));
    const bin = await report(plugin, "Przepełniony kosz");
    await plugin.as(bob).tool("vote", { id: hole });
    await plugin.as(carol).tool("vote", { id: hole });
    await plugin.as(carol).tool("vote", { id: rack });
    await plugin.as(admin).tool("setClosed", { id: bin, closed: true });

    const popular = await plugin.view("list");
    expect(popular).toMatchObject({ title: "Zgłoszenia", eyebrow: "Test Community" });
    expect(popular).not.toHaveProperty("actions");
    expect(tabLabels(popular)).toEqual(["Popularne", "Najnowsze", "Moje"]);
    expect(titles(popular)).toEqual(["Dziura w jezdni", "Stojaki na rowery"]);
    expect(cards(popular)[0]).toMatchObject({
      counter: {
        label: "Podbij zgłoszenie, 3 głosy",
        value: 3,
        pressed: true,
        action: { type: "tool", tool: "vote", args: { id: hole } },
      },
      meta: [{ at: expect.any(String) }, { text: "0", icon: "chat", label: "Komentarze: 0" }],
      onPress: { type: "navigate", view: "detail", params: { id: hole } },
    });
    expect(nodes(popular, "Fab")).toEqual([
      { type: "Fab", label: "Zgłoś", icon: "plus", action: { type: "navigate", view: "new" } },
    ]);
    expect(titles(await plugin.view("list", { tab: "newest" }))).toEqual(["Stojaki na rowery", "Dziura w jezdni"]);

    const mine = await plugin.view("list", { tab: "mine" });
    expect(titles(mine)).toEqual(["Przepełniony kosz", "Dziura w jezdni"]);
    expect(cards(mine)[0]).toMatchObject({ badge: { text: "Zamknięte", tone: "neutral" } });
    expect(cards(mine)[0]?.counter).not.toHaveProperty("action");
  });

  test("a card shows the first photo with +N; admins get Panel in the header", async () => {
    const plugin = await setup();
    const cover = await plugin.files.fake();
    await report(plugin, "Graffiti", { photos: [cover, await plugin.files.fake(), await plugin.files.fake()] });
    expect(cards(await plugin.view("list"))[0]?.image).toEqual({ file: cover, alt: "Zdjęcie zgłoszenia", more: 2 });
    expect(await plugin.as(admin).view("list")).toMatchObject({
      actions: [{ label: "Panel", icon: "shield", action: { type: "navigate", view: "panel" } }],
    });
  });

  test("votes toggle; closed reports and voting off refuse", async () => {
    const plugin = await setup();
    const id = await report(plugin, "Dziura w jezdni");
    expect((await plugin.as(bob).tool("vote", { id })).data).toEqual({ voted: true, votes: 2 });
    expect(cards(await plugin.as(bob).view("list"))[0]?.counter).toMatchObject({ value: 2, pressed: true });
    expect((await plugin.as(bob).tool("vote", { id })).data).toEqual({ voted: false, votes: 1 });
    expect(cards(await plugin.as(bob).view("list"))[0]?.counter).toMatchObject({ value: 1, pressed: false });

    await plugin.as(admin).tool("setClosed", { id, closed: true });
    expect((await plugin.as(bob).tool("vote", { id })).error).toBe("To zgłoszenie jest już zamknięte.");
    await configure(plugin, { votingEnabled: false });
    expect((await plugin.as(bob).tool("vote", { id })).error).toBe("Podbijanie jest wyłączone w tym miejscu.");
  });

  test("voting off: Najnowsze, Moje, Zamknięte, and no vote pill anywhere", async () => {
    const plugin = await setup();
    const open = await report(plugin, "Dziura w jezdni");
    const closed = await report(plugin, "Kosz");
    await plugin.as(admin).tool("setClosed", { id: closed, closed: true });
    await configure(plugin, { votingEnabled: false });
    const list = await plugin.view("list");
    expect(tabLabels(list)).toEqual(["Najnowsze", "Moje", "Zamknięte"]);
    expect(titles(list)).toEqual(["Dziura w jezdni"]);
    expect(cards(list).every((c) => c.counter === undefined)).toBe(true);
    expect(titles(await plugin.view("list", { tab: "closed" }))).toEqual(["Kosz"]);
    expect(buttons(await plugin.view("detail", { id: open })).some((b) => b.startsWith("Podbij"))).toBe(false);
    // "popular" does not exist without voting: the first tab instead.
    expect(nodes(await plugin.view("list", { tab: "popular" }), "Tabs")[0]?.options[0]).toMatchObject({
      selected: true,
    });
  });

  test("private mode: members see only their own reports, with a lock and no votes; admins see all", async () => {
    const plugin = await setup();
    const mine = await report(plugin, "Moja usterka", {
      photos: [await plugin.files.fake(), await plugin.files.fake()],
    });
    const bobs = await report(plugin.as(bob), "Usterka Boba");
    await configure(plugin, { visibility: "adminsAndAuthor" });

    const list = await plugin.view("list");
    expect(list).toMatchObject({ title: "Moje zgłoszenia" });
    expect(nodes(list, "Notice")).toEqual([
      {
        type: "Notice",
        text: "W tym miejscu zgłoszenia widzą tylko administratorzy i ich autorzy.",
        icon: "lock",
      },
    ]);
    expect(nodes(list, "Tabs")).toEqual([]);
    expect(titles(list)).toEqual(["Moja usterka"]);
    expect(cards(list)[0]).not.toHaveProperty("counter");
    expect(cards(list)[0]?.meta).toHaveLength(1);
    expect(cards(list)[0]?.image).not.toHaveProperty("more");

    expect(await plugin.view("detail", { id: bobs })).toMatchObject({ title: "Nie znaleziono" });
    expect(await plugin.view("detail", { id: mine })).toMatchObject({ title: "Moja usterka" });
    expect(nodes(await plugin.view("detail", { id: mine }), "Share")).toEqual([]);
    expect((await plugin.tool("vote", { id: bobs })).error).toBe("To zgłoszenie już nie istnieje.");
    expect((await plugin.tool("comment", { id: bobs, text: "Hej" })).error).toBe("To zgłoszenie już nie istnieje.");
    expect((await plugin.tool("list")).data).toEqual([expect.objectContaining({ id: mine })]);

    expect(titles(await plugin.as(admin).view("list", { tab: "newest" })).sort()).toEqual([
      "Moja usterka",
      "Usterka Boba",
    ]);
    expect(await plugin.as(admin).view("detail", { id: bobs })).toMatchObject({ title: "Usterka Boba" });
  });

  test("empty states", async () => {
    const plugin = await setup();
    const empty = nodes(await plugin.view("list"), "Empty");
    expect(empty).toEqual([
      {
        type: "Empty",
        title: "Na razie cisza",
        text: "Nikt jeszcze niczego nie zgłosił. Widzisz usterkę albo masz pomysł? Daj znać jako pierwszy.",
        icon: "megaphone",
      },
    ]);
    expect(textsOf(await plugin.view("list", { tab: "mine" }))).toContain("Nie masz jeszcze żadnych zgłoszeń.");
  });
});

describe("issues: details and comments", () => {
  test("the history shows the admins' reply and closing; comments with their box; a share link", async () => {
    const plugin = await setup();
    const id = await report(plugin, "Dziura w jezdni", { location: oldTownAddress });
    plugin.setNow(new Date(Date.UTC(2026, 0, 2)));
    await plugin.as(admin).tool("respond", { id, reply: "Zgłosiliśmy sprawę zarządcy drogi.", note: "Nr sprawy: 128" });
    plugin.setNow(new Date(Date.UTC(2026, 0, 3)));
    await plugin.as(admin).tool("setClosed", { id, closed: true });
    await plugin.as(bob).tool("comment", { id, text: "Potwierdzam, rano prawie wjechałem w nią rowerem." });

    const view = await plugin.view("detail", { id });
    expect(view).toMatchObject({ title: "Dziura w jezdni", back: { type: "navigate", view: "list" } });
    expect(nodes(view, "Timeline")[0]?.items).toEqual([
      { title: "Zgłoszone", at: "1 sty, 01:00", tone: "neutral" },
      { title: "Odpowiedź administratora", at: "2 sty", text: "Zgłosiliśmy sprawę zarządcy drogi.", tone: "info" },
      { title: "Zamknięte", at: "3 sty", tone: "success" },
    ]);
    expect(nodes(view, "Tags")[0]?.items).toEqual([{ text: "Zamknięte", tone: "neutral", dot: true }]);
    expect(hasText(view, "Nr sprawy: 128")).toBe(false);
    expect(textsOf(view)).toEqual(expect.arrayContaining(["Floriańska 15, 31-019 Kraków", "Komentarze (1)", "Bob"]));
    expect(nodes(view, "Map")).toHaveLength(0);
    expect(nodes(view, "Place")[0]?.action).toEqual({ type: "navigate", view: "map", params: { id } });
    const map = await plugin.view("map", { id });
    expect(nodes(map, "Map")[0]?.layers[0]).toMatchObject({
      kind: "pins",
      items: [{ id, at: { lat: oldTownAddress.lat, lng: oldTownAddress.lng } }],
    });
    expect(nodes(view, "Activity")[0]).toMatchObject({
      title: "Bob",
      person: "Bob",
      text: "Potwierdzam, rano prawie wjechałem w nią rowerem.",
    });
    expect(nodes(view, "Form")[0]).toMatchObject({
      inline: true,
      submit: { type: "tool", tool: "comment", args: { id } },
      children: [{ type: "TextInput", name: "text", label: "Dodaj komentarz" }],
    });
    // Closed: no vote button, only the share link.
    expect(nodes(view, "Share")).toEqual([
      { type: "Share", label: "Udostępnij", path: `/app/c/test/issues/detail?id=${id}`, variant: "icon" },
    ]);
    expect(buttons(view).some((b) => b.startsWith("Podbij"))).toBe(false);
    expect(await plugin.as(admin).view("detail", { id })).toMatchObject({
      actions: [{ label: "Obsłuż", action: { type: "navigate", view: "adminDetail", params: { id } } }],
    });
  });

  test("comments: off hides them and refuses; admins only refuses members; empty text is invalid", async () => {
    const plugin = await setup();
    const id = await report(plugin, "Dziura w jezdni");
    expect(plugin.invalidInput("comment", { id, text: "   " })?.[0]?.message).toBe("Napisz komentarz.");

    await configure(plugin, { commentPermission: "admins" });
    const members = await plugin.view("detail", { id });
    expect(nodes(members, "Form")).toEqual([]);
    expect(textsOf(members)).toContain("Komentować mogą tylko administratorzy.");
    expect((await plugin.tool("comment", { id, text: "Hej" })).error).toBe("Komentować mogą tylko administratorzy.");
    expect((await plugin.as(admin).tool("comment", { id, text: "Sprawdzimy." })).toast).toBe("Komentarz dodany.");

    await configure(plugin, { commentsEnabled: false });
    const off = await plugin.view("detail", { id });
    expect(textsOf(off).some((x) => x.startsWith("Komentarze"))).toBe(false);
    expect(nodes(off, "Form")).toEqual([]);
    expect((await plugin.as(admin).tool("comment", { id, text: "Hej" })).error).toBe(
      "Komentarze są wyłączone w tym miejscu.",
    );
    expect(cards(await plugin.view("list"))[0]?.meta).toHaveLength(1);
  });
});

describe("issues: admin", () => {
  test("admin views say no to members; admin tools are forbidden to them", async () => {
    const plugin = await setup();
    const id = await report(plugin, "Dziura w jezdni");
    for (const view of ["admin", "panel", "adminDetail", "settings"]) {
      expect(await plugin.view(view, { id })).toMatchObject({ title: "Brak dostępu" });
    }
    const calls: [string, Record<string, unknown>][] = [
      ["respond", { id, reply: "x" }],
      ["setClosed", { id, closed: true }],
      ["setCategory", { id, category: "other" }],
      ["configure", { votingEnabled: false }],
      ["addCategory", { name: "Windy" }],
      ["removeCategory", { id: "x" }],
    ];
    for (const [name, args] of calls) await expect(plugin.tool(name, args)).rejects.toBeInstanceOf(ForbiddenError);
  });

  test("closing and reopening: the author and residents who joined are told; closed leaves Popularne", async () => {
    const plugin = await setup();
    lampsAreTheSame(plugin);
    const id = await report(plugin, "Pierwsza latarnia");
    const ask = await plugin.as(bob).tool("report", { title: "Latarnia nie świeci" });
    await plugin.as(bob).tool("join", { target: id, draft: ask.navigate?.params?.draft ?? "" });

    const closed = await plugin.as(admin).tool("setClosed", { id, closed: true });
    expect(closed).toMatchObject({ toast: "Zgłoszenie zamknięte.", refresh: true });
    expect(titles(await plugin.view("list"))).toEqual([]);
    expect(plugin.notifications()).toEqual([
      {
        from: admin.id,
        to: { users: [alice.id, bob.id] },
        title: "Zgłoszenie zamknięte",
        body: "Pierwsza latarnia",
        tone: "success",
        open: { type: "navigate", view: "detail", params: { id } },
      },
    ]);
    expect(buttons(await plugin.as(admin).view("adminDetail", { id }))).toContain("Otwórz ponownie");

    plugin.setNow(new Date(Date.UTC(2026, 0, 2)));
    await plugin.as(admin).tool("setClosed", { id, closed: false });
    expect(plugin.notifications().at(-1)).toMatchObject({ title: "Zgłoszenie otwarte ponownie", tone: "info" });
    expect(titles(await plugin.view("list"))).toEqual(["Pierwsza latarnia"]);
    expect(nodes(await plugin.view("detail", { id }), "Timeline")[0]?.items.map((i) => i.title)).toEqual([
      "Zgłoszone",
      "Zamknięte",
      "Otwarte ponownie",
    ]);
  });

  test("a reply notifies once; the note stays with the admins; the form keeps both", async () => {
    const plugin = await setup();
    const id = await report(plugin, "Nie świeci lampa");
    const saved = await plugin.as(admin).tool("respond", { id, reply: "Naprawa w ciągu 3 dni.", note: "Energetyka" });
    expect(saved.toast).toBe("Zapisano i powiadomiono autora.");
    expect(plugin.notifications()).toEqual([
      expect.objectContaining({
        to: { users: [alice.id] },
        title: "Administrator odpowiedział na zgłoszenie",
        body: "Nie świeci lampa: Naprawa w ciągu 3 dni.",
      }),
    ]);
    expect((await plugin.as(admin).tool("respond", { id, reply: "Naprawa w ciągu 3 dni.", note: "Inna" })).toast).toBe(
      "Zapisano.",
    );
    expect(plugin.notifications()).toHaveLength(1);

    const view = await plugin.as(admin).view("adminDetail", { id });
    expect(view).toMatchObject({ title: "Szczegóły i obsługa", eyebrow: "Zgłoszenie" });
    expect(nodes(view, "TextInput").map((i) => [i.name, i.label, i.value, i.hint])).toEqual([
      ["reply", "Odpowiedź dla członków", "Naprawa w ciągu 3 dni.", "Widoczna dla członków pod zgłoszeniem"],
      ["note", "Notatka wewnętrzna", "Inna", "Tylko dla administratorów"],
    ]);
    expect(nodes(view, "Form")[0]?.submitLabel).toBe("Zapisz i powiadom autora");
    expect(textsOf(view)).toEqual(expect.arrayContaining(["1 głos", "0 komentarzy", "Zamknij zgłoszenie"]));
    expect(hasText(await plugin.view("detail", { id }), "Inna")).toBe(false);
  });

  test("unread for each admin until they open the admin detail; the count is on the admin view", async () => {
    const plugin = await setup();
    const hole = await report(plugin, "Dziura w jezdni");
    await report(plugin, "Kosz");
    const panelRows = async (who: PluginUser) => cards(await plugin.as(who).view("panel"));
    expect((await panelRows(admin)).map((c) => c.unread)).toEqual([true, true]);
    const page = await plugin.as(admin).view("admin");
    expect(cards(page).find((c) => c.title === "Panel zgłoszeń")).toMatchObject({ count: 2, icon: "shield" });

    await plugin.as(admin).view("adminDetail", { id: hole });
    expect((await panelRows(admin)).find((c) => c.title === "Dziura w jezdni")?.unread).toBe(false);
    expect(cards(await plugin.as(admin).view("admin")).find((c) => c.title === "Panel zgłoszeń")?.count).toBe(1);
    expect((await panelRows(admin2)).every((c) => c.unread)).toBe(true);
  });

  test("the plugin page part and the panel: counts, tiles, sort, closed dates", async () => {
    const plugin = await setup();
    const hole = await report(plugin, "Dziura w jezdni");
    plugin.setNow(new Date(Date.UTC(2026, 0, 2)));
    await report(plugin, "Kosz");
    const bench = await report(plugin, "Ławka");
    await plugin.as(bob).tool("vote", { id: hole });
    plugin.setNow(new Date(Date.UTC(2026, 8, 25)));
    await plugin.as(admin).tool("setClosed", { id: bench, closed: true });

    const page = await plugin.as(admin).view("admin");
    expect(nodes(page, "Stat")).toEqual([
      { type: "Stat", label: "aktywne", value: "2", tone: "success" },
      { type: "Stat", label: "zamknięte", value: "1" },
    ]);
    expect(cards(page).map((c) => [c.title, c.subtitle, c.onPress])).toEqual([
      ["Panel zgłoszeń", "Odpowiedzi, zamykanie, notatki", { type: "navigate", view: "panel" }],
      ["Ustawienia rozszerzenia", "Głosowanie, komentarze, widoczność", { type: "navigate", view: "settings" }],
    ]);

    const panel = await plugin.as(admin).view("panel");
    expect(panel).toMatchObject({
      title: "Zgłoszenia",
      eyebrow: "Panel administratora",
      back: { type: "app", screen: "pluginPage" },
      actions: [{ label: "Ustawienia rozszerzenia", icon: "settings", variant: "icon" }],
    });
    expect(nodes(panel, "Tabs")[0]?.options.map((o) => [o.label, o.count, o.selected])).toEqual([
      ["Aktywne", 2, true],
      ["Zamknięte", 1, false],
    ]);
    expect(textsOf(panel)).toEqual(expect.arrayContaining(["Aktywne (2)", "Najwięcej głosów", "0 kom."]));
    expect(titles(panel)).toEqual(["Dziura w jezdni", "Kosz"]);
    expect(cards(panel)[0]?.counter).toEqual({ label: "2 głosy", value: 2 });
    expect(titles(await plugin.as(admin).view("panel", { sort: "newest" }))).toEqual(["Kosz", "Dziura w jezdni"]);
    const closedPanel = await plugin.as(admin).view("panel", { state: "closed" });
    expect(titles(closedPanel)).toEqual(["Ławka"]);
    expect(cards(closedPanel)[0]?.meta).toEqual([{ text: "zamknięte 25 wrz" }]);
  });

  test("settings save at once and change what members get", async () => {
    const plugin = await setup();
    const view = await plugin.as(admin).view("settings");
    expect(view).toMatchObject({
      title: "Zgłoszenia",
      eyebrow: "Rozszerzenie",
      back: { type: "app", screen: "pluginPage" },
    });
    expect(nodes(view, "Switch").map((s) => [s.name, s.label, s.value, s.action?.tool])).toEqual([
      ["votingEnabled", "Podbijanie", true, "configure"],
      ["commentsEnabled", "Komentarze", true, "configure"],
      ["allowAnonymous", "Zgłoszenia anonimowe", true, "configure"],
      ["requirePhoto", "Wymagaj zdjęcia", false, "configure"],
    ]);
    expect(nodes(view, "Select").map((s) => [s.name, s.variant, s.value])).toEqual([
      ["commentPermission", "segmented", "members"],
      ["visibility", "radio", "members"],
    ]);
    expect((await configure(plugin, { commentsEnabled: false })).refresh).toBe(true);
    const after = await plugin.as(admin).view("settings");
    expect(nodes(after, "Switch").find((s) => s.name === "commentsEnabled")?.value).toBe(false);
    expect(nodes(after, "Select").map((s) => s.name)).toEqual(["visibility"]);
  });

  test("categories: add, refuse a duplicate, remove (its reports move to Inne); Inne cannot be removed", async () => {
    const plugin = await setup();
    const tagsOf = async () => nodes(await plugin.as(admin).view("settings"), "Tags").flatMap((row) => row.items);
    expect((await tagsOf()).map((tag) => [tag.text, tag.onRemove?.tool])).toEqual([
      ["Czystość", "removeCategory"],
      ["Drogi i chodniki", "removeCategory"],
      ["Oświetlenie", "removeCategory"],
      ["Zieleń", "removeCategory"],
      ["Inne", undefined],
    ]);
    expect((await plugin.as(admin).tool("addCategory", { name: "Windy" })).toast).toBe("Dodano kategorię.");
    expect((await plugin.as(admin).tool("addCategory", { name: "windy" })).error).toBe("Taka kategoria już jest.");
    expect((await plugin.as(admin).tool("addCategory", { name: "inne" })).error).toBe("Taka kategoria już jest.");

    plugin.ai.mockCall(() => ({ category: "Windy" }));
    const id = await report(plugin, "Winda stoi");
    const lifts = await plugin.db.categories?.findFirst({ where: { name: "Windy" } });
    expect(await plugin.db.issues?.get(id)).toMatchObject({ categoryId: lifts?.id });
    await plugin.as(admin).tool("removeCategory", { id: lifts?.id ?? "" });
    expect(await plugin.db.issues?.get(id)).toMatchObject({ categoryId: null });
    expect((await tagsOf()).map((tag) => tag.text)).not.toContain("Windy");
  });

  test("a place installed before v4: default settings, only Inne, no AI call", async () => {
    const plugin = await testPlugin(issues, { user: alice });
    const asked: string[] = [];
    plugin.ai.mockCall((req) => {
      asked.push(req.prompt);
      return { category: "Inne" };
    });
    const id = await report(plugin, "Dziura w jezdni");
    expect(asked).toEqual([]);
    expect(tabLabels(await plugin.view("list"))).toEqual(["Popularne", "Najnowsze", "Moje"]);
    const detail = await plugin.as(admin).view("adminDetail", { id });
    expect(nodes(detail, "Menu")).toEqual([]);
    expect(nodes(detail, "Tags")[0]?.items).toEqual([{ text: "Inne" }]);
  });
});

describe("issues: dashboard widget", () => {
  test("3×2: the 3 most voted active reports; 3×3: 6; the count of active ones and the dark button", async () => {
    const plugin = await setup();
    const ids: string[] = [];
    for (const title of ["Jeden", "Dwa", "Trzy", "Cztery", "Pięć", "Sześć", "Siedem"])
      ids.push(await report(plugin, title));
    const voters = [bob, carol, dave];
    const [first, second, third] = ids;
    for (const voter of voters) await plugin.as(voter).tool("vote", { id: third ?? "" });
    for (const voter of voters.slice(0, 2)) await plugin.as(voter).tool("vote", { id: first ?? "" });
    await plugin.as(bob).tool("vote", { id: second ?? "" });

    const small = await plugin.dashboardWidget("summary");
    expect(small).toMatchObject({
      title: "Zgłoszenia",
      icon: "megaphone",
      link: { label: "aktywnych", count: 7, action: { type: "navigate", view: "list" } },
      onPress: { type: "navigate", view: "list" },
    });
    expect(titles(small)).toEqual(["Trzy", "Jeden", "Dwa"]);
    expect(cards(small)[0]).toMatchObject({
      counter: { label: "4 głosy", value: 4 },
      onPress: { type: "navigate", view: "detail", params: { id: third } },
    });
    expect(nodes(small, "Button")).toEqual([
      {
        type: "Button",
        label: "Zgłoś problem",
        action: { type: "navigate", view: "new" },
        variant: "ink",
        icon: "camera",
      },
    ]);
    expect(cards(await plugin.dashboardWidget("summary", { size: { w: 3, h: 3 } }))).toHaveLength(6);
  });

  test("empty; voting off = newest without counts; private mode = only the member's own count", async () => {
    const plugin = await setup();
    const empty = await plugin.dashboardWidget("summary");
    expect(textsOf(empty)).toEqual([
      "Zgłoszenia",
      "Na razie cisza",
      "Nikt jeszcze niczego nie zgłosił.",
      "Zgłoś problem",
    ]);
    expect(empty).toMatchObject({ link: { count: 0, label: "aktywnych" } });

    await report(plugin, "Starsze");
    plugin.setNow(new Date(Date.UTC(2026, 0, 2)));
    await report(plugin.as(bob), "Nowsze");
    await configure(plugin, { votingEnabled: false });
    const newest = await plugin.dashboardWidget("summary");
    expect(titles(newest)).toEqual(["Nowsze", "Starsze"]);
    expect(cards(newest).every((c) => c.counter === undefined)).toBe(true);

    await configure(plugin, { votingEnabled: true, visibility: "adminsAndAuthor" });
    const own = await plugin.as(bob).dashboardWidget("summary");
    expect(cards(own)).toEqual([]);
    expect(own).toMatchObject({ link: { count: 1, label: "Twoje zgłoszenie" } });
    expect(buttons(own)).toEqual(["Zgłoś problem"]);
    expect(titles(await plugin.as(admin).dashboardWidget("summary"))).toHaveLength(2);
  });
});

describe("issues: data integrity", () => {
  test("deleting a report removes its votes, photos, comments and follows", async () => {
    const plugin = await setup();
    const id = await report(plugin, "Dziura w jezdni", { photos: [await plugin.files.fake()] });
    await plugin.as(bob).tool("vote", { id });
    await plugin.as(bob).tool("comment", { id, text: "Też widzę" });
    await plugin.db.issues?.delete(id);
    expect([
      await plugin.db.votes?.count(),
      await plugin.db.photos?.count(),
      await plugin.db.comments?.count(),
      await plugin.db.reports?.count(),
    ]).toEqual([0, 0, 0, 0]);
  });
});

describe("issues: privacy and rules", () => {
  test("joining follows the place's rules: a required photo, anonymity", async () => {
    const plugin = await setup();
    const first = await report(plugin, "Pierwsza usterka");
    await configure(plugin, { requirePhoto: true, allowAnonymous: false });
    const join = (draft: Record<string, unknown>) =>
      plugin.as(bob).tool("join", { target: first, draft: JSON.stringify(draft) });
    expect((await join({ title: "Bez zdjęcia" })).error).toBe("W tym miejscu zgłoszenie musi mieć zdjęcie.");
    const photo = await plugin.as(bob).files.fake();
    expect((await join({ title: "Anonimowo", photos: [photo], anonymous: true })).error).toBe(
      "Zgłoszenia anonimowe są wyłączone w tym miejscu.",
    );
    expect(await plugin.db.reports?.count()).toBe(0);
    expect((await join({ title: "Ze zdjęciem", photos: [photo] })).navigate?.view).toBe("joined");
  });

  test("an anonymous author stays anonymous in their comments, except to themself and admins", async () => {
    const plugin = await setup();
    const id = await report(plugin, "Głośny sąsiad", { anonymous: true });
    await plugin.tool("comment", { id, text: "Dalej to samo." });
    plugin.setNow(new Date(Date.UTC(2026, 0, 2)));
    await plugin.as(bob).tool("comment", { id, text: "Potwierdzam." });
    const commenters = async (who: PluginUser) =>
      nodes(await plugin.as(who).view("detail", { id }), "Activity").map((a) => [a.title, a.person]);
    expect(await commenters(bob)).toEqual([
      ["Autor zgłoszenia", "Autor zgłoszenia"],
      ["Bob", "Bob"],
    ]);
    expect(hasText(await plugin.as(bob).view("detail", { id }), "Alice")).toBe(false);
    expect((await commenters(alice))[0]).toEqual(["Alice (anonimowo)", "Alice (anonimowo)"]);
    expect((await commenters(admin))[0]).toEqual(["Alice (anonimowo)", "Alice (anonimowo)"]);
  });

  test("in private mode only the author hears about closing; residents who joined earlier do not", async () => {
    const plugin = await setup();
    lampsAreTheSame(plugin);
    const id = await report(plugin, "Pierwsza latarnia");
    const ask = await plugin.as(bob).tool("report", { title: "Latarnia nie świeci" });
    await plugin.as(bob).tool("join", { target: id, draft: ask.navigate?.params?.draft ?? "" });
    await configure(plugin, { visibility: "adminsAndAuthor" });
    await plugin.as(admin).tool("setClosed", { id, closed: true });
    await plugin.as(admin).tool("respond", { id, reply: "Naprawione." });
    expect(plugin.notifications().map((n) => n.to)).toEqual([{ users: [alice.id] }, { users: [alice.id] }]);
  });

  test("settings: partial updates change only their own fields; a place without a settings row gets one", async () => {
    const plugin = await testPlugin(issues, { user: alice });
    await configure(plugin, { votingEnabled: false });
    await configure(plugin, { commentsEnabled: false });
    expect(await plugin.db.settings?.findFirst()).toMatchObject({
      votingEnabled: false,
      commentsEnabled: false,
      allowAnonymous: true,
      visibility: "members",
    });
    expect(await plugin.db.settings?.count()).toBe(1);
  });

  test("a reply fits the history's note: 500 characters render, 501 are refused in Polish", async () => {
    const plugin = await setup();
    const id = await report(plugin, "Dziura w jezdni");
    await plugin.as(admin).tool("respond", { id, reply: "a".repeat(500) });
    expect(nodes(await plugin.view("detail", { id }), "Timeline")[0]?.items[1]?.text).toHaveLength(500);
    expect(plugin.invalidInput("respond", { id, reply: "a".repeat(501) })?.[0]?.message).toBe(
      "Odpowiedź może mieć najwyżej 500 znaków.",
    );
  });

  test("a comment and a category need their text: leaving it out fails with a Polish message", async () => {
    const plugin = await setup();
    const id = await report(plugin, "Dziura w jezdni");
    expect(plugin.invalidInput("comment", { id })?.[0]?.message).toBe("Napisz komentarz.");
    expect(plugin.invalidInput("addCategory", {})?.[0]?.message).toBe("Wpisz nazwę kategorii.");
    expect(plugin.invalidInput("addCategory", { name: "  " })?.[0]?.message).toBe("Wpisz nazwę kategorii.");
  });

  test("a category removed while the AI answers: the report is saved, in Inne", async () => {
    const plugin = await setup();
    await plugin.as(admin).tool("addCategory", { name: "Windy" });
    const lifts = await plugin.db.categories?.findFirst({ where: { name: "Windy" } });
    plugin.ai.mockCall(async () => {
      await plugin.db.categories?.delete(String(lifts?.id));
      return { category: "Windy" };
    });
    const res = await plugin.tool("report", { title: "Winda stoi" });
    expect(res.navigate?.view).toBe("sent");
    expect(await plugin.db.issues?.get(idOf(res))).toMatchObject({ categoryId: null, categorySource: "ai" });
  });

  test("history: the latest steps in order; v3 statuses that are not a close or a reopening are left out", async () => {
    const plugin = await setup();
    const id = await report(plugin, "Stara sprawa");
    await plugin.db.statusLog?.insert({ issue: id, status: "accepted" });
    await plugin.db.statusLog?.insert({ issue: id, status: "open" });
    const day = (n: number) => new Date(Date.UTC(2026, 0, 1) + n * 3_600_000);
    for (const n of Array.from({ length: 44 }, (_, i) => i + 1)) {
      plugin.setNow(day(n));
      await plugin.as(admin).tool("setClosed", { id, closed: n % 2 === 1 });
    }
    const items = nodes(await plugin.view("detail", { id }), "Timeline")[0]?.items ?? [];
    expect(items[0]?.title).toBe("Zgłoszone");
    expect(items).toHaveLength(41);
    // 44 steps, the latest 40 shown: the last one (a reopening) comes last.
    expect(items.at(-1)?.title).toBe("Otwarte ponownie");
    expect(items.slice(1, 3).map((i) => i.title)).toEqual(["Zamknięte", "Otwarte ponownie"]);
  });
});

describe("issues: authorization in private mode", () => {
  test("a member gets nothing of someone else's report, in any view or tool; a former follower too", async () => {
    const plugin = await setup();
    lampsAreTheSame(plugin);
    const photo = await plugin.files.fake();
    const id = await report(plugin, "Latarnia Alicji", { photos: [photo] });
    // Bob joined while reports were visible to members, then the place went private.
    const ask = await plugin.as(bob).tool("report", { title: "Latarnia też u mnie" });
    await plugin.as(bob).tool("join", { target: id, draft: ask.navigate?.params?.draft ?? "" });
    await configure(plugin, { visibility: "adminsAndAuthor" });

    const draft = JSON.stringify({ title: "Dołączam" });
    const notFound = { title: "Nie znaleziono" };
    for (const who of [bob, carol]) {
      const as = plugin.as(who);
      const views: [string, Record<string, string>][] = [
        ["detail", { id }],
        ["sent", { id }],
        ["joined", { id, photos: "0" }],
        ["merge", { target: id, draft }],
      ];
      for (const [view, params] of views) expect(await as.view(view, params)).toMatchObject(notFound);
      expect(nodes(await as.view("form", { photos: JSON.stringify([photo]) }), "ImagePicker")[0]?.value).toEqual([]);
      const tools: [string, Record<string, unknown>][] = [
        ["vote", { id }],
        ["comment", { id, text: "Hej" }],
        ["join", { target: id, draft }],
      ];
      for (const [tool, args] of tools)
        expect((await as.tool(tool, args)).error).toBe("To zgłoszenie już nie istnieje.");
      expect(titles(await as.view("list"))).toEqual([]);
    }
    expect(await plugin.db.comments?.count()).toBe(0);
  });
});
