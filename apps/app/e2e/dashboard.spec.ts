import type { Page } from "@playwright/test";
import { t } from "../src/texts";
import { expect, joinKrakow, test } from "./fixtures";

/**
 * Dashboard acceptance criteria: after sign-in the user lands on the dashboard of their current place, with the
 * bottom bar; a user without places is told to create or join one; the place name opens the switcher.
 */
const register = async (page: Page, email: string) => {
  await page.goto("/register");
  await page.getByLabel(t.auth_email).fill(email);
  await page.getByLabel(t.auth_password).fill("password123");
  await page.getByRole("checkbox", { name: t.auth_consent }).click();
  await page.getByRole("button", { name: t.auth_submit_register }).click();
  await expect(page.getByRole("heading", { name: t.dashboard_empty_title })).toBeVisible();
};

test("a user without places sees the empty state with create and join", async ({ page }) => {
  await register(page, "empty@example.test");
  await expect(page.getByText(t.dashboard_empty_body)).toBeVisible();
  await expect(page.getByRole("button", { name: t.place_create })).toBeVisible();
  await expect(page.getByRole("button", { name: t.place_join })).toBeVisible();
});

test("the dashboard shows the current place, the place's features and the bottom bar", async ({ page, api }) => {
  await register(page, "member@example.test");
  await joinKrakow(api.url, "member@example.test");
  await page.goto("/app");
  await expect(page.getByRole("heading", { name: "Kraków", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Zgłoszenia" })).toBeVisible();
  const bar = page.getByRole("navigation", { name: t.nav_main });
  await expect(bar.getByRole("link", { name: t.tab_dashboard })).toHaveAttribute("aria-current", "page");
  await expect(bar.getByRole("link", { name: t.tab_places })).toBeVisible();
  await expect(bar.getByRole("link", { name: t.tab_account })).toBeVisible();
});

test("clicking the place name opens the places sheet with set-as-default", async ({ page, api }) => {
  await register(page, "switch@example.test");
  await joinKrakow(api.url, "switch@example.test");
  await page.goto("/app");
  await page.getByRole("button", { name: "Kraków" }).click();
  await expect(page.getByRole("heading", { name: t.places_sheet_title })).toBeVisible();
  await expect(page.getByRole("button", { name: t.place_set_default })).toBeVisible();
});

test("creating a place makes it the current place", async ({ page }) => {
  await register(page, "creator@example.test");
  await page.getByRole("button", { name: t.place_create }).click();
  await page.getByLabel(t.create_name).fill("Osiedle Testowe");
  await page.getByRole("button", { name: t.create_submit }).click();
  await expect(page.getByRole("heading", { name: "Osiedle Testowe", level: 1 })).toBeVisible();
});

test("the Account tab is a placeholder with sign out", async ({ page, api }) => {
  await register(page, "account@example.test");
  await joinKrakow(api.url, "account@example.test");
  await page.goto("/app");
  await page.getByRole("navigation", { name: t.nav_main }).getByRole("link", { name: t.tab_account }).click();
  await expect(page.getByRole("heading", { name: t.account_title, level: 1 })).toBeVisible();
  await page.getByRole("button", { name: t.sign_out }).click();
  await expect(page).toHaveURL(/\/login$/);
});
