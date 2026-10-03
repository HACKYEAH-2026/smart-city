import { describe, expect, test } from "bun:test";
import type { UINode } from "@app/plugin-sdk";
import { ForbiddenError, testPlugin, textsOf } from "@app/plugin-sdk/testing";
import issues from "./index";

const alice = { id: "alice", name: "Alice", role: "user" } as const;
const bob = { id: "bob", name: "Bob", role: "user" } as const;
const admin = { id: "urzad", name: "Urząd", role: "admin" } as const;

/** The AI "sees" the same problem when the text contains the word "latarnia". */
const lampsAreTheSame = (t: Awaited<ReturnType<typeof testPlugin>>) =>
  t.ai.mockSimilar((query, candidates) =>
    query.text.toLowerCase().includes("latarnia")
      ? candidates.slice(0, 1).map((item) => ({ item, score: 0.9, reason: "Ta sama latarnia przy przystanku" }))
      : [],
  );

describe("issues: reporting", () => {
  test("empty list → report with photo → details", async () => {
    const t = await testPlugin(issues, { user: alice });
    expect(textsOf(await t.view("list"))).toContain("Nie ma jeszcze zgłoszeń. Zgłoś pierwszą usterkę.");

    const photo = await t.files.fake();
    const res = await t.tool("report", {
      title: "Nie świeci lampa",
      category: "lighting",
      description: "Długa 12",
      photo,
    });
    expect(res.navigate?.view).toBe("sent");
    expect(await t.files.isKept(photo)).toBe(true);

    const sent = await t.view("sent", res.navigate!.params);
    expect(textsOf(sent)).toEqual(
      expect.arrayContaining(["Dziękujemy za zgłoszenie", "Administratorzy miejsca już je widzą.", "Nie świeci lampa"]),
    );
    expect(textsOf(sent)).toContain("Zdjęcie: Nie świeci lampa");

    const detail = await t.view("detail", res.navigate!.params);
    expect(textsOf(detail)).toEqual(
      expect.arrayContaining(["Nie świeci lampa", "Długa 12", "1 osoba zgłasza", "Zgłaszasz ten problem"]),
    );
    expect(textsOf(detail)).toContain("Zdjęcie: Nie świeci lampa");
  });

  test("the form: photo first, a kind, categories as chips, a title, a place and an anonymity switch", async () => {
    const t = await testPlugin(issues, { user: alice });
    const form = JSON.stringify(await t.view("new"));
    expect(form.indexOf('"type":"ImagePicker"')).toBeLessThan(form.indexOf('"name":"kind"'));
    expect(form).toContain('"name":"kind"');
    expect(form).toContain('"variant":"chips"');
    expect(form).toContain('"type":"LocationInput","name":"location"');
    expect(form).toContain('"type":"Switch","name":"anonymous"');
  });

  test("an anonymous report: members do not see the name, the admin does; a suggestion keeps its kind", async () => {
    const t = await testPlugin(issues, { user: alice });
    const { navigate } = await t.tool("report", {
      title: "Więcej ławek w parku",
      kind: "suggestion",
      anonymous: true,
    });
    const id = navigate!.params!.id!;
    expect(textsOf(await t.as(bob).view("detail", { id }))).toContain("Zgłoszenie anonimowe");
    expect(textsOf(await t.as(bob).view("detail", { id }))).not.toContain("Alice");
    expect(textsOf(await t.as(admin).view("detail", { id }))).toContain("Alice (anonimowo)");
    expect((await t.db.issues!.get(id))?.kind).toBe("suggestion");
  });

  test("input validation", async () => {
    const t = await testPlugin(issues);
    expect(t.invalidInput("report", { title: "x", category: "nie-ma" })?.map((i) => i.path[0])).toEqual([
      "title",
      "category",
    ]);
    expect(t.invalidInput("report", { title: "Latarnia", photo: "nie-plik" })?.[0]?.path).toEqual(["photo"]);
  });
});

describe("issues: on the map", () => {
  const floriańska = { lat: 50.06274, lng: 19.93986, address: "Floriańska 15, 31-019 Kraków" };
  type MapNode = Extract<UINode, { type: "Map" }>;
  const mapsOf = (node: UINode): MapNode[] => [
    ...(node.type === "Map" ? [node] : []),
    ...("children" in node && node.children ? node.children.flatMap(mapsOf) : []),
  ];

  test("the report form has a location field; a located report shows its address and pin", async () => {
    const t = await testPlugin(issues, { user: alice });
    const form = JSON.stringify(await t.view("new"));
    expect(form).toContain('"type":"LocationInput","name":"location"');

    const res = await t.tool("report", { title: "Nie świeci latarnia", category: "lighting", location: floriańska });
    const detail = await t.view("detail", res.navigate!.params);
    expect(textsOf(detail)).toContain("Floriańska 15, 31-019 Kraków");
    const [map] = mapsOf(detail);
    expect(map?.label).toBe("Miejsce zgłoszenia");
    expect(map?.layers[0]?.items).toEqual([
      expect.objectContaining({ title: "Nie świeci latarnia", at: { lat: floriańska.lat, lng: floriańska.lng } }),
    ]);
  });

  test("the list's map: open issues with a place, one layer per status; fixed and unplaced ones are not on it", async () => {
    const t = await testPlugin(issues, { user: alice });
    expect(mapsOf(await t.view("list"))).toEqual([]);
    const at = (lat: number) => ({ ...floriańska, lat });
    await t.tool("report", { title: "Dziura w chodniku", category: "roads", location: at(50.061) });
    const accepted = await t.tool("report", { title: "Złamana ławka", category: "other", location: at(50.062) });
    const fixed = await t.tool("report", { title: "Graffiti", category: "cleanliness", location: at(50.063) });
    await t.tool("report", { title: "Śmieci gdzieś w okolicy", category: "cleanliness" });
    await t.as(admin).tool("setStatus", { id: accepted.navigate!.params!.id, status: "accepted" });
    await t.as(admin).tool("setStatus", { id: fixed.navigate!.params!.id, status: "fixed" });

    const [map] = mapsOf(await t.view("list"));
    expect(map?.label).toBe("Mapa zgłoszeń");
    expect(map?.layers.map((l) => [l.title, l.tone, l.items.map((i) => i.title)])).toEqual([
      ["Nowe", "info", ["Dziura w chodniku"]],
      ["Przyjęte", "warning", ["Złamana ławka"]],
    ]);
    expect(map?.layers[0]?.items[0]?.onPress).toEqual({
      type: "navigate",
      view: "detail",
      params: { id: expect.any(String) },
    });
  });

  test("a bad place is rejected; the address goes to the AI with the description", async () => {
    const t = await testPlugin(issues, { user: alice });
    expect(t.invalidInput("report", { title: "Latarnia", location: { lat: 100, lng: 19 } })?.[0]?.path).toEqual([
      "location",
      "lat",
    ]);
    const asked: string[] = [];
    t.ai.mockSimilar((query) => {
      asked.push(query.text);
      return [];
    });
    await t.tool("report", { title: "Pierwsza", category: "other" });
    await t.tool("report", { title: "Nie świeci latarnia", location: floriańska });
    expect(asked.at(-1)).toBe("Nie świeci latarnia. Floriańska 15, 31-019 Kraków");
  });
});

describe("issues: similar reports", () => {
  test("AI finds the same problem → asks to merge, nothing saved", async () => {
    const t = await testPlugin(issues, { user: alice });
    lampsAreTheSame(t);
    const first = await t.tool("report", { title: "Pierwsza usterka", category: "lighting" });

    const photo = await t.as(bob).files.fake();
    const ask = await t.as(bob).tool("report", { title: "Nie działa latarnia", category: "lighting", photo });
    expect(ask.navigate?.view).toBe("merge");
    expect(ask.navigate?.params?.target).toBe(first.navigate!.params!.id!);
    expect(await t.files.isKept(photo)).toBe(false);
    expect(await t.db.issues!.count()).toBe(1);

    const question = await t.as(bob).view("merge", ask.navigate!.params);
    expect(textsOf(question)).toEqual(
      expect.arrayContaining(["Czy to ten sam problem?", "Ta sama latarnia przy przystanku", "Pierwsza usterka"]),
    );
  });

  test("merge: Bob's report with photo lands under the earlier one", async () => {
    const t = await testPlugin(issues, { user: alice });
    lampsAreTheSame(t);
    const first = await t.tool("report", { title: "Pierwsza usterka", category: "lighting" });
    const id = first.navigate!.params!.id!;
    const photo = await t.as(bob).files.fake();
    const ask = await t.as(bob).tool("report", { title: "Latarnia nie świeci", description: "Od tygodnia", photo });

    const merged = await t.as(bob).tool("merge", { target: id, draft: ask.navigate!.params!.draft! });
    expect(merged.navigate?.params?.id).toBe(id);
    expect(await t.files.isKept(photo)).toBe(true);
    expect(await t.db.issues!.count()).toBe(1);

    const detail = await t.as(bob).view("detail", { id });
    expect(textsOf(detail)).toEqual(
      expect.arrayContaining([
        "2 osoby zgłaszają",
        "Zgłoszenia mieszkańców (2)",
        "Bob",
        "Od tygodnia",
        "Zdjęcie od: Bob",
      ]),
    );
  });

  test('"different problem" (force) creates a new issue despite similarity', async () => {
    const t = await testPlugin(issues, { user: alice });
    lampsAreTheSame(t);
    await t.tool("report", { title: "Pierwsza usterka", category: "lighting" });
    const res = await t.as(bob).tool("report", { title: "Latarnia na Krótkiej", force: true });
    expect(res.navigate?.view).toBe("sent");
    expect(await t.db.issues!.count()).toBe(2);
  });

  test("repeated merge by the same person doesn't duplicate the resident's report", async () => {
    const t = await testPlugin(issues, { user: alice });
    const { navigate } = await t.tool("report", { title: "Dziura w chodniku", category: "roads" });
    const id = navigate!.params!.id!;
    await t.as(bob).tool("support", { id });
    await t.as(bob).tool("support", { id });
    expect(textsOf(await t.as(bob).view("detail", { id }))).toContain("2 osoby zgłaszają");
  });
});

describe("issues: data integrity", () => {
  test("deleting an issue removes its residents' reports (foreign key cascade)", async () => {
    const t = await testPlugin(issues, { user: alice });
    const { navigate } = await t.tool("report", { title: "Dziura w chodniku", category: "roads" });
    const id = navigate!.params!.id!;
    await t.as(bob).tool("support", { id });
    expect(await t.db.reports!.count()).toBe(2);
    await t.db.issues!.delete(id);
    expect(await t.db.reports!.count()).toBe(0);
  });

  test("a photo uploaded by someone else cannot be attached", async () => {
    const t = await testPlugin(issues, { user: alice });
    const bobsPhoto = await t.as(bob).files.fake();
    await expect(t.tool("report", { title: "Cudze zdjęcie", photo: bobsPhoto })).rejects.toThrow(
      "uploaded by another user",
    );
    expect(await t.db.issues!.count()).toBe(0);
  });
});

describe("issues: role", () => {
  test("only admin changes status; admin sees the buttons", async () => {
    const t = await testPlugin(issues, { user: alice });
    const { navigate } = await t.tool("report", { title: "Dziura w chodniku", category: "roads" });
    const id = navigate!.params!.id!;

    await expect(t.tool("setStatus", { id, status: "fixed" })).rejects.toBeInstanceOf(ForbiddenError);
    expect(textsOf(await t.view("detail", { id }))).not.toContain("Oznacz jako naprawione");

    expect(textsOf(await t.as(admin).view("detail", { id }))).toContain("Oznacz jako naprawione");
    expect((await t.as(admin).tool("setStatus", { id, status: "fixed" })).toast).toBe("Status: Naprawione");
    expect(textsOf(await t.view("detail", { id }))).toContain("Naprawione");
  });

  test("readOnly list tool returns data for the AI assistant", async () => {
    const t = await testPlugin(issues, { user: alice });
    await t.tool("report", { title: "Dziura w chodniku", category: "roads" });
    const { data } = await t.tool("list");
    expect(data).toEqual([expect.objectContaining({ title: "Dziura w chodniku", status: "open" })]);
  });
});

describe("issues: dashboard", () => {
  const carol = { id: "carol", name: "Carol", role: "user" } as const;
  const dave = { id: "dave", name: "Dave", role: "user" } as const;

  test("summary widget: the 3 open issues most residents report, tapping it opens the list", async () => {
    const t = await testPlugin(issues, { user: alice });
    const empty = (await t.dashboardWidget("summary"))!;
    expect(textsOf(empty)).toEqual(["Zgłoszenia", "Nie ma otwartych zgłoszeń.", "Zgłoś problem"]);
    expect(empty).toMatchObject({ onPress: { type: "navigate", view: "list" } });

    const report = async (title: string) => (await t.tool("report", { title })).navigate!.params!.id!;
    const support = (id: string, ...users: { id: string; name: string; role: "user" }[]) =>
      Promise.all(users.map((user) => t.as(user).tool("support", { id })));
    const bench = await report("Złamana ławka");
    const hole = await report("Dziura w chodniku");
    const lamp = await report("Nie świeci lampa");
    const bin = await report("Przewrócony kosz");
    await report("Graffiti na przystanku");
    await support(hole, bob, carol, dave);
    await support(lamp, bob);
    await support(bin, bob, carol);
    await support(bench, bob, carol, dave);
    await t.as(admin).tool("setStatus", { id: bench, status: "fixed" });

    const widget = (await t.dashboardWidget("summary"))!;
    expect(textsOf(widget)).toEqual([
      "Zgłoszenia",
      "Najczęściej zgłaszane",
      "Dziura w chodniku",
      "4 osoby zgłaszają",
      "Przewrócony kosz",
      "3 osoby zgłaszają",
      "Nie świeci lampa",
      "2 osoby zgłaszają",
      "Zgłoś problem",
    ]);
    expect(JSON.stringify(widget)).toContain(
      JSON.stringify({ type: "navigate", view: "detail", params: { id: hole } }),
    );
  });
});
