import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { t } from "../src/texts";
import {
  DEMO_ADMIN_NAME,
  DEMO_RESIDENT,
  expect,
  joinKrakow,
  loginAdmin,
  seedDemoContent,
  TEST_ADMIN_TOKEN,
  test,
} from "./fixtures";

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

/** The issues widget's tile on the dashboard ("Otwórz: Zgłoszenia"). */
const ISSUES_TILE = `${t.dashboard_open}: Zgłoszenia`;

test("community -> issues plugin: report an issue and find it on the list", async ({ page, api }) => {
  await register(page, "issues@example.test", api.url);
  await expect(page.getByRole("heading", { name: "Kraków", level: 1 })).toBeVisible();

  await page.getByRole("link", { name: ISSUES_TILE, exact: true }).click();
  await expect(page.getByRole("heading", { name: "Zgłoszenia", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Na razie cisza" })).toBeVisible();

  await page.getByRole("button", { name: "Zgłoś", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Zrób zdjęcie", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Pomiń zdjęcie" }).click();
  await page.getByLabel("Tytuł").fill("Nie świeci latarnia na Długiej");
  await page.getByLabel("Opis").fill("Przy przystanku, od tygodnia");
  await page.getByRole("button", { name: "Wyślij zgłoszenie" }).click();

  await expect(page.getByRole("heading", { name: "Dziękujemy za zgłoszenie" })).toBeVisible();
  // The sent screen shows the report; its card opens the details, where the author's own vote is in.
  await page.getByRole("button", { name: "Nie świeci latarnia na Długiej" }).click();
  await expect(page.getByRole("button", { name: "Podbite 1" })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("link", { name: t.back }).click();
  const list = page.getByRole("list", { name: "Lista zgłoszeń" });
  await expect(list.getByRole("button", { name: /^Nie świeci latarnia na Długiej/ })).toBeVisible();
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

/** The list's "Zgłoś" → the photo step; `skipPhoto` goes on to the form without one. */
const openNewIssue = async (page: Page) => {
  await page.goto("/app/c/krakow/issues/list");
  await page.getByRole("button", { name: "Zgłoś", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Zrób zdjęcie", level: 1 })).toBeVisible();
};
const openNewIssueForm = async (page: Page) => {
  await openNewIssue(page);
  await page.getByRole("button", { name: "Pomiń zdjęcie" }).click();
  await expect(page.getByRole("heading", { name: "Nowe zgłoszenie", level: 1 })).toBeVisible();
};
const reportIssue = async (page: Page, title: string) => {
  await openNewIssueForm(page);
  await page.getByLabel("Tytuł").fill(title);
  await page.getByRole("button", { name: "Wyślij zgłoszenie" }).click();
  await expect(page.getByRole("heading", { name: "Dziękujemy za zgłoszenie" })).toBeVisible();
};

/** Minimal JPEG header — the server checks the file type, not its content. */
const PHOTO = {
  name: "latarnia.jpg",
  mimeType: "image/jpeg",
  buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16]),
};

test("photo report, then the AI offers to join a similar report; joining adds the vote", async ({ page, api }) => {
  await register(page, "anna@example.test", api.url);
  await openNewIssue(page);
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: t.plugin_photo_add }).click();
  await (await chooser).setFiles(PHOTO);
  await expect(page.getByRole("img", { name: `${t.plugin_photo_number} 1 ${t.plugin_photo_of} 1` })).toBeVisible();
  await page.getByRole("button", { name: "Dalej" }).click();
  // The form keeps the photo of the first step.
  await expect(page.getByRole("heading", { name: "Nowe zgłoszenie", level: 1 })).toBeVisible();
  await expect(page.getByRole("img", { name: `${t.plugin_photo_number} 1 ${t.plugin_photo_of} 1` })).toBeVisible();
  await page.getByLabel("Tytuł").fill("Nie świeci latarnia na Długiej");
  await page.getByRole("button", { name: "Wyślij zgłoszenie" }).click();
  await expect(page.getByRole("heading", { name: "Dziękujemy za zgłoszenie" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Zdjęcie zgłoszenia" })).toBeVisible();

  await signOut(page);
  await register(page, "bartek@example.test", api.url);
  await openNewIssueForm(page);
  await page.getByLabel("Tytuł").fill("Latarnia na Długiej nie świeci");
  await page.getByLabel("Opis").fill("Ciemno od tygodnia");
  await page.getByRole("button", { name: "Wyślij zgłoszenie" }).click();

  // Without a model the host compares words (lexical findSimilar): the sheet asks before anything is saved.
  const sheet = page.getByRole("dialog", { name: "Czy to ten sam problem?" });
  await expect(sheet.getByText("Nie świeci latarnia na Długiej")).toBeVisible();
  await sheet.getByRole("button", { name: "Tak, dołącz i podbij" }).click();
  const done = page.getByRole("dialog", { name: "Dołączono i podbito" });
  await expect(done.getByText(/ma teraz 2 głosy/)).toBeVisible();
  await done.getByRole("button", { name: "Zobacz zgłoszenie" }).click();
  await expect(page.getByRole("heading", { name: "Nie świeci latarnia na Długiej", level: 1 }).last()).toBeVisible();
  await expect(page.getByRole("button", { name: "Podbite 2" }).last()).toHaveAttribute("aria-pressed", "true");
});

/**
 * Acceptance (design Z-Lista, Z-AdminPanel, Z-AdminSzczegoly): a neighbour votes on the list's pill; the place's
 * admin closes the report from the panel and it leaves "Popularne".
 */
test("issues: vote on the list, the admin closes the report from the panel, it leaves Popularne", async ({
  page,
  api,
}) => {
  await register(page, "autorka@example.test", api.url);
  await reportIssue(page, "Dziura w chodniku przy szkole");

  await signOut(page);
  await register(page, "sasiad-glos@example.test", api.url);
  await page.goto("/app/c/krakow/issues/list");
  const list = page.getByRole("list", { name: "Lista zgłoszeń" });
  await expect(list.getByRole("button", { name: /^Dziura w chodniku przy szkole/ })).toBeVisible();
  const notVoted = list.getByRole("button", { name: "Podbij zgłoszenie, 1 głos" });
  await expect(notVoted).toHaveAttribute("aria-pressed", "false");
  await notVoted.click();
  const voted = list.getByRole("button", { name: "Podbij zgłoszenie, 2 głosy" });
  await expect(voted).toHaveAttribute("aria-pressed", "true");
  // A toggle: pressing again takes the vote back.
  await voted.click();
  await expect(list.getByRole("button", { name: "Podbij zgłoszenie, 1 głos" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  // Members have no panel.
  await expect(page.getByRole("button", { name: "Panel" })).toHaveCount(0);

  await signOut(page);
  await login(page, "admin@krakow.test");
  await page.goto("/app/c/krakow/issues/list");
  await page.getByRole("button", { name: "Panel" }).click();
  await expect(page.getByRole("heading", { name: "Zgłoszenia", level: 1 }).last()).toBeVisible();
  await expect(page.getByRole("tab", { name: "Aktywne, 1" })).toHaveAttribute("aria-selected", "true");
  await page
    .getByRole("list", { name: "Zgłoszenia do obsługi" })
    .getByRole("button", { name: /Dziura w chodniku przy szkole/ })
    .click();
  await expect(page.getByRole("heading", { name: "Szczegóły i obsługa", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Zamknij zgłoszenie" }).click();
  await expect(page.getByRole("status")).toContainText("Zgłoszenie zamknięte.");
  await expect(page.getByRole("button", { name: "Otwórz ponownie" })).toBeVisible();

  await page.goto("/app/c/krakow/issues/list");
  await expect(page.getByRole("heading", { name: "Na razie cisza" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Dziura w chodniku przy szkole/ })).toHaveCount(0);
});

/** The admin part of the plugin's page in "Zarządzaj miejscem" (design Z-StronaPluginu) comes from its adminView. */
test("issues plugin page: counts, the unread badge on the panel, and the way to the panel", async ({ page, api }) => {
  await register(page, "zglaszajacy@example.test", api.url);
  await reportIssue(page, "Zepsuty domofon");

  await signOut(page);
  await login(page, "admin@krakow.test");
  await page.goto("/app/c/krakow/manage/issues");
  const panel = page.getByRole("button", { name: /^Panel zgłoszeń/ });
  await expect(panel).toContainText("1");
  await expect(page.getByRole("button", { name: /^Ustawienia rozszerzenia/ })).toBeVisible();
  await panel.click();
  await expect(page).toHaveURL(/\/app\/c\/krakow\/issues\/panel/);
  await expect(page.getByRole("button", { name: /Zepsuty domofon/ })).toBeVisible();
  await page.getByRole("link", { name: t.back }).last().click();
  await expect(page).toHaveURL(/\/app\/c\/krakow\/manage\/issues$/);
  await page
    .getByRole("button", { name: /^Ustawienia rozszerzenia/ })
    .last()
    .click();
  // The settings view first: while it loads, "back" leads to the dashboard (PluginView without its tree).
  await expect(page.getByRole("heading", { name: "Kategorie" })).toBeVisible();
  await page.getByRole("link", { name: t.back }).last().click();
  await expect(page).toHaveURL(/\/app\/c\/krakow\/manage\/issues$/);
});

test("changing a report category preserves an unsaved admin reply and note", async ({ page, api }) => {
  await register(page, "draft-author@example.test", api.url);
  await reportIssue(page, "Zepsuty domofon");
  await signOut(page);
  await login(page, "admin@krakow.test");
  await page.goto("/app/c/krakow/issues/settings");
  await page.getByLabel("Nowa kategoria").fill("Oświetlenie");
  await page.getByRole("button", { name: "Dodaj", exact: true }).click();
  await expect(page.getByText("Oświetlenie", { exact: true })).toBeVisible();
  await page.goto("/app/c/krakow/issues/panel");
  await page.getByRole("button", { name: /Zepsuty domofon/ }).click();
  await page.getByLabel("Odpowiedź dla członków", { exact: true }).fill("Naprawa jutro");
  await page.getByLabel("Notatka wewnętrzna", { exact: true }).fill("Numer serwisu 42");
  await page.getByRole("button", { name: /^Zmień kategorię/ }).click();
  await page.getByRole("dialog").getByRole("radio", { name: "Oświetlenie", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Kategori");
  await expect(page.getByLabel("Odpowiedź dla członków", { exact: true })).toHaveValue("Naprawa jutro");
  await expect(page.getByLabel("Notatka wewnętrzna", { exact: true })).toHaveValue("Numer serwisu 42");
});

test("issues settings: turning voting off removes the vote pill", async ({ page, api }) => {
  await register(page, "bez-glosow@example.test", api.url);
  await reportIssue(page, "Skrzypiąca furtka");
  await page.goto("/app/c/krakow/issues/list");
  await expect(page.getByRole("button", { name: "Podbij zgłoszenie, 1 głos" })).toBeVisible();

  await signOut(page);
  await login(page, "admin@krakow.test");
  await page.goto("/app/c/krakow/issues/settings");
  const voting = page.getByRole("switch", { name: "Podbijanie" });
  await expect(voting).toBeChecked();
  await voting.click();
  await expect(voting).not.toBeChecked();

  await page.goto("/app/c/krakow/issues/list");
  await expect(page.getByRole("tab", { name: "Zamknięte" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Skrzypiąca furtka/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Podbij zgłoszenie/ })).toHaveCount(0);
});

/**
 * Plugin maps (ui.map, ui.locationInput): the place of a report is picked on the app's location picker; the report's
 * details show it on a map. The pins are drawn on a canvas (an iframe on the web), so the map's own list is what E2E
 * (and screen readers) use.
 */
test("issues on the map: a report placed on the map shows its address and pin", async ({ page, api }) => {
  await register(page, "mapa@example.test", api.url);
  await openNewIssueForm(page);
  await page.getByLabel("Tytuł").fill("Nie świeci latarnia na Floriańskiej");

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

  await expect(page.getByRole("heading", { name: "Dziękujemy za zgłoszenie" })).toBeVisible();
  // The sent screen's card opens the details, where the address and the pin are.
  await page.getByRole("button", { name: "Nie świeci latarnia na Floriańskiej" }).last().click();
  await expect(page.getByText("Floriańska 15, 31-019 Kraków").last()).toBeVisible();
  await page.getByRole("button", { name: "Floriańska 15, 31-019 Kraków", exact: true }).last().click();
  await expect(page).toHaveURL(/\/issues\/map\?/);
  await expect(page.getByTitle("Miejsce zgłoszenia")).toBeVisible();
  await page
    .getByRole("button", { name: `${t.plugin_map_list_show} (1)` })
    .last()
    .click();
  await expect(
    page
      .getByRole("list", { name: "Miejsce zgłoszenia" })
      .last()
      .getByText("Nie świeci latarnia na Floriańskiej", { exact: true }),
  ).toBeVisible();
});

/** A test-only plugin (not one of plugins/: those are all built in). */
const NOTES = readFileSync(join(import.meta.dirname, "../../api/test/fixtures/notes-plugin.ts"), "utf8");

test("plugin uploaded by an admin shows up in the open community without a reload", async ({ page, api }) => {
  // The tile shows on the dashboard's next poll (every 15 s): more than the default 30 s on a busy machine.
  test.setTimeout(60_000);
  await register(page, "admin-demo@example.test", api.url);
  await page.goto("/app");
  await expect(page.getByRole("link", { name: ISSUES_TILE, exact: true })).toBeVisible();
  // The plugin's one widget is its way in: its tile appears once the plugin is installed.
  const notesTile = page.getByRole("link", { name: `${t.dashboard_open}: Notatki`, exact: true });
  await expect(notesTile).toHaveCount(0);

  const headers = {
    authorization: `Bearer ${TEST_ADMIN_TOKEN}`,
    "content-type": "application/json",
  };
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

  await notesTile.click({ timeout: 20_000 }); // the dashboard refetches every 15 s
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
  await publishAnnouncement(page, "Zebranie użytkowników");
  await page.goto("/app");
  await expect(dashboardRegions(page)).toHaveCount(3);
  await expect(dashboardRegions(page).nth(0)).toHaveAttribute("aria-label", "Zgłoszenia");

  await holdTile(page, "Ogłoszenia");
  await expect(page).toHaveURL(/\/app$/);
  await page.getByRole("button", { name: `${t.dashboard_move_earlier}: Ogłoszenia` }).click();
  await expect(dashboardRegions(page).nth(0)).toHaveAttribute("aria-label", "Ogłoszenia");
  await page.getByRole("button", { name: t.dashboard_done }).click();
  await expect(
    page.getByRole("button", {
      name: `${t.dashboard_move_earlier}: Ogłoszenia`,
    }),
  ).toHaveCount(0);

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
  await page.setViewportSize({ width: 1280, height: 1800 });
  await login(page, "admin@krakow.test");
  await publishAnnouncement(page, "Przerwa w dostawie wody");
  await page.goto("/app");
  await expect(dashboardRegions(page)).toHaveCount(3);
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

test("issues widget: the most voted active reports; the header and the tile open the list", async ({ page, api }) => {
  await register(page, "zglaszajaca@example.test", api.url);
  const tile = page.getByRole("region", { name: "Zgłoszenia" });
  await expect(tile.getByText("Na razie cisza")).toBeVisible();
  await reportIssue(page, "Dziura w chodniku");
  await reportIssue(page, "Przewrócony kosz przy szkole");

  await signOut(page);
  await register(page, "sasiadka@example.test", api.url);
  await page.goto("/app/c/krakow/issues/list");
  const bin = page
    .getByRole("list", { name: "Lista zgłoszeń" })
    .getByRole("listitem")
    .filter({ hasText: "Przewrócony kosz przy szkole" });
  await bin.getByRole("button", { name: "Podbij zgłoszenie, 1 głos" }).click();
  await expect(bin.getByRole("button", { name: "Podbij zgłoszenie, 2 głosy" })).toBeVisible();

  await page.goto("/app");
  const rows = tile.getByRole("list", { name: "Najpopularniejsze zgłoszenia" }).getByRole("listitem");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("Przewrócony kosz przy szkole");
  await expect(rows.nth(0).getByLabel("2 głosy")).toBeVisible();
  // A row opens its report.
  await tile.getByRole("button", { name: "Przewrócony kosz przy szkole" }).click();
  await expect(page.getByRole("heading", { name: "Przewrócony kosz przy szkole", level: 1 })).toBeVisible();

  // "Zgłoś problem" opens the photo step.
  await page.goto("/app");
  await tile.getByRole("button", { name: "Zgłoś problem" }).click();
  await expect(page.getByRole("heading", { name: "Zrób zdjęcie", level: 1 })).toBeVisible();

  // The header link ("2 aktywne") opens the list, and so does the tile.
  await page.goto("/app");
  await tile.getByRole("button", { name: "2 aktywne" }).click();
  await expect(page).toHaveURL(/\/app\/c\/krakow\/issues\/list$/);
  await page.goto("/app");
  await page.getByRole("link", { name: ISSUES_TILE }).getByRole("heading", { level: 2 }).click();
  await expect(page).toHaveURL(/\/app\/c\/krakow\/issues\/list$/);
  await expect(page.getByRole("heading", { name: "Zgłoszenia", level: 1 })).toBeVisible();
});

test("issues list: a tab changes the list in place; going back leaves the list", async ({ page, api }) => {
  await register(page, "filtry@example.test", api.url);
  await page.goto("/app/c/krakow/issues/list");
  await expect(page.getByRole("heading", { name: "Zgłoszenia", level: 1 })).toBeVisible();
  await page.getByRole("tab", { name: "Najnowsze" }).click();
  await expect(page).toHaveURL(/tab=newest/);
  await expect(page.getByRole("tab", { name: "Najnowsze" })).toHaveAttribute("aria-selected", "true");
  await page.goBack();
  await expect(page).toHaveURL(/\/app$/);
});

test("discussions widget: latest activity first, a tap opens the discussion, the header opens all", async ({
  page,
  api,
}) => {
  await register(page, "anna@example.test", api.url);
  const widget = page.getByRole("region", { name: "Dyskusje" });
  await expect(widget.getByText("Nikt jeszcze nie zaczął rozmowy.")).toBeVisible();

  const startDiscussion = async (title: string, message?: string) => {
    await page.goto("/app");
    await widget.getByRole("button", { name: "Nowa dyskusja" }).click();
    await expect(page.getByRole("heading", { name: "Nowa dyskusja", level: 1 })).toBeVisible();
    await page.getByLabel("Temat").fill(title);
    await page.getByRole("button", { name: "Załóż dyskusję" }).click();
    await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();
    if (!message) return;
    await page.getByLabel("Twoja wiadomość").fill(message);
    await page.getByRole("button", { name: "Wyślij" }).click();
    await expect(page.getByRole("list", { name: "Wiadomości" }).getByText(message)).toBeVisible();
    await expect(page.getByLabel("Twoja wiadomość")).toHaveValue("");
  };
  await startDiscussion("Zieleń przy Rondzie Mogilskim", "Proponuję lipy");
  await startDiscussion("Parking pod blokiem");

  // A neighbour sees both, the latest activity first, as new.
  await signOut(page);
  await register(page, "bartek@example.test", api.url);
  const rows = widget.getByRole("list", { name: "Ostatnia aktywność" }).getByRole("listitem");
  await expect(widget.getByText("2 z nowymi wpisami")).toBeVisible();
  await expect(rows.nth(0)).toContainText("Parking pod blokiem");
  await expect(rows.nth(1)).toContainText("Zieleń przy Rondzie Mogilskim");
  await expect(rows.nth(1)).toContainText("anna@example.test: Proponuję lipy");

  // Tapping a discussion opens it; a reply moves it to the top.
  await widget.getByRole("button", { name: /Zieleń przy Rondzie Mogilskim/ }).click();
  await expect(page.getByRole("heading", { name: "Zieleń przy Rondzie Mogilskim", level: 1 })).toBeVisible();
  await page.getByLabel("Twoja wiadomość").fill("Raczej klony");
  await page.getByRole("button", { name: "Wyślij" }).click();
  const messages = page.getByRole("list", { name: "Wiadomości" });
  await expect(messages.getByText("Raczej klony")).toBeVisible();
  // A chat without clock lines between the messages.
  await expect(messages.getByText(/^\d{2}:\d{2}$/)).toHaveCount(0);

  await page.goto("/app");
  await expect(rows.nth(0)).toContainText("Zieleń przy Rondzie Mogilskim");
  await expect(rows.nth(0)).toContainText("Ty: Raczej klony");
  await expect(widget.getByText("2 dyskusje", { exact: true })).toBeVisible();

  // The header link opens all discussions: a card each, with the last message, who took part and how much was written.
  await widget.getByRole("button", { name: "Wszystkie" }).click();
  await expect(page).toHaveURL(/\/app\/c\/krakow\/discussions\/list$/);
  await expect(page.getByRole("heading", { name: "Dyskusje", level: 1 })).toBeVisible();
  const cards = page.getByRole("list", { name: "Lista dyskusji" }).getByRole("listitem");
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0)).toContainText("Zieleń przy Rondzie Mogilskim");
  await expect(cards.nth(0)).toContainText("Ty: Raczej klony");
  await expect(cards.nth(0)).toContainText("2 osoby");
  await expect(cards.nth(0)).toContainText("2 wiadomości");
  await expect(cards.nth(1)).toContainText("Parking pod blokiem");
  await expect(cards.nth(1)).toContainText("1 osoba");
  await expect(cards.nth(1)).toContainText("0 wiadomości");

  // A card opens its discussion; a new one starts from the screen's header.
  await page.getByRole("button", { name: /Parking pod blokiem/ }).click();
  await expect(page.getByRole("heading", { name: "Parking pod blokiem", level: 1 })).toBeVisible();
  await page.goBack();
  await page.getByRole("button", { name: "Nowa dyskusja" }).click();
  await expect(page.getByRole("heading", { name: "Nowa dyskusja", level: 1 })).toBeVisible();
});

test("discussion chat: send shows up only with a message; sending empties the field and keeps it focused", async ({
  page,
  api,
}) => {
  await register(page, "anna@example.test", api.url);
  await page.getByRole("region", { name: "Dyskusje" }).getByRole("button", { name: "Nowa dyskusja" }).click();
  await page.getByLabel("Temat").fill("Ławki na Plantach");
  await page.getByRole("button", { name: "Załóż dyskusję" }).click();
  await expect(page.getByRole("heading", { name: "Ławki na Plantach", level: 1 })).toBeVisible();

  const box = page.getByLabel("Twoja wiadomość");
  const send = page.getByRole("button", { name: "Wyślij", exact: true });
  const chat = page.getByRole("list", { name: "Wiadomości" });
  await expect(box).toBeVisible();
  await expect(send).toHaveCount(0);
  await box.fill("   ");
  await expect(send).toHaveCount(0);

  await box.fill("Brakuje ławek przy Wawelu");
  await expect(send).toBeVisible();
  await send.click();
  await expect(chat.getByText("Brakuje ławek przy Wawelu")).toBeVisible();
  await expect(box).toHaveValue("");
  await expect(send).toHaveCount(0);

  await box.fill("I przy Barbakanie");
  await box.press("Enter");
  await expect(chat.getByText("I przy Barbakanie")).toBeVisible();
  await expect(box).toHaveValue("");
  await expect(box).toBeFocused();
});

test("issues: after a report is sent, back does not return to the filled-in form", async ({ page, api }) => {
  await register(page, "wyslane@example.test", api.url);
  await openNewIssueForm(page);
  await page.getByLabel("Tytuł").fill("Dziura w chodniku");
  await page.getByLabel("Opis").fill("Przy wejściu do parku");
  await page.getByRole("button", { name: "Wyślij zgłoszenie" }).click();
  await expect(page.getByRole("heading", { name: "Dziękujemy za zgłoszenie" })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/issues\/list$/);
  await expect(page.getByRole("button", { name: "Wyślij zgłoszenie" })).toHaveCount(0);
});

test("discussions: a moderator closes one from the header after confirming; residents can no longer write", async ({
  page,
  api,
}) => {
  await login(page, "admin@krakow.test");
  await page.goto("/app/c/krakow/discussions/new");
  await page.getByLabel("Temat").fill("Remont Plant");
  await page.getByRole("button", { name: "Załóż dyskusję" }).click();
  await expect(page.getByRole("heading", { name: "Remont Plant", level: 1 })).toBeVisible();

  // Dismissing the confirmation changes nothing.
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Zamknij dyskusję" }).click();
  await expect(page.getByText("Dyskusja jest zamknięta")).toHaveCount(0);

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Zamknij dyskusję" }).click();
  await expect(page.getByText("Dyskusja jest zamknięta")).toBeVisible();
  await expect(page.getByRole("button", { name: "Otwórz dyskusję" })).toBeVisible();
  await expect(page.getByLabel("Twoja wiadomość")).toBeVisible(); // moderators still write

  await signOut(page);
  await register(page, "mieszkaniec@example.test", api.url);
  await page
    .getByRole("region", { name: "Dyskusje" })
    .getByRole("button", { name: /Remont Plant/ })
    .click();
  await expect(page.getByText("Dyskusja jest zamknięta")).toBeVisible();
  await expect(page.getByLabel("Twoja wiadomość")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Otwórz dyskusję" })).toHaveCount(0);
});

test("discussions: the place's administrator's message is marked in the accent colour", async ({ page, api }) => {
  await seedDemoContent(api.url);
  await loginAdmin(page);
  const widget = page.getByRole("region", { name: "Dyskusje" });
  await page.goto("/app");
  await widget.getByRole("button", { name: "Nowa dyskusja" }).click();
  await page.getByLabel("Temat").fill("Ławki przy Rynku");
  await page.getByRole("button", { name: "Załóż dyskusję" }).click();
  await page.getByLabel("Twoja wiadomość").fill("Ławki wrócą w maju.");
  await page.getByRole("button", { name: "Wyślij" }).click();
  await expect(page.getByRole("list", { name: "Wiadomości" }).getByText("Ławki wrócą w maju.")).toBeVisible();

  await signOut(page);
  await login(page, DEMO_RESIDENT.email);
  await page.goto("/app");
  await widget.getByRole("button", { name: /Ławki przy Rynku/ }).click();
  const admin = page
    .getByRole("list", { name: "Wiadomości" })
    .getByRole("listitem", { name: new RegExp(`${t.plugin_chat_admin}`) });
  await expect(admin).toContainText("Ławki wrócą w maju.");
  await expect(admin).toContainText(DEMO_ADMIN_NAME);
});
