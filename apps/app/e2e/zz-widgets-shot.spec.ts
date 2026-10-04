import { expect, loginAdmin, seedDemoContent, test } from "./fixtures";
test("temporary widgets screenshot", async ({ page, api }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedDemoContent(api.url);
  await loginAdmin(page);
  await page.goto("/app");
  await expect(page.getByRole("heading", { name: "Kraków", level: 1 })).toBeVisible();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: process.env.SHOT_PATH ?? "w.png", fullPage: true });
});
