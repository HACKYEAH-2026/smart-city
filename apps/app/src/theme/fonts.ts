/**
 * Font loading (Expo). Family names must match `fontFamily` in tokens.ts.
 *
 * Usage in app/_layout.tsx:
 *   const [loaded] = useAppFonts();
 *   if (!loaded) return null;
 */

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
import { useFonts } from "expo-font";

export function useAppFonts() {
  return useFonts({
    SchibstedGrotesk_400Regular,
    SchibstedGrotesk_500Medium,
    SchibstedGrotesk_600SemiBold,
    SchibstedGrotesk_700Bold,
    BarlowCondensed_500Medium,
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
  });
}
