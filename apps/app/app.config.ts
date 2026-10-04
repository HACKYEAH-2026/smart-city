import { existsSync } from 'node:fs';
import type { ExpoConfig } from 'expo/config';

/**
 * Push notifications (expo-notifications + Expo Push Service) need two things from outside the repo:
 *  - EXPO_PROJECT_ID: the Expo project id (expo.dev); without it the app does not ask for a push token,
 *  - Android: google-services.json of the Firebase project (FCM). Path in GOOGLE_SERVICES_JSON, or the file
 *    apps/app/google-services.json (gitignored). Without it the build works, but Android gets no push token.
 */
const projectId = process.env.EXPO_PROJECT_ID;
const googleServicesFile =
  process.env.GOOGLE_SERVICES_JSON ??
  (existsSync('./google-services.json') ? './google-services.json' : undefined);

/**
 * Google sign-in (@react-native-google-signin/google-signin): the app gets the client IDs from the API at runtime
 * (GET /api/auth-providers). Android needs nothing here: Google recognizes the app by its package name and the
 * signing key's SHA-1, registered in the project's "Android" OAuth client. iOS needs the "iOS" client's reversed
 * ID as a URL scheme at build time: GOOGLE_IOS_CLIENT_ID (the same value the API has). Without it the iOS build
 * works, but has no Google sign-in.
 */
const googleIosClientId = process.env.GOOGLE_IOS_CLIENT_ID;
const googleSignIn: NonNullable<ExpoConfig['plugins']> = googleIosClientId
  ? [
      [
        '@react-native-google-signin/google-signin',
        {
          iosUrlScheme: `com.googleusercontent.apps.${googleIosClientId.replace('.apps.googleusercontent.com', '')}`,
        },
      ],
    ]
  : [];

/**
 * Single source of app configuration. The android/ and ios/ projects are GENERATED from this file
 * (`expo prebuild`) and are not committed.
 */
const config: ExpoConfig = {
  name: 'Twoje Miejsce',
  slug: 'twoje-miejsce',
  scheme: 'twojemiejsce',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  // App icons: rendered from the brand mark (src/theme/brand.ts) by scripts/icons.ts.
  icon: './assets/icon.png',
  android: {
    package: 'pl.twojemiejsce.app',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      monochromeImage: './assets/adaptive-icon.png',
      // colors.primary (src/theme/tokens.ts): Expo's config loader cannot import the app's TS modules.
      backgroundColor: '#D81B60',
    },
    ...(googleServicesFile ? { googleServicesFile } : {}),
  },
  ios: { bundleIdentifier: 'pl.twojemiejsce.app', supportsTablet: true },
  // Web: static HTML for every route (SEO), then hydration.
  web: { output: 'static', bundler: 'metro', favicon: './assets/favicon.png' },
  plugins: [
    'expo-router',
    'expo-secure-store',
    // iOS system permission prompt: user-visible text, so Polish (AGENTS.md: Language).
    [
      'expo-image-picker',
      {
        photosPermission:
          'Aplikacja potrzebuje dostępu do zdjęć, aby dodać zdjęcie.',
        cameraPermission:
          'Aplikacja potrzebuje aparatu, aby zrobić zdjęcie zgłoszenia.',
      },
    ],
    // iOS system permission prompt: user-visible text, so Polish (AGENTS.md: Language).
    [
      'expo-camera',
      {
        cameraPermission:
          'Aplikacja potrzebuje aparatu, aby odczytać kod QR miejsca.',
      },
    ],
    'expo-notifications',
    // System permission prompt (iOS text; Android adds the location permissions): Polish (AGENTS.md: Language).
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Aplikacja potrzebuje lokalizacji, aby pokazać Twoje położenie na mapie.',
      },
    ],
    ...googleSignIn,
  ],
  experiments: { typedRoutes: true },
  ...(projectId ? { extra: { eas: { projectId } } } : {}),
};

export default config;
