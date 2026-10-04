import type { Page } from "@playwright/test";
import { widgetsCount } from "../src/lib/plural";
import { t } from "../src/texts";
import { adminHeaders, DEMO_ADMIN_NAME, expect, joinKrakow, loginAdmin, register, signOut, test } from "./fixtures";

/**
 * Managing a place (design E-ZarzadzanieMiejscem), for its admins only: invitations (the code with its QR, inviting
 * by email), the plugins that are on and the catalog to add more, the members with their roles, the place's settings,
 * and deleting the place. Each section is a card that opens in place. The dashboard layout editor opens from a plugin's
 * page. Place and plugin names are data, not app texts.
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

const SECTIONS = [t.manage_invites_title, t.manage_plugins_title, t.manage_members_title, t.manage_settings_title];

test("only admins manage a place; the screen shows its sections, closed", async ({ page, api }) => {
  await register(page, "resident@example.test");
  await joinKrakow(api.url, "resident@example.test");
  await page.goto("/app");
  await expect(page.getByRole("heading", { name: "Kraków", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: t.manage_title })).toHaveCount(0);
  await page.goto("/app/c/krakow/manage");
  await expect(page.getByText(t.manage_admins_only)).toBeVisible();
  await page.goto("/app/c/krakow/layout");
  await expect(page.getByRole("heading", { name: t.manage_layout_title, level: 1 })).toBeVisible();
  await expect(page.getByText(t.manage_admins_only)).toBeVisible();

  await signOut(page);
  await loginAdmin(page);
  await openManage(page);
  // The place's name above the title; the dashboard stays mounted behind (screen animations), so only main counts.
  await expect(page.getByRole("main").getByText("Kraków", { exact: true })).toBeVisible();
  for (const title of SECTIONS) {
    await expect(page.getByRole("button", { name: title, exact: true })).toHaveAttribute("aria-expanded", "false");
  }
  await expect(page.getByRole("button", { name: t.manage_layout_title })).toHaveCount(0);
  await expect(page.getByRole("button", { name: t.manage_delete })).toBeVisible();
  await page.getByRole("button", { name: t.back }).click();
  await expect(page.getByRole("heading", { name: "Kraków", level: 1 })).toBeVisible();
});

test("plugins: the section lists the place's plugins that are on and leads to adding more", async ({ page }) => {
  await loginAdmin(page);
  await openManage(page);
  await openSection(page, t.manage_plugins_title);
  const plugins = page.getByRole("list", { name: t.manage_plugins_title }).getByRole("listitem");
  await expect(plugins).toHaveText([/Zgłoszenia/, /Ogłoszenia/, /Dyskusje/]);
  // The line under a name counts the plugin's widgets.
  await expect(plugins.filter({ hasText: "Zgłoszenia" })).toContainText(widgetsCount(1));
  await expect(page.getByRole("link", { name: t.add_plugin_title })).toBeVisible();
});

test("plugins: the catalog lists the ones that are off; adding one puts it in the place", async ({ page, api }) => {
  // Switching a plugin off has no screen for now: the admin does it through the API.
  const admin = await adminHeaders(api.url);
  for (const plugin of ["issues", "discussions"]) {
    const res = await fetch(`${api.url}/api/communities/krakow/plugins/${plugin}`, {
      method: "PUT",
      headers: { ...admin, "content-type": "application/json" },
      body: JSON.stringify({ enabled: false }),
    });
    expect(res.ok, `switch ${plugin} off`).toBe(true);
  }
  // The issues plugin's dashboard tile ("Otwórz: Zgłoszenia…").
  const issuesTile = page.getByRole("link", { name: new RegExp(`^${t.dashboard_open}: Zgłoszenia`) });

  await loginAdmin(page);
  await expect(issuesTile).toHaveCount(0);
  await openManage(page);
  await openSection(page, t.manage_plugins_title);
  await page.getByRole("link", { name: t.add_plugin_title }).click();
  await expect(page.getByRole("heading", { name: t.add_plugin_title, level: 1 })).toBeVisible();

  // The manage screen stays mounted behind the catalog (screen animations): the catalog's list is the newest one.
  const catalog = page.getByRole("list", { name: t.manage_plugins_title }).last();
  await expect(catalog.getByRole("listitem")).toHaveText([/Zgłoszenia/, /Dyskusje/]);
  const search = page.getByLabel(t.add_plugin_search);
  await search.fill("nic takiego");
  await expect(page.getByText(t.add_plugin_no_results)).toBeVisible();
  await search.fill("USTEREK"); // in the description of Zgłoszenia only
  await expect(catalog.getByRole("listitem")).toHaveText([/Zgłoszenia/]);

  await page.getByRole("button", { name: `${t.add_plugin_add}: Zgłoszenia` }).click();
  await expect(page.getByRole("status")).toHaveText(`${t.add_plugin_added}: Zgłoszenia`);
  await expect(page.getByText(t.add_plugin_no_results)).toBeVisible();
  await search.fill("");
  await expect(catalog.getByRole("listitem")).toHaveText([/Dyskusje/]);

  await page.getByRole("button", { name: t.back }).last().click();
  // The catalog is gone, so the only list of plugins left is the manage screen's.
  await expect(page.getByRole("heading", { name: t.add_plugin_title, level: 1 })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: t.manage_title, level: 1 })).toBeVisible();
  const enabled = page.getByRole("list", { name: t.manage_plugins_title }).getByRole("listitem");
  await expect(enabled).toHaveText([/Zgłoszenia/, /Ogłoszenia/]);
  await page.getByRole("button", { name: t.back }).click();
  await expect(issuesTile).toBeVisible();
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

test("sections open one at a time; a closed one folds away and drops what was typed", async ({ page }) => {
  await loginAdmin(page);
  await openManage(page);
  await openSection(page, t.manage_settings_title);
  const name = page.getByLabel(t.create_name);
  await name.fill("Nie zapisano");
  await openSection(page, t.manage_members_title);
  const settings = page.getByRole("button", { name: t.manage_settings_title, exact: true });
  await expect(settings).toHaveAttribute("aria-expanded", "false");
  // Gone once folded, not just out of sight.
  await expect(name).toHaveCount(0);
  await openSection(page, t.manage_settings_title);
  await expect(name).toHaveValue("Kraków");
  await expect(page.getByRole("button", { name: t.manage_members_title, exact: true })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
});

test("members: a preview with roles, the admin first; the link opens all members", async ({ page, api }) => {
  await register(page, "member@example.test");
  await joinKrakow(api.url, "member@example.test");
  await signOut(page);
  await loginAdmin(page);
  await openManage(page);
  await openSection(page, t.manage_members_title);
  const members = page.getByRole("list", { name: t.manage_members_title }).getByRole("listitem");
  await expect(members).toHaveCount(2);
  // A registered user's name is their email.
  await expect(members.nth(0)).toContainText(`${DEMO_ADMIN_NAME} ${t.members_you}`);
  await expect(members.nth(0)).toContainText(t.role_admin);
  await expect(members.nth(1)).toContainText("member@example.test");
  await expect(members.nth(1)).toContainText(t.role_member);

  await page.getByRole("link", { name: t.members_see_all }).click();
  await expect(page.getByRole("heading", { name: t.manage_members_title, level: 1 })).toBeVisible();
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

test("dashboard layout: the editor changes sizes, order and widgets; saving changes the dashboard", async ({
  page,
}) => {
  const pluginHeading = page.getByRole("heading", { name: "Ogłoszenia", level: 1 });
  await loginAdmin(page);
  await openManage(page);
  await openSection(page, t.manage_plugins_title);
  await page
    .getByRole("list", { name: t.manage_plugins_title })
    .getByRole("link", { name: /Ogłoszenia/ })
    .click();
  await expect(pluginHeading).toBeVisible();
  await page.getByRole("link", { name: t.manage_layout_edit }).click();
  await expect(page.getByRole("heading", { name: t.manage_layout_title, level: 1 })).toBeVisible();
  await expect(page.getByText(t.manage_layout_hint)).toBeVisible();

  const grid = page.getByRole("list", { name: t.manage_layout_title });
  const tiles = grid.getByRole("listitem");
  await expect(tiles).toHaveText([/Zgłoszenia.*3 × 2/, /Ogłoszenia.*3 × 3/, /Dyskusje.*3 × 3/]);
  const announcements = grid.getByRole("button", { name: /Ogłoszenia/ });
  await announcements.click();
  await expect(announcements).toHaveAttribute("aria-pressed", "true");
  const sizes = page.getByRole("radiogroup", { name: t.manage_layout_size_group });
  await expect(sizes.getByRole("radio")).toHaveText(["3 × 3", "3 × 2"]);
  await sizes.getByRole("radio", { name: "3 × 2" }).click();
  await expect(sizes.getByRole("radio", { name: "3 × 2" })).toBeChecked();
  await expect(tiles).toHaveText([/Zgłoszenia.*3 × 2/, /Ogłoszenia.*3 × 2/, /Dyskusje.*3 × 3/]);
  const up = page.getByRole("button", { name: t.manage_layout_up });
  const down = page.getByRole("button", { name: t.manage_layout_down });
  await up.click();
  await expect(tiles).toHaveText([/Ogłoszenia/, /Zgłoszenia/, /Dyskusje/]);
  await expect(up).toBeDisabled();
  await down.click();
  await down.click();
  await expect(tiles).toHaveText([/Zgłoszenia/, /Dyskusje/, /Ogłoszenia/]);
  await expect(down).toBeDisabled();
  await page.getByRole("button", { name: t.manage_layout_remove, exact: true }).click();
  await expect(tiles).toHaveText([/Zgłoszenia/, /Dyskusje/]);
  await expect(sizes).toHaveCount(0);

  await page.getByRole("button", { name: t.manage_layout_add }).click();
  const sheet = page.getByRole("dialog", { name: t.manage_layout_add });
  await expect(sheet.getByText(`${t.manage_layout_sizes} 3×3, 3×2`)).toBeVisible();
  await expect(sheet.getByRole("link", { name: t.manage_layout_more })).toBeVisible();
  await sheet.getByRole("button", { name: `${t.manage_layout_add_one}: Ogłoszenia` }).click();
  await expect(sheet).toHaveCount(0);
  // Added back at the end with its default size, and selected.
  await expect(tiles).toHaveText([/Zgłoszenia/, /Dyskusje/, /Ogłoszenia.*3 × 3/]);
  await expect(announcements).toHaveAttribute("aria-pressed", "true");
  await up.click();
  await up.click();
  await sizes.getByRole("radio", { name: "3 × 2" }).click();
  await expect(tiles).toHaveText([/Ogłoszenia.*3 × 2/, /Zgłoszenia.*3 × 2/, /Dyskusje.*3 × 3/]);
  // Tapping the selected tile again deselects it.
  await announcements.click();
  await expect(announcements).toHaveAttribute("aria-pressed", "false");

  await page.getByRole("button", { name: t.manage_layout_add }).click();
  await expect(sheet.getByText(t.manage_layout_add_none)).toBeVisible();
  await sheet.getByRole("button", { name: t.close }).click();
  await expect(sheet).toHaveCount(0);

  // Saved, the editor goes back to the plugin's page; from there back to the manage screen and the dashboard.
  await page.getByRole("button", { name: t.manage_layout_save, exact: true }).click();
  await expect(page.getByText(t.manage_layout_hint)).toHaveCount(0);
  await expect(pluginHeading).toBeVisible();
  await page.getByRole("button", { name: t.back }).last().click();
  await expect(pluginHeading).toHaveCount(0);
  await page.getByRole("button", { name: t.back }).click();
  const regions = page.getByRole("list", { name: t.community_dashboard_label }).getByRole("region");
  await expect(regions.nth(0)).toHaveAttribute("aria-label", "Ogłoszenia");

  await page.goto("/app/c/krakow/layout");
  await expect(tiles).toHaveText([/Ogłoszenia.*3 × 2/, /Zgłoszenia.*3 × 2/, /Dyskusje.*3 × 3/]);
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
