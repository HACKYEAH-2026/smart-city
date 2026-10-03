import { describe, expect, test } from "bun:test";
import { passwordStrength } from "./passwordStrength";

describe("passwordStrength", () => {
  test("empty password fails every check, starting with length", () => {
    expect(passwordStrength("")).toEqual({ score: 0, missing: "length" });
  });

  test("lowercase with a digit is missing the case check", () => {
    expect(passwordStrength("password123")).toEqual({ score: 2, missing: "case" });
  });

  test("mixed case, digit, symbol and 8+ characters is strong", () => {
    expect(passwordStrength("Password123!")).toEqual({ score: 4, missing: null });
  });

  test("a short password counts only the checks it passes", () => {
    expect(passwordStrength("Ab1!")).toEqual({ score: 3, missing: "length" });
  });
});
