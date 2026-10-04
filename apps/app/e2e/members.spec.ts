import type { Page } from "@playwright/test";
import { t } from "../src/texts";
import { DEMO_ADMIN_NAME, expect, joinKrakow, loginAdmin, register, signOut, test } from "./fixtures";

/**
 * All members of a place (design E-Czlonkowie), for its admins only: filters by role, search by name, and per member
 * granting or revoking admin rights and removing them from the place. A registered user's name is their email.
 */
const openMembers = async (page: Page) => {
  await page.goto("/app/c/krakow/members");
  await expect(page.getByRole("heading", { name: t.manage_members_title, level: 1 })).toBeVisible();
};

/** Registers each user, makes them members of Kraków, and signs in as its admin. */
const withMembers = async (page: Page, apiUrl: string, emails: string[]) => {
  for (const email of emails) {
    await register(page, email);
    await joinKrakow(apiUrl, email);
    await signOut(page);
  }
  await loginAdmin(page);
};

const rows = (page: Page) => page.getByRole("list", { name: t.manage_members_title }).getByRole("listitem");
const chip = (page: Page, label: string, count: number) => page.getByRole("radio", { name: `${label} ${count}` });
const options = (page: Page, name: string) => page.getByRole("button", { name: `${t.members_options}: ${name}` });

test("members: you first, counts by role, filters and search", async ({ page, api }) => {
  await withMembers(page, api.url, ["anna@example.test", "piotr@example.test"]);
  await openMembers(page);

  await expect(rows(page)).toHaveCount(3);
  await expect(rows(page).nth(0)).toContainText(`${DEMO_ADMIN_NAME} ${t.members_you}`);
  await expect(rows(page).nth(0)).toContainText(t.members_admin_badge);
  await expect(rows(page).nth(1)).toContainText(t.members_since);
  // No options on your own row: an admin cannot demote or remove themselves.
  await expect(options(page, DEMO_ADMIN_NAME)).toHaveCount(0);
  await expect(options(page, "anna@example.test")).toBeVisible();

  await expect(chip(page, t.members_filter_all, 3)).toBeChecked();
  await chip(page, t.members_filter_admins, 1).click();
  await expect(rows(page)).toHaveText([new RegExp(DEMO_ADMIN_NAME)]);
  await chip(page, t.members_filter_members, 2).click();
  await expect(rows(page)).toHaveText([/anna@example\.test/, /piotr@example\.test/]);
  await chip(page, t.members_filter_all, 3).click();

  const search = page.getByLabel(t.members_search);
  await search.fill("ANNA");
  await expect(rows(page)).toHaveText([/anna@example\.test/]);
  await search.fill("nikt taki");
  await expect(page.getByText(t.members_empty_search)).toBeVisible();
  await expect(rows(page)).toHaveCount(0);
});

test("members: granting and revoking admin rights, removing after confirming", async ({ page, api }) => {
  await withMembers(page, api.url, ["anna@example.test"]);
  await openMembers(page);
  const anna = rows(page).filter({ hasText: "anna@example.test" });
  const sheet = page.getByRole("dialog", { name: "anna@example.test" });
  await expect(anna).not.toContainText(t.members_admin_badge);

  await options(page, "anna@example.test").click();
  await sheet.getByRole("button", { name: t.members_make_admin }).click();
  await expect(sheet).toHaveCount(0);
  await expect(anna).toContainText(t.members_admin_badge);
  await expect(chip(page, t.members_filter_admins, 2)).toBeVisible();

  await options(page, "anna@example.test").click();
  await sheet.getByRole("button", { name: t.members_revoke_admin }).click();
  await expect(sheet).toHaveCount(0);
  await expect(anna).not.toContainText(t.members_admin_badge);
  await expect(chip(page, t.members_filter_admins, 1)).toBeVisible();

  await options(page, "anna@example.test").click();
  page.once("dialog", (dialog) => dialog.dismiss());
  await sheet.getByRole("button", { name: t.members_remove }).click();
  await expect(anna).toHaveCount(1);

  await options(page, "anna@example.test").click();
  page.once("dialog", (dialog) => dialog.accept());
  await sheet.getByRole("button", { name: t.members_remove }).click();
  await expect(anna).toHaveCount(0);
  await expect(chip(page, t.members_filter_all, 1)).toBeChecked();
});

test("members: only admins see them", async ({ page, api }) => {
  await register(page, "resident@example.test");
  await joinKrakow(api.url, "resident@example.test");
  await page.goto("/app/c/krakow/members");
  await expect(page.getByRole("heading", { name: t.manage_members_title, level: 1 })).toBeVisible();
  await expect(page.getByText(t.manage_admins_only)).toBeVisible();
});
