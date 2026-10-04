import { t } from "../src/texts";
import { expect, register, seedResident, test } from "./fixtures";

/**
 * The map of places (bottom bar → "Mapa"): places their admins show on the map, for every signed-in user, and the
 * user's own places. The list under the map is the same set as the pins (and what E2E can select: the pins are
 * drawn on a canvas). The demo place "Kraków" (test-routes.ts seedDemo) is on the map, at the city hall, open to anyone.
 * A non-member joins an open place from its card, through the same preview as a scanned code.
 */
test("a public open place on the map: its card with address; a non-member joins it from there", async ({ page }) => {
  await register(page, "explorer@example.test");

  // Without places there is no bottom bar (design E-BrakMiejsc): the map is one of the ways to find a place.
  await page.getByRole("link", { name: new RegExp(t.join_map) }).click();
  await expect(page.getByRole("heading", { name: t.map_title, level: 1 })).toBeVisible();
  const list = page.getByRole("list", { name: t.map_list_label });
  await list.getByRole("button", { name: /Kraków/ }).click();

  const card = page.getByRole("region", { name: "Kraków" });
  await expect(card.getByText("pl. Wszystkich Świętych 3-4, 31-004 Kraków")).toBeVisible();
  await expect(card.getByText(t.place_kind_district)).toBeVisible();
  await expect(card.getByText(t.map_join_hint)).toHaveCount(0);
  await expect(card.getByRole("button", { name: t.map_open_place })).toHaveCount(0);
  await card.getByRole("button", { name: t.close }).click();
  await expect(list).toBeVisible();

  await list.getByRole("button", { name: /Kraków/ }).click();
  await card.getByRole("button", { name: t.map_join_place }).click();
  await expect(page.getByRole("heading", { name: "Kraków", level: 1 })).toBeVisible();
  await expect(page.getByText("KRK-MST")).toBeVisible();
  await page.getByRole("button", { name: t.place_preview_join }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("heading", { name: "Kraków", level: 1 })).toBeVisible();
});

test("the seeded campus and cooperative are on the map, open to anyone", async ({ page, api }) => {
  await seedResident(api.url);
  await register(page, "student@example.test");
  await page.getByRole("link", { name: new RegExp(t.join_map) }).click();
  const list = page.getByRole("list", { name: t.map_list_label });
  await expect(list.getByRole("button", { name: /Kampus Główny/ })).toBeVisible();
  await list.getByRole("button", { name: /Spółdzielnia Słoneczna/ }).click();

  await page
    .getByRole("region", { name: "Spółdzielnia Słoneczna" })
    .getByRole("button", { name: t.map_join_place })
    .click();
  await page.getByRole("button", { name: t.place_preview_join }).click();
  await expect(page.getByRole("heading", { name: "Spółdzielnia Słoneczna", level: 1 })).toBeVisible();
});
