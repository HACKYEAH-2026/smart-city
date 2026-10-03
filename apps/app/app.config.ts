import type { ExpoConfig } from "expo/config";

/**
 * Single source of app configuration. The android/ and ios/ projects are GENERATED from this file
 * (`expo prebuild`) and are not committed.
 */
const config: ExpoConfig = {
  name: "Twoje Miejsce",
  slug: "twoje-miejsce",
  scheme: "twojemiejsce",
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "light",
  android: { package: "pl.twojemiejsce.app" },
  ios: { bundleIdentifier: "pl.twojemiejsce.app", supportsTablet: true },
  // Web: static HTML for every route (SEO), then hydration.
  web: { output: "static", bundler: "metro" },
  plugins: [
    "expo-router",
    "expo-secure-store",
    // iOS system permission prompt: user-visible text, so Polish (AGENTS.md: Language).
    [
      "expo-image-picker",
      {
        photosPermission: "Aplikacja potrzebuje dostępu do zdjęć, aby dodać zdjęcie.",
      },
    ],
  ],
  experiments: { typedRoutes: true },
};

export default config;
