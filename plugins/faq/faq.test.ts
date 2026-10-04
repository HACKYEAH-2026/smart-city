import { describe, expect, test } from "bun:test";
import { ForbiddenError, testPlugin, textsOf } from "@app/plugin-sdk/testing";
import faq from "./index";

const city = { id: "city", name: "Urząd", role: "admin" } as const;
const anna = { id: "anna", name: "Anna", role: "user" } as const;

type T = Awaited<ReturnType<typeof testPlugin>>;
const add = async (t: T, question: string, answer = "Odpowiedź.") =>
  ((await t.as(city).tool("addEntry", { question, answer })).data as { id: string }).id;
const questions = async (t: T) => ((await t.tool("listFaq")).data as { question: string }[]).map((e) => e.question);

describe("faq", () => {
  test("everyone reads; only admins see the editing controls", async () => {
    const t = await testPlugin(faq, { user: anna });
    expect(textsOf(await t.view("list"))).toContain("FAQ jest jeszcze puste.");
    await add(t, "Kiedy jest wywóz śmieci?", "We wtorki i piątki.");

    const resident = textsOf(await t.view("list"));
    expect(resident).toEqual(expect.arrayContaining(["Kiedy jest wywóz śmieci?", "We wtorki i piątki."]));
    expect(resident).not.toContain("Nowe pytanie");
    expect(resident).not.toContain("Edytuj");
    const admin = textsOf(await t.as(city).view("list"));
    expect(admin).toEqual(expect.arrayContaining(["Nowe pytanie", "Edytuj", "Usuń"]));
    expect(textsOf(await t.view("edit", { id: "x" }))).toContain("FAQ edytują tylko administratorzy.");
  });

  test("residents cannot change the FAQ", async () => {
    const t = await testPlugin(faq, { user: anna });
    const id = await add(t, "Kiedy jest wywóz śmieci?");
    await expect(t.tool("addEntry", { question: "Moje pytanie", answer: "Tak" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(t.tool("updateEntry", { id, question: "Zmienione", answer: "Tak" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(t.tool("moveEntry", { id, direction: "up" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(t.tool("removeEntry", { id })).rejects.toBeInstanceOf(ForbiddenError);
  });

  test("admins edit, reorder and remove entries", async () => {
    const t = await testPlugin(faq, { user: anna });
    const a = await add(t, "Pierwsze pytanie");
    await add(t, "Drugie pytanie");
    const c = await add(t, "Trzecie pytanie");
    expect(await questions(t)).toEqual(["Pierwsze pytanie", "Drugie pytanie", "Trzecie pytanie"]);

    await t.as(city).tool("moveEntry", { id: c, direction: "up" });
    expect(await questions(t)).toEqual(["Pierwsze pytanie", "Trzecie pytanie", "Drugie pytanie"]);
    await t.as(city).tool("moveEntry", { id: a, direction: "down" });
    expect(await questions(t)).toEqual(["Trzecie pytanie", "Pierwsze pytanie", "Drugie pytanie"]);
    await t.as(city).tool("moveEntry", { id: c, direction: "up" });
    expect(await questions(t)).toEqual(["Trzecie pytanie", "Pierwsze pytanie", "Drugie pytanie"]);

    expect((await t.as(city).tool("updateEntry", { id: a, question: "Pierwsze (poprawione)", answer: "Nowa." })).toast).toBe(
      "Zmiany zapisane.",
    );
    expect(textsOf(await t.view("entry", { id: a }))).toEqual(expect.arrayContaining(["Pierwsze (poprawione)", "Nowa."]));

    expect((await t.as(city).tool("removeEntry", { id: a })).toast).toBe("Pytanie usunięte z FAQ.");
    expect((await t.as(city).tool("removeEntry", { id: a })).error).toBe("Tego pytania nie ma w FAQ.");
    expect((await t.as(city).tool("updateEntry", { id: a, question: "Nie ma", answer: "x" })).error).toBe(
      "Tego pytania nie ma w FAQ.",
    );
    expect(await questions(t)).toEqual(["Trzecie pytanie", "Drugie pytanie"]);
  });

  test("validation", async () => {
    const t = await testPlugin(faq, { user: city });
    expect(t.invalidInput("addEntry", { question: "x", answer: "  " })?.map((i) => i.message)).toEqual([
      "Pytanie jest za krótkie",
      "Odpowiedź nie może być pusta",
    ]);
  });

  test("widget: hidden while the FAQ is empty, then shows the first questions", async () => {
    const t = await testPlugin(faq, { user: anna });
    expect(await t.dashboardWidget("top")).toBeNull();
    for (const q of ["Pytanie 1", "Pytanie 2", "Pytanie 3", "Pytanie 4"]) await add(t, q);
    expect(textsOf((await t.dashboardWidget("top"))!)).toEqual([
      "FAQ",
      "Pytanie 1",
      "Pytanie 2",
      "Pytanie 3",
      "Wszystkie pytania (4)",
    ]);
  });
});
