import type { Page } from "@playwright/test";
import { t } from "../src/texts";
import { expect, joinKrakow, test } from "./fixtures";

/** Auth acceptance criteria: sign-up, sign-out, /app protection, sign-in, wrong password. */
/** Registers and lands on the dashboard; a new user has no places yet. */
const register = async (page: Page, email: string) => {
  await page.goto("/register");
  await page.getByLabel(t.auth_email).fill(email);
  await page.getByLabel(t.auth_password).fill("password123");
  await page.getByRole("checkbox", { name: t.auth_consent }).click();
  await page.getByRole("button", { name: t.auth_submit_register }).click();
  await expect(page.getByRole("heading", { name: t.dashboard_empty_title })).toBeVisible();
};

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

  await login(page, "cycle@example.test", "password123");
  await expect(page.getByRole("heading", { name: "Kraków", level: 1 })).toBeVisible();
});

test("wrong password shows an error and does not let you in", async ({ page }) => {
  await register(page, "wrong@example.test");
  await page.getByRole("navigation", { name: t.nav_main }).getByRole("link", { name: t.tab_account }).click();
  await page.getByRole("button", { name: t.sign_out }).click();
  await expect(page).toHaveURL(/\/login$/);
  await login(page, "wrong@example.test", "incorrect1");
  await expect(page.getByRole("alert")).toHaveText(t.auth_login_error);
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
  await page.getByLabel(t.auth_password).fill("password123");
  await page.getByRole("button", { name: t.auth_submit_register }).click();
  await expect(page.getByRole("alert")).toHaveText(t.auth_consent_required);
  await expect(page).toHaveURL(/\/register$/);
});

test("mobile width: no horizontal overflow (RN flex items must be allowed to shrink)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/login", "/register"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});

test("login error appears under the button, so the form does not jump", async ({ page }) => {
  await page.goto("/login");
  const button = page.getByRole("button", { name: t.auth_submit_login });
  const buttonTop = async () => (await button.boundingBox())?.y;
  const before = await buttonTop();
  await login(page, "nobody@example.test", "password123");
  await expect(page.getByRole("alert")).toHaveText(t.auth_login_error);
  expect(await buttonTop()).toBe(before);
  const alert = await page.getByRole("alert").boundingBox();
  expect(alert?.y).toBeGreaterThan(before ?? Number.POSITIVE_INFINITY);
});
