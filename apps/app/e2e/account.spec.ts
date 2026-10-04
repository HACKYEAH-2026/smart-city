import type { Page } from "@playwright/test";
import { t } from "../src/texts";
import { expect, joinKrakow, loginAdmin, notify, register, test } from "./fixtures";

/**
 * Account acceptance criteria: the Account tab shows who is signed in and their places with their role (a tap opens
 * the place's dashboard), the notifications sent by the places' plugins (newest first, the unread count; a tap opens
 * what the notification points to; all can be marked as read), and the addresses where notifications about things
 * nearby reach the user (picked on the map and named, then removed). Signing out stays here.
 */
const openAccount = async (page: Page) => {
  await page.goto("/app");
  await page.getByRole("navigation", { name: t.nav_main }).getByRole("link", { name: t.tab_account }).click();
  await expect(page.getByRole("heading", { name: t.account_title, level: 1 })).toBeVisible();
};

test("the account shows the user and their places, and signs out", async ({ page, api }) => {
  await register(page, "account@example.test");
  await joinKrakow(api.url, "account@example.test");
  await openAccount(page);
  // Signed up without a name: the email is the name, shown once.
  await expect(page.getByText("account@example.test")).toHaveCount(1);
  const places = page.getByRole("list", { name: t.account_places_label });
  await expect(places.getByRole("link", { name: /Kraków/ })).toBeVisible();
  await expect(places.getByText(t.role_admin)).toHaveCount(0);
  await page.getByRole("button", { name: t.sign_out }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("an admin sees their role; a place in the account opens its dashboard", async ({ page }) => {
  await loginAdmin(page);
  await page.goto("/app/account");
  await expect(page.getByRole("heading", { name: "Urząd Miasta", level: 2 })).toBeVisible();
  await expect(page.getByText("admin@krakow.test")).toBeVisible();
  const places = page.getByRole("list", { name: t.account_places_label });
  await expect(places.getByText(t.role_admin)).toBeVisible();
  await places.getByRole("link", { name: /Kraków/ }).click();
  await expect(page.getByRole("heading", { name: "Kraków", level: 1 })).toBeVisible();
});

test("notifications: newest first with the unread count, a tap opens them, all can be marked as read", async ({
  page,
  api,
}) => {
  await register(page, "inbox@example.test");
  await joinKrakow(api.url, "inbox@example.test");
  await openAccount(page);
  await expect(page.getByText(t.account_notifications_empty)).toBeVisible();

  await notify(api.url, "inbox@example.test", {
    pluginId: "issues",
    title: "Zgłoszenie przyjęte",
    body: "Urząd zajmie się dziurą w jezdni.",
    open: { type: "navigate", view: "list" },
  });
  await notify(api.url, "inbox@example.test", {
    pluginId: "issues",
    title: "Przerwa w dostawie wody",
    body: "Do 18:00 przy ul. Floriańskiej.",
  });
  await page.reload();
  const inbox = page.getByRole("list", { name: t.account_notifications_label });
  await expect(inbox.getByRole("button")).toHaveCount(2);
  await expect(inbox.getByRole("button").first()).toContainText("Przerwa w dostawie wody");
  await expect(inbox.getByRole("button").first()).toContainText("Kraków");
  await expect(page.getByText(`2 ${t.count_unread[1]}`)).toBeVisible();

  // A notification that points to a plugin view opens it…
  await inbox.getByRole("button", { name: /Zgłoszenie przyjęte/ }).click();
  await expect(page.getByRole("heading", { name: "Zgłoszenia", level: 1 })).toBeVisible();
  await page.goto("/app/account");
  await expect(page.getByText(`1 ${t.count_unread[0]}`)).toBeVisible();

  // …and one that points nowhere opens its place's dashboard.
  await inbox.getByRole("button", { name: /Przerwa w dostawie wody/ }).click();
  await expect(page.getByRole("heading", { name: "Kraków", level: 1 })).toBeVisible();

  await notify(api.url, "inbox@example.test", { pluginId: "issues", title: "Nowe ogłoszenie", body: "" });
  await page.goto("/app/account");
  await expect(page.getByText(`1 ${t.count_unread[0]}`)).toBeVisible();
  await page.getByRole("button", { name: t.account_notifications_read_all }).click();
  await expect(page.getByRole("button", { name: t.account_notifications_read_all })).toHaveCount(0);
  await expect(page.getByText(`1 ${t.count_unread[0]}`)).toHaveCount(0);
  await expect(inbox.getByRole("button")).toHaveCount(3);
});

test("addresses for nearby notifications: picked on the map, named, listed and removed", async ({ page, api }) => {
  await register(page, "nearby@example.test");
  await joinKrakow(api.url, "nearby@example.test");
  await openAccount(page);
  await expect(page.getByText(t.account_nearby_empty)).toBeVisible();

  await page.getByRole("button", { name: t.account_nearby_add }).click();
  // The test API answers address searches with fixed Kraków addresses (apps/api/src/test-geocoder.ts).
  const search = page.getByLabel(t.location_search);
  await search.fill("Floriańska 15");
  await search.press("Enter");
  await page
    .getByRole("list", { name: t.location_results })
    .getByRole("button", { name: /Floriańska 15/ })
    .click();
  await page.getByRole("button", { name: t.location_confirm }).click();

  const form = page.getByRole("region", { name: t.account_nearby_new });
  await expect(form.getByText("Floriańska 15, 31-019 Kraków")).toBeVisible();
  const save = form.getByRole("button", { name: t.account_nearby_save });
  await expect(save).toBeDisabled();
  await form.getByRole("radio", { name: t.account_nearby_home }).click();
  await expect(form.getByLabel(t.account_nearby_name)).toHaveValue(t.account_nearby_home);
  await save.click();

  const list = page.getByRole("list", { name: t.account_nearby_label });
  await expect(list.getByText(t.account_nearby_home, { exact: true })).toBeVisible();
  await expect(list.getByText("Floriańska 15, 31-019 Kraków")).toBeVisible();
  await expect(page.getByText(t.account_nearby_empty)).toHaveCount(0);

  await page.reload();
  await list.getByRole("button", { name: `${t.account_nearby_remove}: ${t.account_nearby_home}` }).click();
  await expect(page.getByText(t.account_nearby_empty)).toBeVisible();
});

test("a new address can be dropped before saving", async ({ page, api }) => {
  await register(page, "nearby-cancel@example.test");
  await joinKrakow(api.url, "nearby-cancel@example.test");
  await openAccount(page);
  await page.getByRole("button", { name: t.account_nearby_add }).click();
  await page.getByRole("button", { name: t.location_confirm }).click();
  const form = page.getByRole("region", { name: t.account_nearby_new });
  await form.getByLabel(t.account_nearby_name).fill("Działka");
  await form.getByRole("button", { name: t.create_cancel }).click();
  await expect(form).toHaveCount(0);
  await expect(page.getByText(t.account_nearby_empty)).toBeVisible();
});
