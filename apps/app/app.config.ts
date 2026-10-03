import type { ExpoConfig } from "expo/config";

/**
 * Jedyne źródło konfiguracji aplikacji. Projekty android/ i ios/ są GENEROWANE z tego pliku
 * (`expo prebuild`) i nie trafiają do repo. Nowa aplikacja: zmień name/slug/scheme/identyfikatory.
 */
const config: ExpoConfig = {
  name: "Notebook",
  slug: "notebook",
  scheme: "notebook",
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "light",
  android: { package: "com.example.notebook" },
  ios: { bundleIdentifier: "com.example.notebook", supportsTablet: true },
  // Web: statyczny HTML dla każdej trasy (SEO), potem hydratacja. Hosting: Cloudflare Workers Static Assets.
  web: { output: "static", bundler: "metro" },
  plugins: ["expo-router", "expo-secure-store", "expo-localization"],
  experiments: { typedRoutes: true },
};

export default config;
