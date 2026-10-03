import { loadFont as loadNewsreader } from "@remotion/google-fonts/Newsreader";
import { loadFont as loadPublicSans } from "@remotion/google-fonts/PublicSans";

/**
 * The app's real UI primitives and design tokens (apps/app) for marketing material.
 * Change the look in apps/app/src/theme.ts — the video follows.
 */
export * from "@app/app/src/components/ui";
export * from "@app/app/src/theme";

// The typefaces named first in theme.ts `font`, so frames match the intended design rather than the fallback.
loadNewsreader("normal", { weights: ["400", "500", "600"], subsets: ["latin", "latin-ext"] });
loadPublicSans("normal", { weights: ["400", "600", "700"], subsets: ["latin", "latin-ext"] });
