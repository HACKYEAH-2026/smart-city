import {
  BarlowCondensed_500Medium,
  BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold,
} from "@expo-google-fonts/barlow-condensed";
import {
  SchibstedGrotesk_400Regular,
  SchibstedGrotesk_500Medium,
  SchibstedGrotesk_600SemiBold,
  SchibstedGrotesk_700Bold,
} from "@expo-google-fonts/schibsted-grotesk";
import { continueRender, delayRender } from "remotion";

/**
 * The app's real design-system components and tokens (apps/app/src) for marketing material.
 * Change the look in apps/app/src/theme/tokens.ts — the video follows.
 */
export * from "@app/app/src/components";
export * from "@app/app/src/theme";

// The same font files and family names as apps/app/src/theme/fonts.ts (tokens refer to e.g. "SchibstedGrotesk_700Bold").
// Typed as RN asset ids; in the webpack bundle they are URLs.
const families: Record<string, unknown> = {
  SchibstedGrotesk_400Regular,
  SchibstedGrotesk_500Medium,
  SchibstedGrotesk_600SemiBold,
  SchibstedGrotesk_700Bold,
  BarlowCondensed_500Medium,
  BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold,
};

const loadFamily = ([name, url]: [string, unknown]) =>
  new FontFace(name, `url(${String(url)})`).load().then((face) => document.fonts.add(face));

const fontsReady = delayRender("Loading design-system fonts");
Promise.all(Object.entries(families).map(loadFamily)).then(() => continueRender(fontsReady));
