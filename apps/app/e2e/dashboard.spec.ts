import type { Page } from "@playwright/test";
import { t } from "../src/texts";
import { expect, joinKrakow, register, test } from "./fixtures";

/**
 * Dashboard acceptance criteria (designs E-BrakMiejsc, E-Dashboard, E-PrzelacznikMiejsc): after sign-in the user
 * lands on the dashboard of their current place, with the bottom bar. A user without places gets the "no places"
 * screen instead: the ways to join and creating their own place, without the bottom bar. The place name and the
 * Places tab both open the place switcher; there is no separate list of places.
 */
/** Through the "new place" wizard with the least answers (create-place.spec.ts covers the wizard itself). */
const createPlace = async (page: Page, name: string) => {
  await page.getByRole("link", { name: t.place_create_own }).click();
  await page.getByRole("radio", { name: t.place_kind_estate }).click();
  await page.getByRole("button", { name: t.create_next }).click();
  await page.getByLabel(t.create_name).fill(name);
  await page.getByRole("button", { name: t.create_next }).click();
  await page.getByRole("button", { name: t.create_next }).click(); // features: the defaults
  await page.getByRole("button", { name: t.create_submit }).click();
  await page.getByRole("button", { name: t.created_go_dashboard }).click();
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
};

test("a user without places sees the ways to join and creating their own place", async ({ page }) => {
  await register(page, "empty@example.test");
  await expect(page.getByText(t.dashboard_empty_label)).toBeVisible();
  await expect(page.getByRole("heading", { name: t.join_methods_title, level: 2 })).toBeVisible();
  await expect(page.getByRole("link", { name: t.join_qr })).toBeVisible();
  for (const name of [t.join_code, t.join_link, t.join_invites]) {
    await expect(page.getByText(name, { exact: true })).toBeVisible();
  }
  await expect(page.getByRole("link", { name: t.place_create_own })).toBeVisible();
  await expect(page.getByRole("navigation", { name: t.nav_main })).toHaveCount(0);
});

test("on the no-places screen the avatar opens the account", async ({ page }) => {
  await register(page, "ways@example.test");
  await page.goto("/app");
  await page.getByRole("button", { name: t.account_title }).click();
  await expect(page.getByRole("heading", { name: t.account_title, level: 1 })).toBeVisible();
});

test("the QR option opens the scanner with a way back and manual code entry", async ({ page }) => {
  await register(page, "scan@example.test");
  await page.getByRole("link", { name: t.join_qr }).click();
  await expect(page.getByText(t.scan_title, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: t.close })).toBeVisible();
  await expect(page.getByRole("button", { name: t.scan_enter_code })).toBeVisible();
});

test("the dashboard shows the current place, the place's features and the bottom bar", async ({ page, api }) => {
  await register(page, "member@example.test");
  await joinKrakow(api.url, "member@example.test");
  await page.goto("/app");
  await expect(page.getByRole("heading", { name: "Kraków", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: `${t.dashboard_open}: Zgłoszenia`, exact: true })).toBeVisible();
  const bar = page.getByRole("navigation", { name: t.nav_main });
  await expect(bar.getByRole("link", { name: t.tab_dashboard })).toHaveAttribute("aria-current", "page");
  await expect(bar.getByRole("link", { name: t.tab_places })).toBeVisible();
  await expect(bar.getByRole("link", { name: t.tab_account })).toBeVisible();
});

test("clicking the place name opens the place switcher with set-as-default, join and create", async ({ page, api }) => {
  await register(page, "switch@example.test");
  await joinKrakow(api.url, "switch@example.test");
  await page.goto("/app");
  await page.getByRole("button", { name: `${t.place_switch}: Kraków` }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("heading", { name: t.places_sheet_title })).toBeInViewport();
  await expect(sheet.getByRole("button", { name: t.place_set_default })).toBeVisible();
  await expect(sheet.getByRole("button", { name: t.place_join, exact: true })).toBeVisible();
  await expect(sheet.getByRole("button", { name: t.place_create, exact: true })).toBeVisible();
});

test("join in the place switcher opens the join screen", async ({ page, api }) => {
  await register(page, "sheet-join@example.test");
  await joinKrakow(api.url, "sheet-join@example.test");
  await page.goto("/app");
  await page.getByRole("button", { name: `${t.place_switch}: Kraków` }).click();
  await page.getByRole("dialog").getByRole("button", { name: t.place_join, exact: true }).click();
  await expect(page.getByRole("heading", { name: t.join_hero_title })).toBeVisible();
});

test("create in the place switcher opens the create form", async ({ page, api }) => {
  await register(page, "sheet-create@example.test");
  await joinKrakow(api.url, "sheet-create@example.test");
  await page.goto("/app");
  await page.getByRole("button", { name: `${t.place_switch}: Kraków` }).click();
  await page.getByRole("dialog").getByRole("button", { name: t.place_create, exact: true }).click();
  await expect(page.getByText(t.create_step_1)).toBeVisible();
});

test("the Places tab opens the place switcher over the dashboard", async ({ page, api }) => {
  await register(page, "tab@example.test");
  await joinKrakow(api.url, "tab@example.test");
  await page.goto("/app/account");
  await page.getByRole("navigation", { name: t.nav_main }).getByRole("link", { name: t.tab_places }).click();
  // The sheet opens on arrival, not only after a tap on the dashboard.
  await expect(page.getByRole("dialog").getByRole("heading", { name: t.places_sheet_title })).toBeInViewport();
  await expect(page).toHaveURL(/\/app\?places=1$/);
});

test("leaving the Account tab for the dashboard shows no place switcher; the dashboard takes taps", async ({
  page,
  api,
}) => {
  await register(page, "tabs-back@example.test");
  await joinKrakow(api.url, "tabs-back@example.test");
  await page.goto("/app/account");
  await page.getByRole("navigation", { name: t.nav_main }).getByRole("link", { name: t.tab_dashboard }).click();
  await expect(page.getByRole("heading", { name: "Kraków", level: 1 })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("link", { name: `${t.dashboard_open}: Zgłoszenia`, exact: true }).click();
  await expect(page.getByRole("heading", { name: "Zgłoszenia", level: 1 })).toBeVisible();
});

test("the close button closes the place switcher, opened from the tab or from the place name", async ({
  page,
  api,
}) => {
  await register(page, "sheet-close@example.test");
  await joinKrakow(api.url, "sheet-close@example.test");
  await page.goto("/app/account");
  await page.getByRole("navigation", { name: t.nav_main }).getByRole("link", { name: t.tab_places }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("heading", { name: t.places_sheet_title })).toBeInViewport();
  await sheet.getByRole("button", { name: t.close }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page).toHaveURL(/\/app$/);

  await page.getByRole("button", { name: `${t.place_switch}: Kraków` }).click();
  await expect(sheet.getByRole("heading", { name: t.places_sheet_title })).toBeInViewport();
  await sheet.getByRole("button", { name: t.close }).click();
  await expect(sheet).toHaveCount(0);
});

test("picking a place in the switcher makes it the current place", async ({ page, api }) => {
  await register(page, "pick@example.test");
  await createPlace(page, "Osiedle Testowe");
  await joinKrakow(api.url, "pick@example.test");
  await page.goto("/app");
  await page.getByRole("button", { name: `${t.place_switch}: Osiedle Testowe` }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("button", { name: "Kraków" }).click();
  await sheet.getByRole("button", { name: t.close }).click();
  await expect(page.getByRole("heading", { name: "Kraków", level: 1 })).toBeVisible();
});

test("creating a place makes it the current place", async ({ page }) => {
  await register(page, "creator@example.test");
  await createPlace(page, "Osiedle Testowe");
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
