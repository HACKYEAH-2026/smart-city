import { expect, test } from "@app/testing/playwright";
import { en, pl } from "./messages";

/** Landing: statyczny HTML (SEO) z prawdziwymi nagłówkami i linkami, w każdym języku. */
test("landing is real HTML without JS: h1, links, title, description", async ({ browser, request }) => {
  const html = await (await request.get("/")).text();
  expect(html).toMatch(/<html\s+lang="en"/);
  expect(html).toContain(en.hero_lead);
  expect(html).toMatch(new RegExp(`<title[^>]*>${en.meta_home_title}</title>`));
  expect(html).toContain(en.meta_home_description);

  const page = await (await browser.newContext({ javaScriptEnabled: false })).newPage();
  await page.goto("http://localhost:4173/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(en.hero_title!);
  await expect(page.getByRole("link", { name: en.hero_primary }).first()).toHaveAttribute("href", "/register");
});

test("Polish landing has its own static HTML under /pl", async ({ request }) => {
  const html = await (await request.get("/pl")).text();
  expect(html).toMatch(/<html\s+lang="pl"/);
  expect(html).toContain(pl.hero_lead);
  expect(html).toMatch(new RegExp(`<title[^>]*>${pl.meta_home_title}</title>`));
  const about = await (await request.get("/pl/about")).text();
  expect(about).toContain(pl.about_body);
});

test("sections, FAQ and CTA lead to sign-up; language switch keeps the page", async ({ page }) => {
  await page.goto("/");
  for (const title of [en.features_title, en.steps_title, en.faq_title]) {
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
  }
  await page.getByRole("button", { name: en.faq_1_q }).click();
  await expect(page.getByText(en.faq_1_a!)).toBeVisible();

  await page.getByRole("navigation", { name: en.language_label }).getByRole("link", { name: "PL" }).click();
  await expect(page).toHaveURL(/\/pl$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(pl.hero_title!);

  await page.getByRole("link", { name: pl.hero_primary }).first().click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByRole("heading", { name: pl.auth_register_title })).toBeVisible();
});

test("unknown URL shows the 404 page", async ({ page }) => {
  const res = await page.goto("/does-not-exist");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: en.notfound_title })).toBeVisible();
});
test("mobile width: no horizontal overflow (RN flex items must be allowed to shrink)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/", "/pl", "/about", "/login"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
