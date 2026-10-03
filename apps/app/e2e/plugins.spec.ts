import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { t } from "../src/texts";
import { expect, joinKrakow, TEST_ADMIN_TOKEN, test } from "./fixtures";

/**
 * Plugin system acceptance criteria: a built-in plugin works end to end, and a plugin uploaded
 * through the admin API shows up in the community without reloading the app.
 * Plugin texts are server content, not app texts from src/texts.ts.
 */
/** Registers, joins Kraków and lands on its dashboard. */
const register = async (page: Page, email: string, apiUrl: string) => {
  await page.goto("/register");
  await page.getByLabel(t.auth_email).fill(email);
  await page.getByLabel(t.auth_password).fill("password123");
  await page.getByRole("checkbox", { name: t.auth_consent }).click();
  await page.getByRole("button", { name: t.auth_submit_register }).click();
  await expect(page.getByRole("heading", { name: t.dashboard_empty_title })).toBeVisible();
  await joinKrakow(apiUrl, email);
  await page.goto("/app");
  await expect(page.getByRole("heading", { name: "Kraków", level: 1 })).toBeVisible();
};

test("community -> issues plugin: report an issue and find it on the list", async ({ page, api }) => {
  await register(page, "issues@example.test", api.url);
  await expect(page.getByRole("heading", { name: "Kraków", level: 1 })).toBeVisible();

  await page.getByRole("link", { name: "Zgłoszenia", exact: true }).click();
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
  await page.getByRole("navigation", { name: t.nav_main }).getByRole("link", { name: t.tab_account }).click();
  await page.getByRole("button", { name: t.sign_out }).click();
  await expect(page).toHaveURL(/\/login$/);
};

const login = async (page: Page, email: string) => {
  await page.goto("/login");
  await page.getByLabel(t.auth_email).fill(email);
  await page.getByLabel(t.auth_password).fill("password");
  await page.getByRole("button", { name: t.auth_submit_login }).click();
  await expect(page.getByRole("heading", { name: "Kraków", level: 1 })).toBeVisible();
};

const openNewIssueForm = async (page: Page) => {
  await page.goto("/app/c/krakow/issues/list");
  await page.getByRole("button", { name: "Nowe zgłoszenie" }).click();
};

/** Minimal JPEG header — the server checks the file type, not its content. */
const PHOTO = { name: "latarnia.jpg", mimeType: "image/jpeg", buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16]) };

test("photo report, then a similar report is merged under it; the city admin closes it", async ({ page, api }) => {
  await register(page, "anna@example.test", api.url);
  await openNewIssueForm(page);
  await page.getByLabel("Co się stało?").fill("Nie świeci latarnia na Długiej");
  await page.getByRole("radio", { name: "Oświetlenie" }).click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: t.plugin_photo_pick }).click();
  await (await chooser).setFiles(PHOTO);
  await expect(page.getByRole("img", { name: t.plugin_photo_preview })).toBeVisible();
  await page.getByRole("button", { name: "Wyślij zgłoszenie" }).click();
  await expect(page.getByRole("status")).toContainText("Dziękujemy");
  await expect(page.getByRole("img", { name: "Zdjęcie: Nie świeci latarnia na Długiej" })).toBeVisible();

  await signOut(page);
  await register(page, "bartek@example.test", api.url);
  await openNewIssueForm(page);
  await page.getByLabel("Co się stało?").fill("Latarnia na Długiej nie świeci");
  await page.getByRole("radio", { name: "Oświetlenie" }).click();
  await page.getByLabel("Szczegóły i miejsce").fill("Ciemno od tygodnia");
  await page.getByRole("button", { name: "Wyślij zgłoszenie" }).click();

  await expect(page.getByRole("heading", { name: "Czy to ten sam problem?" })).toBeVisible();
  await page.getByRole("button", { name: "Tak, dołącz moje zgłoszenie" }).click();
  await expect(page.getByRole("status")).toContainText("Dołączyliśmy");
  await expect(page.getByRole("heading", { name: "Nie świeci latarnia na Długiej" })).toBeVisible();
  // The list screen stays mounted under the detail screen in the stack, so the newest match is the one on top.
  await expect(page.getByText("2 osoby zgłaszają").last()).toBeVisible();
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

/**
 * Plugin maps (ui.map, ui.locationInput): the place of a report is picked on the app's location picker; the issue
 * shows it on a map, and the list has a map of open reports. The pins are drawn on a canvas (an iframe on the web),
 * so the map's own list is what E2E (and screen readers) use.
 */
test("issues on the map: a report placed on the map shows up on the map of reports", async ({ page, api }) => {
  await register(page, "mapa@example.test", api.url);
  await openNewIssueForm(page);
  await page.getByLabel("Co się stało?").fill("Nie świeci latarnia na Floriańskiej");
  await page.getByRole("radio", { name: "Oświetlenie" }).click();

  // The test API answers address searches with fixed Kraków addresses (apps/api/src/test-geocoder.ts).
  await page.getByRole("button", { name: t.plugin_location_pick }).click();
  const search = page.getByLabel(t.location_search);
  await search.fill("Floriańska 15");
  await search.press("Enter");
  await page
    .getByRole("list", { name: t.location_results })
    .getByRole("button", { name: /Floriańska 15/ })
    .click();
  await page.getByRole("button", { name: t.location_confirm }).click();
  await expect(page.getByText("Floriańska 15, 31-019 Kraków")).toBeVisible();
  await expect(page.getByTitle(t.plugin_location_preview)).toBeVisible();
  await page.getByRole("button", { name: "Wyślij zgłoszenie" }).click();

  await expect(page.getByRole("status")).toContainText("Dziękujemy");
  await expect(page.getByRole("heading", { name: "Nie świeci latarnia na Floriańskiej" })).toBeVisible();
  await expect(page.getByText("Floriańska 15, 31-019 Kraków").last()).toBeVisible();
  await expect(page.getByTitle("Miejsce zgłoszenia")).toBeVisible();

  await page.getByRole("button", { name: "Wróć do listy" }).click();
  await expect(page.getByTitle("Mapa zgłoszeń").last()).toBeVisible();
  await page
    .getByRole("button", { name: `${t.plugin_map_list_show} (1)` })
    .last()
    .click();
  await page
    .getByRole("list", { name: "Mapa zgłoszeń" })
    .last()
    .getByRole("button", { name: /Nie świeci latarnia na Floriańskiej/ })
    .click();
  await expect(page.getByRole("heading", { name: "Nie świeci latarnia na Floriańskiej" }).last()).toBeVisible();
  await expect(page.getByTitle("Miejsce zgłoszenia").last()).toBeVisible();
});

/** A test-only plugin (not one of plugins/: those are all built in). */
const NOTES = readFileSync(join(import.meta.dirname, "../../api/test/fixtures/notes-plugin.ts"), "utf8");

test("plugin uploaded by an admin shows up in the open community without a reload", async ({ page, api }) => {
  await register(page, "admin-demo@example.test", api.url);
  await page.goto("/app");
  await expect(page.getByRole("link", { name: "Zgłoszenia", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Notatki" })).toHaveCount(0);

  const headers = { authorization: `Bearer ${TEST_ADMIN_TOKEN}`, "content-type": "application/json" };
  const up = await fetch(`${api.url}/api/admin/plugins`, {
    method: "POST",
    headers,
    body: JSON.stringify({ source: NOTES }),
  });
  expect(up.status).toBe(201);
  const inst = await fetch(`${api.url}/api/admin/communities/krakow/plugins`, {
    method: "POST",
    headers,
    body: JSON.stringify({ pluginId: "notes" }),
  });
  expect(inst.status).toBe(201);

  await page.getByRole("link", { name: "Notatki" }).click({ timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Tablica notatek" })).toBeVisible();
  await expect(page.getByText("Nie ma jeszcze notatek.")).toBeVisible();

  await page.getByLabel("Tytuł").fill("Klucz do piwnicy");
  await page.getByRole("button", { name: "Dodaj notatkę" }).click();
  await expect(page.getByRole("status")).toContainText("Notatka dodana.");
  await expect(page.getByRole("list", { name: "Wszystkie notatki" }).getByText("Klucz do piwnicy")).toBeVisible();
  await expect(page.getByLabel("Tytuł")).toHaveValue("");
});

test("home screen widget: announcements show what is new since the last visit", async ({ page, api }) => {
  await login(page, "admin@krakow.test");
  await page.goto("/app/c/krakow/announcements/list");
  await page.getByLabel("Tytuł").fill("Zamknięcie ulicy Długiej");
  await page.getByLabel("Treść").fill("W sobotę od 8:00 do 16:00 remont nawierzchni.");
  await page.getByRole("button", { name: "Opublikuj ogłoszenie" }).click();
  await expect(page.getByRole("status")).toContainText("Ogłoszenie opublikowane");

  await signOut(page);
  await register(page, "mieszkanka@example.test", api.url);
  const widget = page.getByRole("region", { name: "Ogłoszenia" });
  await expect(widget.getByText("1 nowe ogłoszenie od Twojej ostatniej wizyty")).toBeVisible();
  await widget.getByRole("button", { name: "Zamknięcie ulicy Długiej" }).click();
  await expect(page.getByRole("heading", { name: "Zamknięcie ulicy Długiej" })).toBeVisible();
  await expect(page.getByText("W sobotę od 8:00 do 16:00 remont nawierzchni.")).toBeVisible();

  await page.getByRole("link", { name: t.back }).click();
  await expect(widget.getByText("Nic nowego od Twojej ostatniej wizyty.")).toBeVisible();
  await expect(widget.getByRole("button", { name: "Zamknięcie ulicy Długiej" })).toHaveCount(0);
});

const dashboardRegions = (page: Page) =>
  page.getByRole("list", { name: t.community_dashboard_label }).getByRole("region");

/** Holds a dashboard tile by its title (away from the buttons inside it): admins enter edit mode this way. */
const holdTile = (page: Page, title: string) =>
  dashboardRegions(page).getByRole("heading", { name: title, level: 2 }).click({ delay: 900 });

const publishAnnouncement = async (page: Page, title: string) => {
  await page.goto("/app/c/krakow/announcements/list");
  await page.getByLabel("Tytuł").fill(title);
  await page.getByRole("button", { name: "Opublikuj ogłoszenie" }).click();
  await expect(page.getByRole("status")).toContainText("Ogłoszenie opublikowane");
};

test("admin reorders the dashboard; residents see the new order and cannot edit", async ({ page, api }) => {
  await login(page, "admin@krakow.test");
  await publishAnnouncement(page, "Zebranie mieszkańców");
  await page.goto("/app");
  await expect(dashboardRegions(page)).toHaveCount(2);
  await expect(dashboardRegions(page).nth(0)).toHaveAttribute("aria-label", "Zgłoszenia");

  await holdTile(page, "Ogłoszenia");
  await expect(page).toHaveURL(/\/app$/);
  await page.getByRole("button", { name: `${t.dashboard_move_earlier}: Ogłoszenia` }).click();
  await expect(dashboardRegions(page).nth(0)).toHaveAttribute("aria-label", "Ogłoszenia");
  await page.getByRole("button", { name: t.dashboard_done }).click();
  await expect(page.getByRole("button", { name: `${t.dashboard_move_earlier}: Ogłoszenia` })).toHaveCount(0);

  await signOut(page);
  await register(page, "sasiad@example.test", api.url);
  await expect(dashboardRegions(page).nth(0)).toHaveAttribute("aria-label", "Ogłoszenia");
  await expect(dashboardRegions(page).nth(1)).toHaveAttribute("aria-label", "Zgłoszenia");
  await holdTile(page, "Zgłoszenia");
  await expect(page.getByRole("heading", { name: "Zgłoszenia", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: t.dashboard_done })).toHaveCount(0);
});

test("admin drags a widget to a new place on the dashboard", async ({ page }) => {
  // The whole dashboard must fit in the viewport: the mouse cannot drag to points outside it.
  await page.setViewportSize({ width: 1280, height: 1400 });
  await login(page, "admin@krakow.test");
  await publishAnnouncement(page, "Przerwa w dostawie wody");
  await page.goto("/app");
  await expect(dashboardRegions(page)).toHaveCount(2);
  await holdTile(page, "Zgłoszenia");

  const handle = page.getByLabel(`${t.dashboard_drag}: Ogłoszenia`);
  const target = await dashboardRegions(page).nth(0).boundingBox();
  const from = await handle.boundingBox();
  if (!target || !from) throw new Error("dashboard not laid out");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + 20, target.y + 20, { steps: 12 });
  await page.mouse.up();
  await expect(dashboardRegions(page).nth(0)).toHaveAttribute("aria-label", "Ogłoszenia");

  await page.getByRole("button", { name: t.dashboard_done }).click();
  await page.reload();
  await expect(dashboardRegions(page).nth(0)).toHaveAttribute("aria-label", "Ogłoszenia");
});

test("issues widget: the most reported open issues; tapping the tile opens the list", async ({ page, api }) => {
  await register(page, "zglaszajaca@example.test", api.url);
  const report = async (title: string) => {
    await openNewIssueForm(page);
    await page.getByLabel("Co się stało?").fill(title);
    await page.getByRole("button", { name: "Wyślij zgłoszenie" }).click();
    await expect(page.getByRole("status")).toContainText("Dziękujemy");
  };
  await report("Dziura w chodniku");
  await report("Przewrócony kosz przy szkole");

  await signOut(page);
  await register(page, "sasiadka@example.test", api.url);
  await page.goto("/app/c/krakow/issues/list");
  await page.getByRole("button", { name: "Przewrócony kosz przy szkole" }).click();
  await page.getByRole("button", { name: "Ja też to widzę" }).click();
  await expect(page.getByRole("status")).toContainText("Dzięki za potwierdzenie");

  await page.goto("/app");
  const top = page.getByRole("region", { name: "Zgłoszenia" }).getByRole("list", { name: "Najczęściej zgłaszane" });
  await expect(top.getByRole("listitem")).toHaveText([
    /Przewrócony kosz przy szkole.*2 osoby zgłaszają/,
    /Dziura w chodniku.*1 osoba zgłasza/,
  ]);
  // A card inside the tile opens its issue, not the list.
  await top.getByRole("button", { name: "Dziura w chodniku" }).click();
  await expect(page.getByRole("heading", { name: "Dziura w chodniku", level: 1 })).toBeVisible();

  await page.goto("/app");
  await page
    .getByRole("link", { name: `${t.dashboard_open}: Zgłoszenia` })
    .getByRole("heading", { level: 2 })
    .click();
  await expect(page).toHaveURL(/\/app\/c\/krakow\/issues\/list$/);
  await expect(page.getByRole("heading", { name: "Zgłoszenia", level: 1 })).toBeVisible();
});
