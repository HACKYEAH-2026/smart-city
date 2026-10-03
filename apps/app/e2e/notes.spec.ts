import { expect, test } from "@app/testing/playwright";
import type { Page } from "@playwright/test";
import { en } from "./messages";

/**
 * Kryteria akceptacji przekroju "notes" (SPEC: scenariusze E2E).
 * Nowa funkcja = nowy plik *.spec.ts z kryteriów w SPEC.md, pisany PRZED implementacją.
 */
const register = async (page: Page, email: string) => {
  await page.goto("/register");
  await page.getByLabel(en.auth_email!).fill(email);
  await page.getByLabel(en.auth_password!).fill("password123");
  await page.getByRole("button", { name: en.auth_submit_register }).click();
  await expect(page.getByRole("heading", { name: en.notes_title })).toBeVisible();
};

test("register -> add a note -> reload -> the note is there", async ({ page }) => {
  await register(page, "e2e@example.test");
  await expect(page.getByText(en.notes_empty!)).toBeVisible();

  await page.getByLabel(en.notes_field_title!).fill("Buy milk");
  await page.getByLabel(en.notes_field_body!).fill("2 litres");
  await page.getByRole("button", { name: en.notes_add }).click();
  const list = page.getByRole("list", { name: en.notes_list_label });
  await expect(list.getByRole("heading", { name: "Buy milk" })).toBeVisible();

  await page.reload();
  await expect(list.getByRole("heading", { name: "Buy milk" })).toBeVisible();
  await expect(list.getByText("2 litres")).toBeVisible();
});

test("edit and delete a note", async ({ page }) => {
  await register(page, "edit@example.test");
  await page.getByLabel(en.notes_field_title!).fill("Version 1");
  await page.getByRole("button", { name: en.notes_add }).click();
  const list = page.getByRole("list", { name: en.notes_list_label });
  await list.getByRole("button", { name: en.notes_edit }).click();
  await list.getByLabel(en.notes_field_title!).fill("Version 2");
  await list.getByRole("button", { name: en.notes_save }).click();
  await expect(list.getByRole("heading", { name: "Version 2" })).toBeVisible();

  await list.getByRole("button", { name: en.notes_delete }).click();
  await expect(page.getByText(en.notes_empty!)).toBeVisible();
});
