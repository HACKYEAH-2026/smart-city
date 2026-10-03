import { describe, expect, test } from "bun:test";
import { NOTE_TITLE_MAX, noteCreateSchema, noteUpdateSchema } from "./notes";

describe("noteCreateSchema", () => {
  test("przycina tytuł i ustawia domyślną treść", () => {
    expect(noteCreateSchema.parse({ title: "  Zakupy  " })).toEqual({ title: "Zakupy", body: "" });
  });

  test("odrzuca pusty tytuł (także same spacje)", () => {
    expect(noteCreateSchema.safeParse({ title: "   " }).success).toBe(false);
  });

  test("odrzuca za długi tytuł", () => {
    const r = noteCreateSchema.safeParse({ title: "x".repeat(NOTE_TITLE_MAX + 1) });
    expect(r.success).toBe(false);
  });
});

describe("noteUpdateSchema", () => {
  test("pozwala na częściową aktualizację", () => {
    expect(noteUpdateSchema.parse({ body: "nowa" })).toEqual({ body: "nowa" });
  });

  test("odrzuca pusty obiekt", () => {
    expect(noteUpdateSchema.safeParse({}).success).toBe(false);
  });
});
