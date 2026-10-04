import { expect, expectAtBottom, loginAdmin, test } from "./fixtures";

/**
 * Actions within thumb reach (COMPONENTS.md → Screen): on a short plugin screen the closing actions sit at the bottom
 * edge instead of right under the content, and long content pushes them down. A form keeps its fields under the
 * content and sends its button down; a comment box under the comments goes down whole, as in a chat. Plugin texts
 * are server content, not app texts.
 */
test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAdmin(page);
});

test("a form's submit sits at the bottom edge; its fields stay under the lead", async ({ page }) => {
  await page.goto("/app/c/krakow/discussions/new");
  const topic = page.getByLabel("Temat");
  await expect(topic).toBeVisible();
  await expectAtBottom(page, page.getByRole("button", { name: "Załóż dyskusję" }));
  expect((await topic.boundingBox())?.y).toBeLessThan(400);

  await page.goto("/app/c/krakow/issues/new");
  await expect(page.getByRole("heading", { name: "Zrób zdjęcie", level: 1 })).toBeVisible();
  await expectAtBottom(page, page.getByRole("button", { name: "Pomiń zdjęcie" }));
});

test("a comment box goes to the bottom of a short report, under its comments", async ({ page }) => {
  await page.goto("/app/c/krakow/issues/new");
  await page.getByRole("button", { name: "Pomiń zdjęcie" }).click();
  await page.getByLabel("Tytuł").fill("Nie świeci latarnia na Długiej");
  await page.getByRole("button", { name: "Wyślij zgłoszenie" }).click();
  await page.getByText("Nie świeci latarnia na Długiej").click();
  await expect(page.getByRole("heading", { name: "Nie świeci latarnia na Długiej", level: 1 })).toBeVisible();
  await page.getByLabel("Dodaj komentarz").fill("Potwierdzam, od tygodnia");
  await page.getByRole("button", { name: "Wyślij komentarz" }).click();
  await expect(page.getByText("Potwierdzam, od tygodnia")).toBeVisible();

  await expectAtBottom(page, page.getByRole("button", { name: "Wyślij komentarz" }));
});
