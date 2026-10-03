import { t } from "../src/texts";
import { expect, inviteToKrakow, register, test } from "./fixtures";

/**
 * Invitations (design E-Zaproszenia): a user sees the places others invited them to, with who invited them;
 * accepting joins the place and opens its dashboard, declining removes the invitation.
 */
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
