import { expect, test } from "bun:test";
import { scanWindowPath } from "./scanWindow";

test("the window is centred and rounded: its outline starts at the top edge, after the corner radius", () => {
  const path = scanWindowPath(400, 800, 200, 20);
  // Outer rectangle, then the window: x = (400 - 200) / 2 = 100, y = (800 - 200) / 2 = 300.
  expect(path.startsWith("M0 0 H400 V800 H0 Z M120 300")).toBe(true);
  expect(path).toContain("H280");
  expect(path).toContain("V480");
});
