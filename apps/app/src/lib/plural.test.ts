import { describe, expect, test } from "bun:test";
import { countOf, widgetsCount } from "./plural";

describe("widgetsCount", () => {
  test("Polish plural forms", () => {
    expect(widgetsCount(0)).toBe("0 widżetów");
    expect(widgetsCount(1)).toBe("1 widżet");
    expect(widgetsCount(2)).toBe("2 widżety");
    expect(widgetsCount(4)).toBe("4 widżety");
    expect(widgetsCount(5)).toBe("5 widżetów");
    expect(widgetsCount(12)).toBe("12 widżetów");
    expect(widgetsCount(22)).toBe("22 widżety");
  });
});

describe("countOf", () => {
  test("picks the noun form for the number", () => {
    const people = ["osoba", "osoby", "osób"] as const;
    expect([1, 2, 5, 13, 23, 0].map((n) => countOf(n, people))).toEqual([
      "1 osoba",
      "2 osoby",
      "5 osób",
      "13 osób",
      "23 osoby",
      "0 osób",
    ]);
  });
});
