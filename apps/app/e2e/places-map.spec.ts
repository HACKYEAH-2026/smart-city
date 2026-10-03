import { t } from "../src/texts";
import { expect, test } from "./fixtures";

/**
 * The map of places (bottom bar → "Mapa"): places their admins show on the map, for every signed-in user, and the
 * user's own places. The list under the map is the same set as the pins (and what E2E can select: the pins are
 * drawn on a canvas). The demo place "Kraków" (test-routes.ts seedDemo) is on the map, at the city hall.
 */
test("a public place on the map: its card with address; a non-member learns how to join", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel(t.auth_email).fill("explorer@example.test");
  await page.getByLabel(t.auth_password).fill("password123");
  await page.getByRole("checkbox", { name: t.auth_consent }).click();
  await page.getByRole("button", { name: t.auth_submit_register }).click();
  await expect(page.getByRole("heading", { name: t.dashboard_empty_title })).toBeVisible();

  // Without places there is no bottom bar (design E-BrakMiejsc): the map is one of the ways to find a place.
  await page.getByRole("link", { name: new RegExp(t.join_map) }).click();
  await expect(page.getByRole("heading", { name: t.map_title, level: 1 })).toBeVisible();
  const list = page.getByRole("list", { name: t.map_list_label });
  await list.getByRole("button", { name: /Kraków/ }).click();

  const card = page.getByRole("region", { name: "Kraków" });
  await expect(card.getByText("pl. Wszystkich Świętych 3-4, 31-004 Kraków")).toBeVisible();
  await expect(card.getByText(t.place_kind_district)).toBeVisible();
  await expect(card.getByText(t.map_join_hint)).toBeVisible();
  await expect(card.getByRole("button", { name: t.map_open_place })).toHaveCount(0);
  await card.getByRole("button", { name: t.close }).click();
  await expect(list).toBeVisible();
});
