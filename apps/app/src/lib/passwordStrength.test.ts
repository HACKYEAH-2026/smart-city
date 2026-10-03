import { describe, expect, test } from "bun:test";
import { MIN_PASSWORD_LENGTH, passwordStrength } from "./passwordStrength";

describe("passwordStrength", () => {
  test("the only rule is the length: 5 characters", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(5);
    expect(passwordStrength("abcd").missing).toBe("length");
    expect(passwordStrength("abcde").missing).toBeNull();
  });

  test("no other rule: case, digits and symbols do not matter", () => {
    for (const password of ["HASLO", "haslo", "12345", "!!!!!", "Ąęśćź"]) {
      expect(passwordStrength(password)).toEqual({ score: 4, missing: null });
    }
  });

  test("the meter fills as the password approaches the minimum and is full only when it is met", () => {
    expect(["", "a", "ab", "abc", "abcd", "abcde", "abcdefghij"].map((p) => passwordStrength(p).score)).toEqual([
      0, 0, 1, 2, 3, 4, 4,
    ]);
  });
});
