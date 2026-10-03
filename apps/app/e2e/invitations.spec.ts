import type { Page } from "@playwright/test";
import { t } from "../src/texts";
import { expect, inviteToKrakow, test } from "./fixtures";

/**
 * Invitations (design E-Zaproszenia): a user sees the places others invited them to, with who invited them;
 * accepting joins the place and opens its dashboard, declining removes the invitation.
 */
const register = async (page: Page, email: string) => {
  await page.goto("/register");
  await page.getByLabel(t.auth_email).fill(email);
  await page.getByLabel(t.auth_password).fill("password123");
  await page.getByRole("checkbox", { name: t.auth_consent }).click();
  await page.getByRole("button", { name: t.auth_submit_register }).click();
  await expect(page.getByRole("heading", { name: t.dashboard_empty_title })).toBeVisible();
};

test("an invitation shows the place and its inviter; accepting joins the place", async ({ page, api }) => {
  await register(page, "invited@example.test");
  await inviteToKrakow(api.url, "invited@example.test");
  await page.getByRole("link", { name: t.join_invites }).click();
  await expect(page.getByRole("heading", { name: t.invites_title, level: 1 })).toBeVisible();
  await expect(page.getByText("Kraków", { exact: true })).toBeVisible();
  await expect(page.getByText("Urząd Miasta", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: t.invite_accept }).click();
  await expect(page.getByRole("heading", { name: "Kraków", level: 1 })).toBeVisible();
  await expect(page).toHaveURL(/\/app$/);
});

test("declining an invitation removes it", async ({ page, api }) => {
  await register(page, "declined@example.test");
  await inviteToKrakow(api.url, "declined@example.test");
  await page.goto("/app/invites");
  await page.getByRole("button", { name: t.invite_decline }).click();
  await expect(page.getByText(t.invites_empty)).toBeVisible();
});

test("without invitations the screen says so", async ({ page }) => {
  await register(page, "nobody-invites@example.test");
  await page.goto("/app/invites");
  await expect(page.getByText(t.invites_empty)).toBeVisible();
});
