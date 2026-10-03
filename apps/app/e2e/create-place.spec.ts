import { t } from "../src/texts";
import { expect, register, test } from "./fixtures";

/**
 * Creating a place (designs E-NoweMiejsceTyp → Dane → Dostep → Gotowe): the kind, then the name, address and
 * description, then its features (the built-in plugins, all on by default), then who may join. The new place is
 * ready with its invite code and QR; its creator is its admin. Plugin names are server content, not app texts.
 */
const FEATURES = ["Zgłoszenia", "Ogłoszenia", "Dyskusje"];

test("creating a place: kind, details, who may join; the place is ready with its invite code", async ({ page }) => {
  await register(page, "creator@example.test");
  await page.getByRole("link", { name: t.place_create_own }).click();

  await expect(page.getByRole("heading", { name: t.create_kind_title, level: 1 })).toBeVisible();
  await expect(page.getByText(t.create_step_1)).toBeVisible();
  const next = page.getByRole("button", { name: t.create_next });
  await expect(next).toBeDisabled();
  await page.getByRole("radio", { name: t.place_kind_building }).click();
  await next.click();

  await expect(page.getByRole("heading", { name: t.create_details_title, level: 1 })).toBeVisible();
  await expect(next).toBeDisabled();
  await page.getByLabel(t.create_name).fill("Kamienica Lipowa 12");
  await page.getByLabel(t.create_address).fill("ul. Lipowa 12, Kraków");
  await page.getByLabel(t.create_description).fill("Ogłoszenia, awarie, zebrania.");
  await next.click();

  await expect(page.getByRole("heading", { name: t.create_features_title, level: 1 })).toBeVisible();
  await expect(page.getByText(t.create_step_3)).toBeVisible();
  for (const name of FEATURES) await expect(page.getByRole("checkbox", { name })).toBeChecked();
  await page.getByRole("checkbox", { name: "Dyskusje" }).click();
  await expect(page.getByRole("checkbox", { name: "Dyskusje" })).not.toBeChecked();
  await next.click();

  await expect(page.getByRole("heading", { name: t.create_access_title, level: 1 })).toBeVisible();
  await expect(page.getByRole("radio", { name: t.join_rule_approval })).toBeChecked();
  await page.getByRole("radio", { name: t.join_rule_open }).click();
  await expect(page.getByRole("radio", { name: t.join_rule_open })).toBeChecked();
  await page.getByRole("button", { name: t.create_submit }).click();

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Kamienica Lipowa 12");
  await expect(page.getByText(t.created_admin)).toBeVisible();
  await expect(page.getByText(/^[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{3}$/)).toBeVisible();
  await expect(page.getByRole("img", { name: t.invite_qr_label })).toBeVisible();
  await page.getByRole("button", { name: t.created_go_dashboard }).click();

  await expect(page.getByRole("heading", { name: "Kamienica Lipowa 12", level: 1 })).toBeVisible();
  await expect(
    page.getByRole("link", { name: `${t.dashboard_open}: Zgłoszenia i sugestie`, exact: true }),
  ).toBeVisible();
  // No announcement yet, so no tile: the place's other features lead to them.
  await expect(page.getByRole("link", { name: "Ogłoszenia", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Dyskusje", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Kamienica Lipowa 12" }).click();
  await expect(page.getByRole("dialog").getByText(t.place_kind_building)).toBeVisible();
});

test("the place's location: found by address, confirmed on the map, then shown on the map of places", async ({
  page,
}) => {
  await register(page, "located@example.test");
  await page.getByRole("link", { name: t.place_create_own }).click();
  await page.getByRole("radio", { name: t.place_kind_building }).click();
  const next = page.getByRole("button", { name: t.create_next });
  await next.click();
  await page.getByLabel(t.create_name).fill("Kamienica Floriańska 15");
  await page.getByRole("button", { name: t.create_location_pick }).click();

  // The test API answers address searches with fixed Kraków addresses (apps/api/src/test-geocoder.ts).
  const search = page.getByLabel(t.location_search);
  await search.fill("Floriańska 15");
  await search.press("Enter");
  await page
    .getByRole("list", { name: t.location_results })
    .getByRole("button", { name: /Floriańska 15/ })
    .click();
  await expect(page.getByText("Floriańska 15, 31-019 Kraków")).toBeVisible();
  await expect(page.getByText(`Kamienica Floriańska 15 · ${t.location_pin_hint}`)).toBeVisible();
  await page.getByRole("button", { name: t.location_confirm }).click();

  await expect(page.getByRole("heading", { name: t.create_details_title, level: 1 })).toBeVisible();
  await expect(page.getByLabel(t.create_address)).toHaveValue("Floriańska 15, 31-019 Kraków");
  await expect(page.getByRole("button", { name: t.create_location_change })).toBeVisible();
  await next.click();
  await next.click();
  const onMap = page.getByRole("switch", { name: t.create_on_map });
  await expect(onMap).toHaveAttribute("aria-checked", "false");
  await onMap.click();
  await expect(onMap).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: t.create_submit }).click();
  await page.getByRole("button", { name: t.created_go_dashboard }).click();

  await page.getByRole("link", { name: t.tab_map }).click();
  await expect(page.getByRole("heading", { name: t.map_title, level: 1 })).toBeVisible();
  await page
    .getByRole("list", { name: t.map_list_label })
    .getByRole("button", { name: /Kamienica Floriańska 15/ })
    .click();
  const card = page.getByRole("region", { name: "Kamienica Floriańska 15" });
  await expect(card.getByText("Floriańska 15, 31-019 Kraków")).toBeVisible();
  await card.getByRole("button", { name: t.map_open_place }).click();
  await expect(page.getByRole("heading", { name: "Kamienica Floriańska 15", level: 1 })).toBeVisible();
});

test("without a location a place has no map switch", async ({ page }) => {
  await register(page, "nolocation@example.test");
  await page.getByRole("link", { name: t.place_create_own }).click();
  await page.getByRole("radio", { name: t.place_kind_estate }).click();
  const next = page.getByRole("button", { name: t.create_next });
  await next.click();
  await page.getByLabel(t.create_name).fill("Osiedle Słoneczne");
  await next.click();
  await next.click();
  await expect(page.getByRole("heading", { name: t.create_access_title, level: 1 })).toBeVisible();
  await expect(page.getByRole("switch", { name: t.create_on_map })).toHaveCount(0);
});

test("going back a step keeps the answers", async ({ page }) => {
  await register(page, "back@example.test");
  await page.getByRole("link", { name: t.place_create_own }).click();
  await page.getByRole("radio", { name: t.place_kind_estate }).click();
  await page.getByRole("button", { name: t.create_next }).click();
  await page.getByLabel(t.create_name).fill("Osiedle Słoneczne");
  await page.getByRole("button", { name: t.back }).click();
  await expect(page.getByRole("radio", { name: t.place_kind_estate })).toBeChecked();
  await page.getByRole("button", { name: t.create_next }).click();
  await expect(page.getByLabel(t.create_name)).toHaveValue("Osiedle Słoneczne");
});

test("a place needs at least one feature", async ({ page }) => {
  await register(page, "features@example.test");
  await page.getByRole("link", { name: t.place_create_own }).click();
  await page.getByRole("radio", { name: t.place_kind_estate }).click();
  const next = page.getByRole("button", { name: t.create_next });
  await next.click();
  await page.getByLabel(t.create_name).fill("Osiedle Słoneczne");
  await next.click();
  for (const name of FEATURES) await page.getByRole("checkbox", { name }).click();
  await expect(next).toBeDisabled();
  await page.getByRole("checkbox", { name: "Ogłoszenia" }).click();
  await expect(next).toBeEnabled();
});

test("cancelling on the first step goes back to the dashboard", async ({ page }) => {
  await register(page, "cancel@example.test");
  await page.getByRole("link", { name: t.place_create_own }).click();
  await page.getByRole("button", { name: t.create_cancel }).click();
  await expect(page.getByRole("heading", { name: t.dashboard_empty_title })).toBeVisible();
});
