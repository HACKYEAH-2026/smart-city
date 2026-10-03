import { describe, expect, test } from "bun:test";
import { ForbiddenError, testPlugin, textsOf } from "@app/plugin-sdk/testing";
import issues from "./index";

const alice = { id: "alice", name: "Alice", role: "user" } as const;
const bob = { id: "bob", name: "Bob", role: "user" } as const;
const admin = { id: "urzad", name: "Urząd", role: "admin" } as const;

/** The AI "sees" the same problem when the text contains the word "latarnia". */
const lampsAreTheSame = (t: ReturnType<typeof testPlugin>) =>
  t.ai.mockSimilar((query, candidates) =>
    query.text.toLowerCase().includes("latarnia")
      ? candidates.slice(0, 1).map((doc) => ({ doc, score: 0.9, reason: "Ta sama latarnia przy przystanku" }))
      : [],
  );

describe("issues: reporting", () => {
  test("empty list → report with photo → details", async () => {
    const t = testPlugin(issues, { user: alice });
    expect(textsOf(await t.view("list"))).toContain("Nie ma jeszcze zgłoszeń. Zgłoś pierwszą usterkę.");

    const photo = t.files.fake();
    const res = await t.tool("report", {
      title: "Nie świeci lampa",
      category: "lighting",
      description: "Długa 12",
      photo,
    });
    expect(res.toast).toContain("Dziękujemy");
    expect(t.files.isKept(photo)).toBe(true);

    const detail = await t.view("detail", res.navigate!.params);
    expect(textsOf(detail)).toEqual(
      expect.arrayContaining(["Nie świeci lampa", "Długa 12", "1 osoba zgłasza", "Zgłaszasz ten problem"]),
    );
    expect(textsOf(detail)).toContain("Zdjęcie: Nie świeci lampa");
  });

  test("input validation", () => {
    const t = testPlugin(issues);
    expect(t.invalidInput("report", { title: "x", category: "nie-ma" })?.map((i) => i.path[0])).toEqual([
      "title",
      "category",
    ]);
    expect(t.invalidInput("report", { title: "Latarnia", photo: "nie-plik" })?.[0]?.path).toEqual(["photo"]);
  });
});

describe("issues: similar reports", () => {
  test("AI finds the same problem → asks to merge, nothing saved", async () => {
    const t = testPlugin(issues, { user: alice });
    lampsAreTheSame(t);
    const first = await t.tool("report", { title: "Pierwsza usterka", category: "lighting" });

    const photo = t.as(bob).files.fake();
    const ask = await t.as(bob).tool("report", { title: "Nie działa latarnia", category: "lighting", photo });
    expect(ask.navigate?.view).toBe("merge");
    expect(ask.navigate?.params?.target).toBe(first.navigate!.params!.id!);
    expect(t.files.isKept(photo)).toBe(false);
    expect(await t.storage.list("issues")).toHaveLength(1);

    const question = await t.as(bob).view("merge", ask.navigate!.params);
    expect(textsOf(question)).toEqual(
      expect.arrayContaining(["Czy to ten sam problem?", "Ta sama latarnia przy przystanku", "Pierwsza usterka"]),
    );
  });

  test("merge: Bob's report with photo lands under the earlier one", async () => {
    const t = testPlugin(issues, { user: alice });
    lampsAreTheSame(t);
    const first = await t.tool("report", { title: "Pierwsza usterka", category: "lighting" });
    const id = first.navigate!.params!.id!;
    const photo = t.as(bob).files.fake();
    const ask = await t.as(bob).tool("report", { title: "Latarnia nie świeci", description: "Od tygodnia", photo });

    const merged = await t.as(bob).tool("merge", { target: id, draft: ask.navigate!.params!.draft! });
    expect(merged.navigate?.params?.id).toBe(id);
    expect(t.files.isKept(photo)).toBe(true);
    expect(await t.storage.list("issues")).toHaveLength(1);

    const detail = await t.as(bob).view("detail", { id });
    expect(textsOf(detail)).toEqual(
      expect.arrayContaining(["2 osób zgłasza", "Zgłoszenia mieszkańców (2)", "Bob", "Od tygodnia", "Zdjęcie od: Bob"]),
    );
  });

  test('"different problem" (force) creates a new issue despite similarity', async () => {
    const t = testPlugin(issues, { user: alice });
    lampsAreTheSame(t);
    await t.tool("report", { title: "Pierwsza usterka", category: "lighting" });
    const res = await t.as(bob).tool("report", { title: "Latarnia na Krótkiej", force: true });
    expect(res.toast).toContain("Dziękujemy");
    expect(await t.storage.list("issues")).toHaveLength(2);
  });

  test("repeated merge by the same person doesn't duplicate the resident's report", async () => {
    const t = testPlugin(issues, { user: alice });
    const { navigate } = await t.tool("report", { title: "Dziura w chodniku", category: "roads" });
    const id = navigate!.params!.id!;
    await t.as(bob).tool("support", { id });
    await t.as(bob).tool("support", { id });
    expect(textsOf(await t.as(bob).view("detail", { id }))).toContain("2 osób zgłasza");
  });
});

describe("issues: role", () => {
  test("only admin changes status; admin sees the buttons", async () => {
    const t = testPlugin(issues, { user: alice });
    const { navigate } = await t.tool("report", { title: "Dziura w chodniku", category: "roads" });
    const id = navigate!.params!.id!;

    await expect(t.tool("setStatus", { id, status: "fixed" })).rejects.toBeInstanceOf(ForbiddenError);
    expect(textsOf(await t.view("detail", { id }))).not.toContain("Oznacz jako naprawione");

    expect(textsOf(await t.as(admin).view("detail", { id }))).toContain("Oznacz jako naprawione");
    expect((await t.as(admin).tool("setStatus", { id, status: "fixed" })).toast).toBe("Status: Naprawione");
    expect(textsOf(await t.view("detail", { id }))).toContain("Naprawione");
  });

  test("readOnly list tool returns data for the AI assistant", async () => {
    const t = testPlugin(issues, { user: alice });
    await t.tool("report", { title: "Dziura w chodniku", category: "roads" });
    const { data } = await t.tool("list");
    expect(data).toEqual([expect.objectContaining({ title: "Dziura w chodniku", status: "open" })]);
  });
});
