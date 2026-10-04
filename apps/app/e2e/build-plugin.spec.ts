import type { Page } from "@playwright/test";
import { t } from "../src/texts";
import { expect, expectAtBottom, loginAdmin, test } from "./fixtures";

/**
 * The plugin builder (Zarządzaj miejscem → Rozszerzenia → "Dodaj rozszerzenie" → "Stwórz rozszerzenie z AI"), for a
 * place's admins: describe a plugin, the AI writes and checks it (in E2E a fake author: a board named after the quoted
 * text, no model); it is a draft until the admin publishes it into the place; a change after that is a new version,
 * published again. Plugin names are data.
 */
/**
 * How long a revision may take: the fake author answers at once, but every revision type-checks a whole plugin and
 * the test server's first check loads the compiler (seconds; docs/plugins.md, Known issues).
 */
const AI = { timeout: 60_000 };

const openBuilder = async (page: Page) => {
  await page.getByRole("link", { name: t.manage_title }).click();
  await page.getByRole("button", { name: t.manage_plugins_title, exact: true }).click();
  await page.getByRole("link", { name: t.add_plugin_title }).click();
  await page.getByRole("link", { name: new RegExp(t.build_entry_title) }).click();
  await expect(page.getByRole("heading", { name: t.build_title, level: 1 })).toBeVisible();
};

test("an admin describes a plugin, the AI writes it, the admin publishes it and changes it after publishing", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await loginAdmin(page);
  await openBuilder(page);

  await page.getByLabel(t.build_request_label).fill("Tablica „Zguby i znalezione” dla użytkowników Krakowa");
  await page.getByRole("button", { name: t.build_create }).click();
  // The AI's first version: what it built; a draft until published.
  const first = page.getByRole("article", { name: `${t.build_version} 1` });
  await expect(first.getByRole("heading", { name: "Zguby i znalezione" })).toBeVisible(AI);
  await expect(first).toContainText("tablica, na której członkowie miejsca dodają krótkie wpisy");

  await expect(page.getByText(t.build_draft_note)).toBeVisible();
  await page.getByRole("button", { name: t.build_publish }).click();
  await expect(page.getByRole("status")).toHaveText(`${t.build_published} 1`, AI);
  await page.getByRole("link", { name: t.build_open }).click();
  await expect(page.getByRole("heading", { name: "Zguby i znalezione", level: 1 })).toBeVisible();
  await page.getByLabel("Treść wpisu").fill("Klucze na ławce przy Plantach");
  await page.getByRole("button", { name: "Dodaj wpis" }).click();
  await expect(page.getByText("Klucze na ławce przy Plantach")).toBeVisible();

  // A change after publishing: a new version; the place keeps version 1 until the admin publishes again.
  await page.goBack();
  await expect(page.getByRole("heading", { name: t.build_title, level: 1 })).toBeVisible();
  await page.getByLabel(t.build_change_label).fill("Zmień nazwę na „Rzeczy znalezione”, proszę");
  await page.getByRole("button", { name: t.build_change_send }).click();
  const second = page.getByRole("article", { name: `${t.build_version} 2` });
  await expect(second.getByRole("heading", { name: "Rzeczy znalezione" })).toBeVisible(AI);
  await expect(page.getByRole("status")).toHaveText(`${t.build_published} 1`);

  await page.getByRole("button", { name: t.build_update }).click();
  await expect(page.getByRole("status")).toHaveText(`${t.build_published} 2`, AI);
  await page.getByRole("link", { name: t.build_open }).click();
  await expect(page.getByRole("heading", { name: "Rzeczy znalezione", level: 1 })).toBeVisible();
  await expect(page.getByText("Klucze na ławce przy Plantach")).toBeVisible(); // the data stayed

  // The plugin is now one of the place's plugins, marked as made by AI, and listed in the builder.
  await page.goto("/app/c/krakow/build");
  await expect(page.getByRole("link", { name: /Rzeczy znalezione/ })).toBeVisible();
});

/** A request the test author runs out of time on the first time (SLOW in apps/api/src/test-author.ts). */
const SLOW = "[slow]";

test("a version the AI did not finish in time is retried with one tap; the request box stays at the bottom", async ({
  page,
}) => {
  test.setTimeout(180_000);
  // Taller than a phone: the conversation stays shorter than the screen.
  await page.setViewportSize({ width: 390, height: 1000 });
  await loginAdmin(page);
  await openBuilder(page);
  await expectAtBottom(page, page.getByRole("button", { name: t.build_create }));

  const request = `Tablica „Wolne terminy” dla sąsiadów ${SLOW}`;
  await page.getByLabel(t.build_request_label).fill(request);
  await page.getByRole("button", { name: t.build_create }).click();
  const first = page.getByRole("article", { name: `${t.build_version} 1` });
  await expect(first.getByRole("alert")).toHaveText(t.build_failed_timeout, AI);
  await expectAtBottom(page, page.getByRole("button", { name: t.build_change_send }));

  // The same request again, without typing it: a new version.
  await first.getByRole("button", { name: t.build_retry }).click();
  const second = page.getByRole("article", { name: `${t.build_version} 2` });
  await expect(second).toContainText(request);
  await expect(second.getByRole("heading", { name: "Wolne terminy" })).toBeVisible(AI);
  await expect(first.getByRole("button", { name: t.build_retry })).toHaveCount(0);
  await expect(page.getByLabel(t.build_change_label)).toHaveValue("");
  await expectAtBottom(page, page.getByRole("button", { name: t.build_change_send }));
});
