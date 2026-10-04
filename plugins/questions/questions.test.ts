import { describe, expect, test } from "bun:test";
import type { PluginUser } from "@app/plugin-sdk";
import { ForbiddenError, testPlugin, textsOf } from "@app/plugin-sdk/testing";
import questions from "./index";

const city = { id: "city", name: "Urząd", role: "admin" } as const;
const anna = { id: "anna", name: "Anna", role: "user" } as const;
const bartek = { id: "bartek", name: "Bartek", role: "user" } as const;

type T = Awaited<ReturnType<typeof testPlugin>>;
const ask = async (t: T, user: PluginUser, title: string, details?: string) =>
  ((await t.as(user).tool("ask", { title, ...(details ? { details } : {}) })).data as { id: string }).id;

describe("questions", () => {
  test("residents ask; everyone sees the question waiting for an answer", async () => {
    const t = await testPlugin(questions, { user: anna });
    expect(textsOf(await t.view("list"))).toEqual(expect.arrayContaining(["Twoje pytanie", "Nie ma jeszcze pytań."]));
    expect(textsOf(await t.as(city).view("list"))).not.toContain("Twoje pytanie");

    const id = await ask(t, anna, "Kiedy wywóz gabarytów?", "Na osiedlu Słonecznym.");
    expect(textsOf(await t.as(bartek).view("item", { id }))).toEqual(
      expect.arrayContaining([
        "Kiedy wywóz gabarytów?",
        "Na osiedlu Słonecznym.",
        "Czeka na odpowiedź",
        "Pyta: Anna",
        "Administrator jeszcze nie odpowiedział.",
      ]),
    );
    expect(textsOf(await t.as(bartek).view("list"))).toContain("Kiedy wywóz gabarytów?");
  });

  test("only admins answer; answering again replaces the answer", async () => {
    const t = await testPlugin(questions, { user: anna });
    const id = await ask(t, anna, "Kiedy wywóz gabarytów?");

    await expect(t.tool("answer", { id, answer: "Jutro" })).rejects.toBeInstanceOf(ForbiddenError);
    expect(textsOf(await t.view("item", { id }))).not.toContain("Odpowiedz");
    expect(textsOf(await t.as(city).view("item", { id }))).toContain("Odpowiedz");

    expect((await t.as(city).tool("answer", { id, answer: "W najbliższą sobotę." })).toast).toBe("Odpowiedź zapisana.");
    expect(textsOf(await t.view("item", { id }))).toEqual(
      expect.arrayContaining(["Odpowiedziano", "W najbliższą sobotę."]),
    );
    expect(textsOf(await t.as(city).view("item", { id }))).toContain("Zmień odpowiedź");

    await t.as(city).tool("answer", { id, answer: "Przełożone na niedzielę." });
    const texts = textsOf(await t.view("item", { id }));
    expect(texts).toContain("Przełożone na niedzielę.");
    expect(texts).not.toContain("W najbliższą sobotę.");

    expect((await t.as(city).tool("answer", { id: "nie-ma", answer: "?" })).error).toBe("To pytanie nie istnieje.");
  });

  test("authors remove only their own questions; admins remove any", async () => {
    const t = await testPlugin(questions, { user: anna });
    const annas = await ask(t, anna, "Gdzie jest punkt PSZOK?");
    const bartkas = await ask(t, bartek, "Czy będzie nowy plac zabaw?");

    expect(textsOf(await t.as(bartek).view("item", { id: annas }))).not.toContain("Usuń pytanie");
    expect(textsOf(await t.view("item", { id: annas }))).toContain("Usuń pytanie");
    expect(textsOf(await t.as(city).view("item", { id: annas }))).toContain("Usuń pytanie");

    expect((await t.as(bartek).tool("remove", { id: annas })).error).toBe("Możesz usuwać tylko swoje pytania.");
    expect((await t.tool("remove", { id: annas })).toast).toBe("Pytanie usunięte.");
    expect((await t.tool("remove", { id: annas })).error).toBe("To pytanie nie istnieje.");

    await t.as(city).tool("remove", { id: bartkas });
    expect(await t.db.questions!.count()).toBe(0);
  });

  test("validation", async () => {
    const t = await testPlugin(questions, { user: anna });
    expect(t.invalidInput("ask", { title: "x" })?.[0]?.message).toBe("Pytanie jest za krótkie");
    expect(t.invalidInput("answer", { id: "q", answer: "   " })?.[0]?.message).toBe("Odpowiedź nie może być pusta");
  });

  test("a deleted author's questions are removed (reference cascade)", async () => {
    const t = await testPlugin(questions, { user: anna });
    await ask(t, anna, "Kiedy wywóz gabarytów?");
    await t.deleteUser("anna");
    expect(await t.db.questions!.count()).toBe(0);
  });

  test("listQuestions returns questions with answers for the AI assistant", async () => {
    const t = await testPlugin(questions, { user: anna });
    const id = await ask(t, anna, "Kiedy wywóz gabarytów?");
    await t.as(city).tool("answer", { id, answer: "W sobotę." });
    const { data } = await t.tool("listQuestions");
    expect(data).toEqual([
      expect.objectContaining({ id, title: "Kiedy wywóz gabarytów?", status: "answered", answer: "W sobotę." }),
    ]);
  });
});

describe("questions: dashboard", () => {
  test("admins see how many questions wait for an answer; residents see nothing", async () => {
    const t = await testPlugin(questions, { user: anna });
    expect(await t.as(city).dashboardWidget("pending")).toBeNull();

    const first = await ask(t, anna, "Kiedy wywóz gabarytów?");
    await ask(t, bartek, "Czy będzie nowy plac zabaw?");
    expect(await t.dashboardWidget("pending")).toBeNull();
    expect(textsOf((await t.as(city).dashboardWidget("pending"))!)).toEqual([
      "Pytania mieszkańców",
      "2 pytania czekają na odpowiedź",
      "Odpowiedz na pytania",
    ]);

    await t.as(city).tool("answer", { id: first, answer: "W sobotę." });
    expect(textsOf((await t.as(city).dashboardWidget("pending"))!)).toContain("1 pytanie czeka na odpowiedź");
  });
});
