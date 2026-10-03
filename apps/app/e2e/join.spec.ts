import type { Page } from "@playwright/test";
import { t } from "../src/texts";
import { expect, test } from "./fixtures";

/**
 * Joining by a scanned invite (design E-PodgladMiejsca): the scanned code opens the place's preview, joining it
 * makes the place the current one on the dashboard; an unknown code says so.
 */
const DEMO_CODE = "KRKMST";

const register = async (page: Page, email: string) => {
  await page.goto("/register");
  await page.getByLabel(t.auth_email).fill(email);
  await page.getByLabel(t.auth_password).fill("password123");
  await page.getByRole("checkbox", { name: t.auth_consent }).click();
  await page.getByRole("button", { name: t.auth_submit_register }).click();
  await expect(page.getByRole("heading", { name: t.dashboard_empty_title })).toBeVisible();
};

test("a scanned invite opens the place preview; joining makes the place current", async ({ page }) => {
  await register(page, "preview@example.test");
  await page.goto(`/app/preview?code=${DEMO_CODE}`);
  await expect(page.getByRole("heading", { name: "Kraków", level: 1 })).toBeVisible();
  await expect(page.getByText(t.place_preview_code)).toBeVisible();
  await page.getByRole("button", { name: t.place_preview_join }).click();
  await expect(page.getByRole("heading", { name: "Kraków", level: 1 })).toBeVisible();
  await expect(page).toHaveURL(/\/app$/);
});

test("an unknown invite code says the place was not found", async ({ page }) => {
  await register(page, "unknown-code@example.test");
  await page.goto("/app/preview?code=ZZZZZZ");
  await expect(page.getByText(t.place_preview_not_found)).toBeVisible();
  await expect(page.getByRole("button", { name: t.place_preview_join })).toHaveCount(0);
});

const typeCode = async (page: Page, code: string) => {
  for (const [index, char] of [...code].entries()) {
    await page.getByRole("textbox", { name: `${t.join_code_char} ${index + 1}` }).fill(char);
  }
};

test("the code way: a typed invite code opens the place preview", async ({ page }) => {
  await register(page, "typed-code@example.test");
  await page.getByRole("link", { name: t.join_code }).click();
  await expect(page.getByRole("heading", { name: t.join_code_title, level: 1 })).toBeVisible();
  await typeCode(page, DEMO_CODE);
  await page.getByRole("button", { name: t.join_submit }).click();
  await expect(page.getByRole("heading", { name: "Kraków", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: t.place_preview_join })).toBeVisible();
});

test("the link way: a pasted invite link opens the place preview", async ({ page }) => {
  await register(page, "typed-link@example.test");
  await page.getByRole("link", { name: t.join_code }).click();
  await page.getByRole("tab", { name: t.join_tab_link }).click();
  await page.getByRole("textbox", { name: t.join_link_label }).fill(`twojemiejsce://app/preview?code=${DEMO_CODE}`);
  await page.getByRole("button", { name: t.join_submit }).click();
  await expect(page.getByRole("heading", { name: "Kraków", level: 1 })).toBeVisible();
});

test("an unknown typed code stays on the screen and says the place was not found", async ({ page }) => {
  await register(page, "typed-unknown@example.test");
  await page.getByRole("link", { name: t.join_code }).click();
  await typeCode(page, "ZZZZZZ");
  await page.getByRole("button", { name: t.join_submit }).click();
  await expect(page.getByText(t.join_not_found)).toBeVisible();
  await expect(page).toHaveURL(/\/app\/join-code$/);
});

test("the paste-link row opens the join screen on the link tab", async ({ page }) => {
  await register(page, "paste-row@example.test");
  await page.getByRole("link", { name: t.join_link }).click();
  await expect(page.getByRole("textbox", { name: t.join_link_label })).toBeVisible();
  await expect(page.getByRole("textbox", { name: `${t.join_code_char} 1` })).toHaveCount(0);
});
