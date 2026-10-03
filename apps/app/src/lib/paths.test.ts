import { describe, expect, mock, test } from "bun:test";

// i18n.tsx importuje moduły natywne Expo; w teście liczy się tylko czysta logika ścieżek.
mock.module("expo-localization", () => ({ getLocales: () => [] }));
mock.module("expo-router", () => ({ usePathname: () => "/", useRouter: () => ({}) }));
mock.module("expo-secure-store", () => ({}));
mock.module("react-native", () => ({ Platform: { OS: "web" } }));

const { isMarketing, localeFromPath, localizedPath, stripLocale } = await import("./i18n");

describe("ścieżki językowe", () => {
  test("localeFromPath rozpoznaje tylko prefiks języka innego niż bazowy", () => {
    expect(localeFromPath("/pl")).toBe("pl");
    expect(localeFromPath("/pl/about")).toBe("pl");
    expect(localeFromPath("/about")).toBeNull();
    expect(localeFromPath("/en/about")).toBeNull();
    expect(localeFromPath("/plan")).toBeNull();
  });

  test("stripLocale i localizedPath są odwrotne", () => {
    expect(stripLocale("/pl/about")).toBe("/about");
    expect(stripLocale("/pl")).toBe("/");
    expect(localizedPath("/", "pl")).toBe("/pl");
    expect(localizedPath("/about", "pl")).toBe("/pl/about");
    expect(localizedPath("/about", "en")).toBe("/about");
  });

  test("isMarketing: tylko strony marketingowe mają język w URL", () => {
    expect(isMarketing("/")).toBe(true);
    expect(isMarketing("/pl/about")).toBe(true);
    expect(isMarketing("/app")).toBe(false);
    expect(isMarketing("/login")).toBe(false);
  });
});
