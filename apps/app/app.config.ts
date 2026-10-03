import { existsSync } from "node:fs";
import type { ExpoConfig } from "expo/config";

/**
 * Push notifications (expo-notifications + Expo Push Service) need two things from outside the repo:
 *  - EXPO_PROJECT_ID: the Expo project id (expo.dev); without it the app does not ask for a push token,
 *  - Android: google-services.json of the Firebase project (FCM). Path in GOOGLE_SERVICES_JSON, or the file
 *    apps/app/google-services.json (gitignored). Without it the build works, but Android gets no push token.
 */
const projectId = process.env.EXPO_PROJECT_ID;
const googleServicesFile =
  process.env.GOOGLE_SERVICES_JSON ?? (existsSync("./google-services.json") ? "./google-services.json" : undefined);

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
  android: { package: "pl.twojemiejsce.app", ...(googleServicesFile ? { googleServicesFile } : {}) },
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
    "expo-notifications",
  ],
  experiments: { typedRoutes: true },
  ...(projectId ? { extra: { eas: { projectId } } } : {}),
};

export default config;
