import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, TEST_ADMIN_TOKEN, test } from "@app/testing/playwright";
import type { Page } from "@playwright/test";
import { en } from "./messages";

/**
 * Kryteria akceptacji systemu wtyczek: wtyczka wbudowana działa end-to-end, a wtyczka wgrana
 * przez API administracyjne pojawia się w społeczności bez przeładowania aplikacji.
 * Teksty wtyczek (po polsku) to treść z serwera, nie komunikaty Paraglide.
 */
const register = async (page: Page, email: string) => {
  await page.goto("/register");
  await page.getByLabel(en.auth_email!).fill(email);
  await page.getByLabel(en.auth_password!).fill("password123");
  await page.getByRole("button", { name: en.auth_submit_register }).click();
  await expect(page.getByRole("heading", { name: en.notes_title })).toBeVisible();
};

test("community -> issues plugin: report an issue and find it on the list", async ({ page }) => {
  await register(page, "issues@example.test");
  await page.getByRole("link", { name: en.nav_communities }).click();
  await expect(page.getByRole("heading", { name: en.communities_title })).toBeVisible();
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
  await expect(page.getByText("Popierasz to zgłoszenie")).toBeVisible();

  await page.getByRole("button", { name: "Wróć do listy" }).click();
  const list = page.getByRole("list", { name: "Lista zgłoszeń" });
  await expect(list.getByRole("button", { name: "Nie świeci latarnia na Długiej" })).toBeVisible();
});

const BENCHES = readFileSync(join(import.meta.dirname, "../../api/src/plugins/examples/benches.ts"), "utf8");

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
