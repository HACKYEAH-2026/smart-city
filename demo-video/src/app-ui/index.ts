import { loadFont as loadBarlowCondensed } from "@remotion/google-fonts/BarlowCondensed";
import { loadFont as loadSchibstedGrotesk } from "@remotion/google-fonts/SchibstedGrotesk";

/**
 * The app's real design-system components and tokens (apps/app/src) for marketing material.
 * Change the look in apps/app/src/theme/tokens.ts — the video follows.
 */
export * from "@app/app/src/components";
export * from "@app/app/src/theme";

// The typefaces of the design system (apps/app/src/theme/fonts.ts), so frames match the intended design.
loadSchibstedGrotesk("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin", "latin-ext"] });
loadBarlowCondensed("normal", { weights: ["500", "600", "700"], subsets: ["latin", "latin-ext"] });
