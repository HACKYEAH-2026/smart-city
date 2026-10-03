import type { ExpoConfig } from "expo/config";

/**
 * Jedyne źródło konfiguracji aplikacji. Projekty android/ i ios/ są GENEROWANE z tego pliku
 * (`expo prebuild`) i nie trafiają do repo.
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
  // Web: statyczny HTML dla każdej trasy (SEO), potem hydratacja.
  web: { output: "static", bundler: "metro" },
  plugins: ["expo-router", "expo-secure-store", "expo-localization"],
  experiments: { typedRoutes: true },
};

export default config;
