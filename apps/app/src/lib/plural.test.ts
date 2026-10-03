import { describe, expect, test } from "bun:test";
import { widgetsCount } from "./plural";

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
