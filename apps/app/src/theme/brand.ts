/**
 * The brand mark "Roofline M": two gables draw the M of "Miejsce", the dot between the houses is "you".
 * SINGLE SOURCE of its geometry (48-unit grid): `BrandMark` draws it in the app and `scripts/icons.ts`
 * renders the app icon and the favicon from it.
 */
export const brandMark = {
  viewBox: "0 0 48 48",
  /** The roofs: a stroked path with mitred (sharp) peaks. */
  roofs: "M7 41V19.5L15.5 11L24 19.5L32.5 11L41 19.5V41",
  strokeWidth: 5,
  dot: { cx: 24, cy: 34, r: 4 },
} as const;
