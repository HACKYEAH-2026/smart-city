import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { en } from "./messages";

/** Auth acceptance criteria: sign-up, sign-out, /app protection, sign-in, wrong password. */
const register = async (page: Page, email: string) => {
  await page.goto("/register");
  await page.getByLabel(en.auth_email!).fill(email);
  await page.getByLabel(en.auth_password!).fill("password123");
  await page.getByRole("button", { name: en.auth_submit_register }).click();
  await expect(page.getByRole("heading", { name: en.communities_title })).toBeVisible();
};

const login = async (page: Page, email: string, password: string) => {
  await page.getByLabel(en.auth_email!).fill(email);
  await page.getByLabel(en.auth_password!).fill(password);
  await page.getByRole("button", { name: en.auth_submit_login }).click();
};

test("sign out closes /app, logging back in opens the communities", async ({ page }) => {
  await register(page, "cycle@example.test");
  await expect(page.getByRole("link", { name: "Kraków" })).toBeVisible();

  await page.getByRole("button", { name: en.sign_out }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login$/);

  await login(page, "cycle@example.test", "password123");
  await expect(page.getByRole("heading", { name: en.communities_title })).toBeVisible();
});

test("wrong password shows an error and does not let you in", async ({ page }) => {
  await register(page, "wrong@example.test");
  await page.getByRole("button", { name: en.sign_out }).click();
  await expect(page).toHaveURL(/\/login$/);
  await login(page, "wrong@example.test", "incorrect1");
  await expect(page.getByRole("alert")).toHaveText(en.auth_login_error!);
  await expect(page).toHaveURL(/\/login$/);
});

test("/ and /app without a session redirect to login", async ({ page }) => {
  for (const path of ["/", "/app"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
  }
  await expect(page.getByRole("heading", { name: en.auth_login_title })).toBeVisible();
});

test("unknown URL shows the 404 page", async ({ page }) => {
  const res = await page.goto("/does-not-exist");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: en.notfound_title })).toBeVisible();
});

test("mobile width: no horizontal overflow (RN flex items must be allowed to shrink)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/login", "/register"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
