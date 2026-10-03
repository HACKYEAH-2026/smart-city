import { expect, test } from "@app/testing/playwright";
import type { Page } from "@playwright/test";
import { en } from "./messages";

/** Kryteria akceptacji auth: rejestracja, wylogowanie, ochrona /app, logowanie, błędne hasło. */
const register = async (page: Page, email: string) => {
  await page.goto("/register");
  await page.getByLabel(en.auth_email!).fill(email);
  await page.getByLabel(en.auth_password!).fill("password123");
  await page.getByRole("button", { name: en.auth_submit_register }).click();
  await expect(page.getByRole("heading", { name: en.notes_title })).toBeVisible();
};

const login = async (page: Page, email: string, password: string) => {
  await page.getByLabel(en.auth_email!).fill(email);
  await page.getByLabel(en.auth_password!).fill(password);
  await page.getByRole("button", { name: en.auth_submit_login }).click();
};

test("sign out closes /app, logging back in restores the notes", async ({ page }) => {
  await register(page, "cycle@example.test");
  await page.getByLabel(en.notes_field_title!).fill("Survives sign-out");
  await page.getByRole("button", { name: en.notes_add }).click();
  await expect(page.getByRole("heading", { name: "Survives sign-out" })).toBeVisible();

  await page.getByRole("button", { name: en.notes_sign_out }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login$/);

  await login(page, "cycle@example.test", "password123");
  await expect(page.getByRole("heading", { name: "Survives sign-out" })).toBeVisible();
});

test("wrong password shows an error and does not let you in", async ({ page }) => {
  await register(page, "wrong@example.test");
  await page.getByRole("button", { name: en.notes_sign_out }).click();
  await expect(page).toHaveURL(/\/login$/);
  await login(page, "wrong@example.test", "incorrect1");
  await expect(page.getByRole("alert")).toHaveText(en.auth_login_error!);
  await expect(page).toHaveURL(/\/login$/);
});

test("/app without a session redirects to login", async ({ page }) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: en.auth_login_title })).toBeVisible();
});
