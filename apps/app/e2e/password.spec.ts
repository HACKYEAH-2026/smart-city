import { t } from "../src/texts";
import { expect, test } from "./fixtures";

/** Password rule: at least 5 characters and nothing else (hint under the field, checked on submit, same in the API). */
test("the hint asks for 5 characters until the password has them, whatever they are", async ({ page }) => {
  await page.goto("/register");
  const password = page.getByLabel(t.auth_password);
  await expect(page.getByText(t.pw_hint_length)).toBeVisible();
  await password.fill("abcd");
  await expect(page.getByText(t.pw_hint_length)).toBeVisible();
  await password.fill("abcde");
  await expect(page.getByText(t.pw_ok)).toBeVisible();
  await password.fill("HASLO");
  await expect(page.getByText(t.pw_ok)).toBeVisible();
});

test("a 4-character password is refused with its own message; 5 characters register", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel(t.auth_email).fill("short@example.test");
  await page.getByLabel(t.auth_password).fill("abcd");
  await page.getByRole("checkbox", { name: t.auth_consent }).click();
  await page.getByRole("button", { name: t.auth_submit_register }).click();
  await expect(page.getByRole("alert")).toHaveText(t.auth_password_too_short);
  await expect(page).toHaveURL(/\/register$/);

  await page.getByLabel(t.auth_password).fill("abcde");
  await page.getByRole("button", { name: t.auth_submit_register }).click();
  await expect(page).toHaveURL(/\/app$/);
});
