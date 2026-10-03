import type { Page } from "@playwright/test";
import { t } from "../src/texts";
import { DEMO_ADMIN, expect, joinKrakow, loginAdmin, register, signOut, test } from "./fixtures";

/**
 * Managing a place (design E-ZarzadzanieMiejscem), for its admins only: invitations (the code with its QR, inviting
 * by email), plugins on and off, the dashboard order, the members with their roles, the place's settings, and
 * deleting the place. Each section is a card that opens in place. Place and plugin names are data, not app texts.
 */
const openManage = async (page: Page) => {
  await page.getByRole("link", { name: t.manage_title }).click();
  await expect(page.getByRole("heading", { name: t.manage_title, level: 1 })).toBeVisible();
};

/** Opens a section card by its title (a disclosure button). */
const openSection = async (page: Page, title: string) => {
  const toggle = page.getByRole("button", { name: title, exact: true });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
};

const SECTIONS = [
  t.manage_invites_title,
  t.manage_plugins_title,
  t.manage_layout_title,
  t.manage_members_title,
  t.manage_settings_title,
];

test("only admins manage a place; the screen shows its sections, closed", async ({ page, api }) => {
  await register(page, "resident@example.test");
  await joinKrakow(api.url, "resident@example.test");
  await page.goto("/app");
  await expect(page.getByRole("heading", { name: "Kraków", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: t.manage_title })).toHaveCount(0);
  await page.goto("/app/c/krakow/manage");
  await expect(page.getByText(t.manage_admins_only)).toBeVisible();

  await signOut(page);
  await loginAdmin(page);
  await openManage(page);
  // The place's name above the title; the dashboard stays mounted behind (screen animations), so only main counts.
  await expect(page.getByRole("main").getByText("Kraków", { exact: true })).toBeVisible();
  for (const title of SECTIONS) {
    await expect(page.getByRole("button", { name: title, exact: true })).toHaveAttribute("aria-expanded", "false");
  }
  await expect(page.getByRole("button", { name: t.manage_delete })).toBeVisible();
  await page.getByRole("button", { name: t.back }).click();
  await expect(page.getByRole("heading", { name: "Kraków", level: 1 })).toBeVisible();
});

test("plugins: switching one off takes it out of the place, switching it on brings it back", async ({ page }) => {
  await loginAdmin(page);
  // Discussions have no dashboard tile: they are among the place's other features.
  await expect(page.getByRole("link", { name: "Dyskusje", exact: true })).toBeVisible();
  await openManage(page);
  await openSection(page, t.manage_plugins_title);
  const discussions = page.getByRole("checkbox", { name: "Dyskusje" });
  await expect(discussions).toBeChecked();
  await discussions.click();
  await expect(discussions).not.toBeChecked();
  await page.getByRole("button", { name: t.back }).click();
  await expect(
    page.getByRole("link", { name: `${t.dashboard_open}: Zgłoszenia i sugestie`, exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Dyskusje", exact: true })).toHaveCount(0);

  await openManage(page);
  await openSection(page, t.manage_plugins_title);
  await page.getByRole("checkbox", { name: "Dyskusje" }).click();
  await page.getByRole("button", { name: t.back }).click();
  await expect(page.getByRole("link", { name: "Dyskusje", exact: true })).toBeVisible();
});

test("settings: renaming the place and changing who may join", async ({ page }) => {
  await loginAdmin(page);
  await openManage(page);
  await openSection(page, t.manage_settings_title);
  const name = page.getByLabel(t.create_name);
  await expect(name).toHaveValue("Kraków");
  await name.fill("Kraków Centrum");
  await page.getByRole("radio", { name: t.join_rule_open }).click();
  await page.getByRole("button", { name: t.manage_save }).click();
  await expect(page.getByRole("status")).toContainText(t.manage_saved);
  await page.getByRole("button", { name: t.back }).click();
  await expect(page.getByRole("heading", { name: "Kraków Centrum", level: 1 })).toBeVisible();

  await openManage(page);
  await openSection(page, t.manage_settings_title);
  await expect(page.getByRole("radio", { name: t.join_rule_open })).toBeChecked();
});

test("members: everyone in the place, admins marked", async ({ page, api }) => {
  await register(page, "member@example.test");
  await joinKrakow(api.url, "member@example.test");
  await signOut(page);
  await loginAdmin(page);
  await openManage(page);
  await openSection(page, t.manage_members_title);
  const members = page.getByRole("list", { name: t.manage_members_title });
  await expect(members.getByRole("listitem")).toHaveCount(2);
  await expect(members.getByRole("listitem").filter({ hasText: DEMO_ADMIN.email })).toContainText(t.role_admin);
  await expect(members.getByRole("listitem").filter({ hasText: "member@example.test" })).not.toContainText(
    t.role_admin,
  );
});

test("invitations: the code with its QR; inviting someone by the email of their account", async ({ page }) => {
  await register(page, "guest@example.test");
  await signOut(page);
  await loginAdmin(page);
  await openManage(page);
  await openSection(page, t.manage_invites_title);
  await expect(page.getByText(/^[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{3}$/)).toBeVisible();
  await expect(page.getByRole("img", { name: t.invite_qr_label })).toBeVisible();

  const email = page.getByLabel(t.manage_invite_email);
  await email.fill("nobody@example.test");
  await page.getByRole("button", { name: t.manage_invite_send }).click();
  await expect(page.getByRole("alert")).toContainText(t.manage_invite_no_account);
  await email.fill("guest@example.test");
  await page.getByRole("button", { name: t.manage_invite_send }).click();
  await expect(page.getByRole("status")).toContainText(t.manage_invite_sent);
  await expect(email).toHaveValue("");
});

test("dashboard layout: the widgets in order; moving one changes the dashboard", async ({ page }) => {
  await loginAdmin(page);
  await page.goto("/app/c/krakow/announcements/list");
  await page.getByLabel("Tytuł").fill("Zebranie użytkowników");
  await page.getByRole("button", { name: "Opublikuj ogłoszenie" }).click();
  await expect(page.getByRole("status")).toContainText("Ogłoszenie opublikowane");
  await page.goto("/app");
  await openManage(page);
  await openSection(page, t.manage_layout_title);
  const widgets = page.getByRole("list", { name: t.manage_layout_title }).getByRole("listitem");
  await expect(widgets).toHaveText([/Zgłoszenia/, /Ogłoszenia/]);
  await page.getByRole("button", { name: `${t.dashboard_move_earlier}: Ogłoszenia` }).click();
  await expect(widgets).toHaveText([/Ogłoszenia/, /Zgłoszenia/]);
  await page.getByRole("button", { name: t.back }).click();
  const regions = page.getByRole("list", { name: t.community_dashboard_label }).getByRole("region");
  await expect(regions.nth(0)).toHaveAttribute("aria-label", "Ogłoszenia");
});

test("deleting the place after confirming; its admin is left without places", async ({ page }) => {
  await loginAdmin(page);
  await openManage(page);
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: t.manage_delete }).click();
  await expect(page.getByRole("heading", { name: t.manage_title, level: 1 })).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: t.manage_delete }).click();
  await expect(page.getByRole("heading", { name: t.dashboard_empty_title })).toBeVisible();
});
