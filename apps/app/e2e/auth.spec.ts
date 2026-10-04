import type { Page } from "@playwright/test";
import { testGoogleIdToken } from "../../api/src/test-google";
import { t } from "../src/texts";
import {
  DEMO_ADMIN,
  DEMO_RESIDENT,
  expect,
  joinKrakow,
  PASSWORD,
  register,
  seedResident,
  signOut,
  test,
} from "./fixtures";

/** Auth acceptance criteria: sign-up, sign-out, /app protection, sign-in, wrong password. */
const login = async (page: Page, email: string, password: string) => {
  await page.getByLabel(t.auth_email).fill(email);
  await page.getByLabel(t.auth_password).fill(password);
  await page.getByRole("button", { name: t.auth_submit_login }).click();
};

test("sign out closes /app, logging back in opens the dashboard of the place", async ({ page, api }) => {
  await register(page, "cycle@example.test");
  await joinKrakow(api.url, "cycle@example.test");
  await page.goto("/app");
  await expect(page.getByRole("heading", { name: "Kraków", level: 1 })).toBeVisible();

  await page.getByRole("navigation", { name: t.nav_main }).getByRole("link", { name: t.tab_account }).click();
  await page.getByRole("button", { name: t.sign_out }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login$/);

  await login(page, "cycle@example.test", PASSWORD);
  await expect(page.getByRole("heading", { name: "Kraków", level: 1 })).toBeVisible();
});

/** Dev login: EXPO_PUBLIC_DEV_LOGIN=true in the repo's .env; E2E turns it on with `__DEV_LOGIN__` (like `__API_URL__`). */
const devLoginButton = (page: Page, email: string) =>
  page.getByRole("button", { name: `${t.auth_dev_login} ${email}` });
const turnOnDevLogin = (page: Page) =>
  page.addInitScript(() => {
    (globalThis as unknown as { __DEV_LOGIN__: boolean }).__DEV_LOGIN__ = true;
  });

test("dev login: hidden by default; with the flag one tap signs in as the demo admin", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: t.auth_submit_login })).toBeVisible();
  await expect(page.getByRole("button", { name: new RegExp(`^${t.auth_dev_login}`) })).toHaveCount(0);

  await turnOnDevLogin(page);
  await page.reload();
  await expect(devLoginButton(page, DEMO_RESIDENT.email)).toBeVisible();
  await devLoginButton(page, DEMO_ADMIN.email).click();
  await expect(page.getByRole("heading", { name: "Kraków", level: 1 })).toBeVisible();
});

test("dev login as the demo resident: Kraków first, a member of the campus and the cooperative", async ({
  page,
  api,
}) => {
  await seedResident(api.url);
  await turnOnDevLogin(page);
  await page.goto("/login");
  await devLoginButton(page, DEMO_RESIDENT.email).click();
  await expect(page.getByRole("heading", { name: "Kraków", level: 1 })).toBeVisible();

  await page.getByRole("navigation", { name: t.nav_main }).getByRole("link", { name: t.tab_account }).click();
  await expect(page.getByText(DEMO_RESIDENT.email)).toBeVisible();
  const places = page.getByRole("list", { name: t.account_places_label });
  for (const name of ["Kampus Główny", "Kraków", "Spółdzielnia Słoneczna"]) {
    await expect(places.getByRole("link", { name: new RegExp(name) })).toBeVisible();
  }
  await expect(places.getByText(t.role_admin)).toHaveCount(0);
});

test("wrong password shows an error and does not let you in", async ({ page }) => {
  await register(page, "wrong@example.test");
  // Without places there is no bottom bar: the account opens from the avatar button (design E-BrakMiejsc).
  await page.getByRole("button", { name: t.account_title }).click();
  await page.getByRole("button", { name: t.sign_out }).click();
  await expect(page).toHaveURL(/\/login$/);
  await login(page, "wrong@example.test", "incorrect1");
  await expect(page.getByRole("alert")).toHaveText(t.auth_login_error);
  await expect(page).toHaveURL(/\/login$/);
});

/**
 * Google sign-in runs only on the phones (native account picker); the web build used for E2E has none, so the test
 * stands in for the picker: it returns this ID token (null = the user closed the picker). The API accepts test
 * tokens (apps/api/src/test-google.ts); from there on it is the production path: account, session, screens.
 */
const pickGoogleAccount = (page: Page, email: string | null) =>
  page.addInitScript(
    (token) => {
      (globalThis as unknown as { __GOOGLE_ID_TOKEN__: string | null }).__GOOGLE_ID_TOKEN__ = token;
    },
    email ? testGoogleIdToken({ email, name: "Jan Kowalski" }) : null,
  );

test("Google: the first sign-in creates the account, the next one opens the same account", async ({ page, api }) => {
  await pickGoogleAccount(page, "jan@gmail.test");
  await page.goto("/login");
  await expect(page.getByText(t.auth_google_consent)).toBeVisible();
  await page.getByRole("button", { name: t.auth_google }).click();
  await expect(page.getByRole("heading", { name: t.dashboard_empty_title })).toBeVisible();

  await signOut(page);
  await joinKrakow(api.url, "jan@gmail.test");
  await page.getByRole("button", { name: t.auth_google }).click();
  await expect(page.getByRole("heading", { name: "Kraków", level: 1 })).toBeVisible();
});

test("Google: an email that already has a password gets a message, not a second way in", async ({ page }) => {
  await pickGoogleAccount(page, "ola@gmail.test");
  await register(page, "ola@gmail.test");
  await signOut(page);
  await page.getByRole("button", { name: t.auth_google }).click();
  await expect(page.getByRole("alert")).toHaveText(t.auth_google_exists);
  await expect(page).toHaveURL(/\/login$/);
});

test("Google: closing the account picker leaves the login screen as it was", async ({ page }) => {
  await pickGoogleAccount(page, null);
  await page.goto("/login");
  await page.getByRole("button", { name: t.auth_google }).click();
  await expect(page.getByRole("button", { name: t.auth_google })).toBeEnabled();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page).toHaveURL(/\/login$/);
});

test("/ and /app without a session redirect to login", async ({ page }) => {
  for (const path of ["/", "/app"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
  }
  await expect(page.getByRole("heading", { name: t.auth_login_title })).toBeVisible();
});

test("unknown URL shows the 404 page", async ({ page }) => {
  const res = await page.goto("/does-not-exist");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: t.notfound_title })).toBeVisible();
});

test("auth screen uses the design system: primary button is brand red, field labels are visible", async ({ page }) => {
  await page.goto("/login");
  const submit = page.getByRole("button", { name: t.auth_submit_login });
  await expect(submit).toHaveCSS("background-color", "rgb(229, 1, 1)");
  await expect(page.getByLabel(t.auth_email)).toBeVisible();
});

test("web pages carry the brand mark as their favicon", async ({ page }) => {
  await page.goto("/login");
  const href = await page.locator('link[rel~="icon"]').first().getAttribute("href");
  expect(href).toBeTruthy();
  const icon = await page.request.get(new URL(href ?? "", page.url()).toString());
  expect(icon.ok()).toBe(true);
});

test("login screen follows the design: welcome copy, sign-up link, no app chrome", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: t.auth_login_title, level: 1 })).toBeVisible();
  await expect(page.getByText(t.auth_login_lead)).toBeVisible();
  await expect(page.getByRole("link", { name: t.auth_goto_register })).toHaveAttribute("href", "/register");
  await expect(page.getByRole("navigation", { name: t.nav_label })).toHaveCount(0);
});

test("register screen follows the design: back button, step, consent required", async ({ page }) => {
  await page.goto("/register");
  await expect(page.getByRole("heading", { name: t.auth_register_title, level: 1 })).toBeVisible();
  await expect(page.getByText(t.auth_register_lead)).toBeVisible();
  await expect(page.getByText(t.auth_step)).toBeVisible();
  await expect(page.getByRole("button", { name: t.auth_back })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: t.auth_consent })).not.toBeChecked();

  await page.getByLabel(t.auth_email).fill("consent@example.test");
  await page.getByLabel(t.auth_password).fill(PASSWORD);
  await page.getByRole("button", { name: t.auth_submit_register }).click();
  await expect(page.getByRole("alert")).toHaveText(t.auth_consent_required);
  await expect(page).toHaveURL(/\/register$/);
});

test("mobile width: no horizontal overflow (RN flex items must be allowed to shrink)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/login", "/register"]) {
    await page.goto(path);
    // The screen slides in on load, so the layout is measured once the entry animation has finished.
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), { message: path })
      .toBeLessThanOrEqual(0);
  }
});

test("login error appears under the button, so the form does not jump", async ({ page }) => {
  await page.goto("/login");
  const button = page.getByRole("button", { name: t.auth_submit_login });
  const buttonTop = async () => (await button.boundingBox())?.y;
  const before = await buttonTop();
  await login(page, "nobody@example.test", PASSWORD);
  await expect(page.getByRole("alert")).toHaveText(t.auth_login_error);
  expect(await buttonTop()).toBe(before);
  const alert = await page.getByRole("alert").boundingBox();
  expect(alert?.y).toBeGreaterThan(before ?? Number.POSITIVE_INFINITY);
});
