import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { expect, TEST_ADMIN_TOKEN, test } from "./fixtures";
import { en } from "./messages";

/**
 * Plugin system acceptance criteria: a built-in plugin works end to end, and a plugin uploaded
 * through the admin API shows up in the community without reloading the app.
 * Plugin texts (in Polish) are server content, not messages from messages/*.json.
 */
const register = async (page: Page, email: string) => {
  await page.goto("/register");
  await page.getByLabel(en.auth_email!).fill(email);
  await page.getByLabel(en.auth_password!).fill("password123");
  await page.getByRole("checkbox", { name: en.auth_consent }).click();
  await page.getByRole("button", { name: en.auth_submit_register }).click();
  await expect(page.getByRole("heading", { name: en.communities_title })).toBeVisible();
};

test("community -> issues plugin: report an issue and find it on the list", async ({ page }) => {
  await register(page, "issues@example.test");
  await page.getByRole("link", { name: "Kraków" }).click();
  await expect(page.getByRole("heading", { name: "Kraków" })).toBeVisible();

  await page.getByRole("link", { name: "Zgłoszenia" }).click();
  await expect(page.getByRole("heading", { name: "Zgłoszenia" })).toBeVisible();
  await expect(page.getByText("Nie ma jeszcze zgłoszeń")).toBeVisible();

  await page.getByRole("button", { name: "Nowe zgłoszenie" }).click();
  await page.getByLabel("Co się stało?").fill("Nie świeci latarnia na Długiej");
  await page.getByRole("radio", { name: "Oświetlenie" }).click();
  await page.getByLabel("Szczegóły i miejsce").fill("Przy przystanku, od tygodnia");
  await page.getByRole("button", { name: "Wyślij zgłoszenie" }).click();

  await expect(page.getByRole("status")).toContainText("Dziękujemy");
  await expect(page.getByRole("heading", { name: "Nie świeci latarnia na Długiej" })).toBeVisible();
  await expect(page.getByText("Zgłaszasz ten problem")).toBeVisible();

  await page.getByRole("button", { name: "Wróć do listy" }).click();
  const list = page.getByRole("list", { name: "Lista zgłoszeń" });
  await expect(list.getByRole("button", { name: "Nie świeci latarnia na Długiej" })).toBeVisible();
});

const signOut = async (page: Page) => {
  await page.goto("/app");
  await page.getByRole("button", { name: en.sign_out }).click();
  await expect(page).toHaveURL(/\/login$/);
};

const login = async (page: Page, email: string) => {
  await page.goto("/login");
  await page.getByLabel(en.auth_email!).fill(email);
  await page.getByLabel(en.auth_password!).fill("password123");
  await page.getByRole("button", { name: en.auth_submit_login }).click();
  await expect(page.getByRole("heading", { name: en.communities_title })).toBeVisible();
};

const openNewIssueForm = async (page: Page) => {
  await page.goto("/app/c/krakow/issues/list");
  await page.getByRole("button", { name: "Nowe zgłoszenie" }).click();
};

/** Minimal JPEG header — the server checks the file type, not its content. */
const PHOTO = { name: "latarnia.jpg", mimeType: "image/jpeg", buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16]) };

test("photo report, then a similar report is merged under it; the city admin closes it", async ({ page }) => {
  await register(page, "anna@example.test");
  await openNewIssueForm(page);
  await page.getByLabel("Co się stało?").fill("Nie świeci latarnia na Długiej");
  await page.getByRole("radio", { name: "Oświetlenie" }).click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: en.plugin_photo_pick }).click();
  await (await chooser).setFiles(PHOTO);
  await expect(page.getByRole("img", { name: en.plugin_photo_preview })).toBeVisible();
  await page.getByRole("button", { name: "Wyślij zgłoszenie" }).click();
  await expect(page.getByRole("status")).toContainText("Dziękujemy");
  await expect(page.getByRole("img", { name: "Zdjęcie: Nie świeci latarnia na Długiej" })).toBeVisible();

  await signOut(page);
  await register(page, "bartek@example.test");
  await openNewIssueForm(page);
  await page.getByLabel("Co się stało?").fill("Latarnia na Długiej nie świeci");
  await page.getByRole("radio", { name: "Oświetlenie" }).click();
  await page.getByLabel("Szczegóły i miejsce").fill("Ciemno od tygodnia");
  await page.getByRole("button", { name: "Wyślij zgłoszenie" }).click();

  await expect(page.getByRole("heading", { name: "Czy to ten sam problem?" })).toBeVisible();
  await page.getByRole("button", { name: "Tak, dołącz moje zgłoszenie" }).click();
  await expect(page.getByRole("status")).toContainText("Dołączyliśmy");
  await expect(page.getByRole("heading", { name: "Nie świeci latarnia na Długiej" })).toBeVisible();
  await expect(page.getByText("2 osób zgłasza")).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Zgłoszenia mieszkańców" }).getByText("Ciemno od tygodnia"),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Oznacz jako naprawione" })).toHaveCount(0);

  const issueUrl = page.url();
  await signOut(page);
  await login(page, "admin@krakow.test");
  await page.goto(issueUrl);
  await page.getByRole("button", { name: "Oznacz jako naprawione" }).click();
  await expect(page.getByRole("status")).toContainText("Naprawione");
});

const BENCHES = readFileSync(join(import.meta.dirname, "../../../plugins/benches/index.ts"), "utf8");

test("plugin uploaded by an admin shows up in the open community without a reload", async ({ page, api }) => {
  await register(page, "admin-demo@example.test");
  await page.goto("/app/c/krakow");
  await expect(page.getByRole("link", { name: "Zgłoszenia" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ławki" })).toHaveCount(0);

  const headers = { authorization: `Bearer ${TEST_ADMIN_TOKEN}`, "content-type": "application/json" };
  const up = await fetch(`${api.url}/api/admin/plugins`, {
    method: "POST",
    headers,
    body: JSON.stringify({ source: BENCHES }),
  });
  expect(up.status).toBe(201);
  const inst = await fetch(`${api.url}/api/admin/communities/krakow/plugins`, {
    method: "POST",
    headers,
    body: JSON.stringify({ pluginId: "benches" }),
  });
  expect(inst.status).toBe(201);

  await page.getByRole("link", { name: "Ławki" }).click({ timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Ławki w parkach" })).toBeVisible();
  await expect(page.getByText("Wszystkie ławki są całe.")).toBeVisible();

  await page.getByLabel("Park").fill("Park Jordana");
  await page.getByRole("button", { name: "Zgłoś ławkę" }).click();
  await expect(page.getByRole("status")).toContainText("Ławka trafiła na listę");
  await expect(page.getByRole("list", { name: "Zepsute ławki" }).getByText("Park Jordana")).toBeVisible();
  await expect(page.getByLabel("Park")).toHaveValue("");
});
