import type { Page } from "@playwright/test";
import { t } from "../src/texts";
import { expect, test } from "./fixtures";

/**
 * Creating a place (designs E-NoweMiejsceTyp → Dane → Dostep → Gotowe): the kind, then the name, address and
 * description, then its features (the built-in plugins, all on by default), then who may join. The new place is
 * ready with its invite code and QR; its creator is its admin. Plugin names are server content, not app texts.
 */
const FEATURES = ["Zgłoszenia", "Ogłoszenia", "Dyskusje"];
const register = async (page: Page, email: string) => {
  await page.goto("/register");
  await page.getByLabel(t.auth_email).fill(email);
  await page.getByLabel(t.auth_password).fill("password123");
  await page.getByRole("checkbox", { name: t.auth_consent }).click();
  await page.getByRole("button", { name: t.auth_submit_register }).click();
  await expect(page.getByRole("heading", { name: t.dashboard_empty_title })).toBeVisible();
};

test("creating a place: kind, details, who may join; the place is ready with its invite code", async ({ page }) => {
  await register(page, "creator@example.test");
  await page.getByRole("link", { name: t.place_create_own }).click();

  await expect(page.getByRole("heading", { name: t.create_kind_title, level: 1 })).toBeVisible();
  await expect(page.getByText(t.create_step_1)).toBeVisible();
  const next = page.getByRole("button", { name: t.create_next });
  await expect(next).toBeDisabled();
  await page.getByRole("radio", { name: t.place_kind_building }).click();
  await next.click();

  await expect(page.getByRole("heading", { name: t.create_details_title, level: 1 })).toBeVisible();
  await expect(next).toBeDisabled();
  await page.getByLabel(t.create_name).fill("Kamienica Lipowa 12");
  await page.getByLabel(t.create_address).fill("ul. Lipowa 12, Kraków");
  await page.getByLabel(t.create_description).fill("Ogłoszenia, awarie, zebrania.");
  await next.click();

  await expect(page.getByRole("heading", { name: t.create_features_title, level: 1 })).toBeVisible();
  await expect(page.getByText(t.create_step_3)).toBeVisible();
  for (const name of FEATURES) await expect(page.getByRole("checkbox", { name })).toBeChecked();
  await page.getByRole("checkbox", { name: "Dyskusje" }).click();
  await expect(page.getByRole("checkbox", { name: "Dyskusje" })).not.toBeChecked();
  await next.click();

  await expect(page.getByRole("heading", { name: t.create_access_title, level: 1 })).toBeVisible();
  await expect(page.getByRole("radio", { name: t.join_rule_approval })).toBeChecked();
  await page.getByRole("radio", { name: t.join_rule_open }).click();
  await expect(page.getByRole("radio", { name: t.join_rule_open })).toBeChecked();
  await page.getByRole("button", { name: t.create_submit }).click();

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Kamienica Lipowa 12");
  await expect(page.getByText(t.created_admin)).toBeVisible();
  await expect(page.getByText(/^[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{3}$/)).toBeVisible();
  await expect(page.getByRole("img", { name: t.invite_qr_label })).toBeVisible();
  await page.getByRole("button", { name: t.created_go_dashboard }).click();

  await expect(page.getByRole("heading", { name: "Kamienica Lipowa 12", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Zgłoszenia", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ogłoszenia", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Dyskusje", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Kamienica Lipowa 12" }).click();
  await expect(page.getByRole("dialog").getByText(t.place_kind_building)).toBeVisible();
});

test("going back a step keeps the answers", async ({ page }) => {
  await register(page, "back@example.test");
  await page.getByRole("link", { name: t.place_create_own }).click();
  await page.getByRole("radio", { name: t.place_kind_estate }).click();
  await page.getByRole("button", { name: t.create_next }).click();
  await page.getByLabel(t.create_name).fill("Osiedle Słoneczne");
  await page.getByRole("button", { name: t.back }).click();
  await expect(page.getByRole("radio", { name: t.place_kind_estate })).toBeChecked();
  await page.getByRole("button", { name: t.create_next }).click();
  await expect(page.getByLabel(t.create_name)).toHaveValue("Osiedle Słoneczne");
});

test("a place needs at least one feature", async ({ page }) => {
  await register(page, "features@example.test");
  await page.getByRole("link", { name: t.place_create_own }).click();
  await page.getByRole("radio", { name: t.place_kind_estate }).click();
  const next = page.getByRole("button", { name: t.create_next });
  await next.click();
  await page.getByLabel(t.create_name).fill("Osiedle Słoneczne");
  await next.click();
  for (const name of FEATURES) await page.getByRole("checkbox", { name }).click();
  await expect(next).toBeDisabled();
  await page.getByRole("checkbox", { name: "Ogłoszenia" }).click();
  await expect(next).toBeEnabled();
});

test("cancelling on the first step goes back to the dashboard", async ({ page }) => {
  await register(page, "cancel@example.test");
  await page.getByRole("link", { name: t.place_create_own }).click();
  await page.getByRole("button", { name: t.create_cancel }).click();
  await expect(page.getByRole("heading", { name: t.dashboard_empty_title })).toBeVisible();
});
