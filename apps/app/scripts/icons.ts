/**
 * Renders the app icons from the brand mark (src/theme/brand.ts) into assets/:
 *  - icon.png: iOS app icon (full-bleed red square; the system rounds the corners),
 *  - adaptive-icon.png: Android adaptive icon foreground, also its monochrome (themed icon) layer;
 *    the red background comes from app.config.ts,
 *  - favicon.png: web favicon source (expo export turns it into favicon.ico).
 * Run after changing the mark: bun scripts/icons.ts (rasterized by Playwright's Chromium, as in E2E).
 */
import { join } from "node:path";
import { type Browser, chromium } from "@playwright/test";
import { brandMark } from "../src/theme/brand";
import { colors } from "../src/theme/tokens";

type Background = "none" | "square" | "rounded";
type AppIcon = {
  file: string;
  size: number;
  background: Background;
  /** Width of the mark's 48-unit grid as a share of the canvas. */
  mark: number;
};

const ICONS: AppIcon[] = [
  { file: "icon.png", size: 1024, background: "square", mark: 0.62 },
  // Android crops the foreground to a 66% safe circle: the mark stays inside it at half the canvas.
  { file: "adaptive-icon.png", size: 1024, background: "none", mark: 0.5 },
  { file: "favicon.png", size: 192, background: "rounded", mark: 0.62 },
];

const assets = join(import.meta.dir, "..", "assets");

/** Corner radius of the rounded favicon, as a share of its size (same as the app icon mask on iOS). */
const ROUNDED_CORNER = 0.225;

function backgroundSvg(size: number, background: Background): string {
  const radius = background === "rounded" ? size * ROUNDED_CORNER : 0;
  return background === "none"
    ? ""
    : `<rect width="${size}" height="${size}" rx="${radius}" fill="${colors.primary}"/>`;
}

function iconSvg({ size, background, mark }: AppIcon): string {
  const markSize = size * mark;
  const offset = (size - markSize) / 2;
  const { roofs, strokeWidth, dot, viewBox } = brandMark;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    ${backgroundSvg(size, background)}
    <svg x="${offset}" y="${offset}" width="${markSize}" height="${markSize}" viewBox="${viewBox}">
      <path d="${roofs}" fill="none" stroke="${colors.onPrimary}" stroke-width="${strokeWidth}"/>
      <circle cx="${dot.cx}" cy="${dot.cy}" r="${dot.r}" fill="${colors.onPrimary}"/>
    </svg>
  </svg>`;
}

async function render(browser: Browser, icon: AppIcon): Promise<string> {
  const page = await browser.newPage({ viewport: { width: icon.size, height: icon.size } });
  await page.setContent(`<body style="margin:0">${iconSvg(icon)}</body>`);
  const path = join(assets, icon.file);
  await page.screenshot({ path, omitBackground: true, clip: { x: 0, y: 0, width: icon.size, height: icon.size } });
  return `${icon.file} (${icon.size}×${icon.size})`;
}

const browser = await chromium.launch();
const written = await Promise.all(ICONS.map((icon) => render(browser, icon)));
await browser.close();
console.log(`icons: ${written.join(", ")}`);
