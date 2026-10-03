/**
 * Twoje Miejsce design tokens (direction E · red #E50101).
 * SINGLE SOURCE OF TRUTH for every visual value in the React Native app.
 * Components and screens take values from here (via `../theme`) — never hardcode hex colors,
 * spacing, radii, font sizes or shadows.
 */

export const colors = {
  // Brand
  primary: "#E50101", // primary CTA, active elements, links, accent icons
  primaryPressed: "#B30000", // pressed state, text on primaryTint (contrast), destructive text
  primaryTint: "#FDECEC", // icon/avatar/badge background, success ring
  onPrimary: "#FFFFFF",

  // Text
  text: "#1B1B1F", // main text, headings, "dark" button
  textBody: "#3E3E46", // longer descriptions
  textSecondary: "#5E5E66", // captions, labels, helper text
  textMuted: "#8A8478", // placeholder tile numbering (decoration only)
  iconMuted: "#8A919C", // chevrons in list rows
  placeholder: "#8A8A92", // input placeholder

  // Backgrounds and surfaces
  background: "#F5F3EE", // screen background (warm off-white)
  surface: "#FFFFFF", // cards, fields, list rows, tab bar
  surfaceSunken: "#EAE7E0", // segmented control background, close button in sheet
  surfaceMuted: "#F0EEE9", // neutral avatars/badges (member)
  surfaceDisabled: "#FAF9F7", // empty code cells
  mapBase: "#ECE9E1", // map / photo placeholder

  // Borders
  border: "#DDD9CF", // fields, secondary buttons
  borderSubtle: "#E3E0D8", // icon buttons, tab bar top edge
  borderEmpty: "#E6E3DC", // empty code cells
  divider: "#EEEBE4", // separators inside cards/lists
  dashed: "#D3CEC2", // dashed frames, bottom sheet handle
  dot: "#B5B2AA", // dash in the ABC-DEF code

  // Dark mode (QR scanner only)
  scannerBg: "#17171A",
  scannerFrame: "#242428",
  scannerText: "#C8C8CC",
  scannerHint: "#707078",
  onDarkOverlay: "rgba(255,255,255,0.10)", // buttons on dark background
  onPrimaryOverlay: "rgba(255,255,255,0.18)", // icon on a red card

  // Layers
  scrim: "#5F646C", // backdrop under the bottom sheet (RN: rgba(27,27,31,0.55) or this color with opacity)
  focusRing: "rgba(229,1,1,0.10)", // field focus glow
  focusRingStrong: "rgba(229,1,1,0.12)", // code cell / selected card glow

  // Map decorations (illustrations on login and dashboard screens)
  mapPark: "#E4EBDD",
  mapWater: "#E4EAF3",
  mapRoad: "#E6E2D8",
  mapRoadMinor: "#ECE8DF",
} as const;

export const spacing = {
  0: 0,
  1: 2,
  2: 4,
  3: 6,
  4: 8,
  5: 10,
  6: 12,
  7: 14,
  8: 16,
  9: 20,
  10: 24, // horizontal screen margin
  11: 28, // gap between sections on form screens
  12: 32,
} as const;

export const layout = {
  screenPaddingX: 24,
  /** The design assumes 56 px from the top of the screen. In RN: insets.top + 12 (insets from react-native-safe-area-context). */
  screenTopOffset: 12,
  screenBottomPadding: 32,
  sectionGap: 28,
  minTouchTarget: 44,
  /** Outside the design (390 px mobile): content width on wide web screens. */
  contentMaxWidth: 560,
  /** Login screen: the brand row starts this far from the top edge (design y = 200). */
  loginContentTop: 200,
  /** Outside the design: a focused field stays this far above the keyboard, so the form's button below it
   * (gap 14 + buttonLg 54) is visible too. */
  keyboardBottomOffset: 84,
} as const;

export const radii = {
  xs: 6, // badge, chip
  sm: 10, // button on the map
  md: 12, // icon box, 46 px button, segment
  lg: 14, // fields, main buttons, back button
  xl: 16, // list rows, small cards
  "2xl": 18, // list groups, SelectableCard
  "3xl": 20, // dashboard cards, dashboard tiles
  "4xl": 22, // banner/hero, success card
  sheet: 28, // top corners of the bottom sheet
  pill: 999,
} as const;

export const sizes = {
  iconButton: 44,
  buttonLg: 54,
  buttonMd: 50,
  buttonSm: 46,
  buttonXs: 40,
  input: 52,
  otpCell: 64,
  avatarSm: 28,
  avatarMd: 36,
  avatarLg: 40,
  avatarXl: 44,
  iconBox: 44,
  iconBoxLg: 48,
  radioDot: 22,
  stepBarHeight: 4,
  tabIcon: 22,
  successMark: 64,
  scannerFrame: 268,
  /** Login screen: height of the map illustration at the top. */
  authMap: 300,
  /** Dashboard header: height of the map decoration. */
  dashboardMap: 230,
  /** Dashboard placeholder tiles: 128 high (two per row), 96 high for the full-width one. */
  placeholderTile: 128,
  placeholderTileWide: 96,
  /** Bottom sheet handle (40 × 5). */
  sheetHandleWidth: 40,
  sheetHandleHeight: 5,
  /** Dot under the active bottom-bar tab. */
  tabDot: 5,
  /** Dashboard: height of one grid row; a plugin widget spans 1-3 rows (WidgetSize.h). */
  widgetRow: 112,
} as const;

/** Font families (names from the @expo-google-fonts packages — see fonts.ts). One typeface everywhere. */
export const fontFamily = {
  // Schibsted Grotesk — text, headings, buttons, labels, codes
  regular: "SchibstedGrotesk_400Regular",
  medium: "SchibstedGrotesk_500Medium",
  semibold: "SchibstedGrotesk_600SemiBold",
  bold: "SchibstedGrotesk_700Bold",
} as const;

/**
 * Text styles. letterSpacing in RN is in px: em * fontSize.
 * Values derived from the design (e.g. -0.025em × 30 px = -0.75).
 */
export const typography = {
  // Headings
  titleXL: { fontFamily: fontFamily.bold, fontSize: 32, lineHeight: 35, letterSpacing: -0.8 }, // login
  title: { fontFamily: fontFamily.bold, fontSize: 30, lineHeight: 34, letterSpacing: -0.75 }, // screen title
  heading: { fontFamily: fontFamily.bold, fontSize: 28, lineHeight: 31, letterSpacing: -0.7 }, // place name, success screen
  headingM: { fontFamily: fontFamily.bold, fontSize: 26, lineHeight: 30, letterSpacing: -0.52 }, // hero, place preview
  headingS: { fontFamily: fontFamily.bold, fontSize: 24, lineHeight: 29, letterSpacing: -0.48 }, // bottom sheet, management
  brand: { fontFamily: fontFamily.bold, fontSize: 17, lineHeight: 22, letterSpacing: -0.17 }, // wordmark

  // Body copy
  bodyL: { fontFamily: fontFamily.regular, fontSize: 16, lineHeight: 24 }, // lead under a title
  body: { fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20 },
  captionRelaxed: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20.3 }, // descriptions in cards (1.45)
  small: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18 },
  tab: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 16 },
  tabActive: { fontFamily: fontFamily.semibold, fontSize: 12, lineHeight: 16 },

  // Interactive
  button: { fontFamily: fontFamily.semibold, fontSize: 16, lineHeight: 20 }, // main button
  buttonM: { fontFamily: fontFamily.semibold, fontSize: 15, lineHeight: 20 },
  buttonS: { fontFamily: fontFamily.semibold, fontSize: 14, lineHeight: 18 },
  input: { fontFamily: fontFamily.regular, fontSize: 16, lineHeight: 22 },
  link: { fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 20 },

  // Labels — always UPPERCASE (textTransform: 'uppercase'), tracked out
  label: { fontFamily: fontFamily.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 0.72 }, // 0.06em
  labelL: { fontFamily: fontFamily.semibold, fontSize: 13, lineHeight: 17, letterSpacing: 0.78 },
  labelHero: { fontFamily: fontFamily.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 0.96 }, // 0.08em on the red banner
  chip: { fontFamily: fontFamily.semibold, fontSize: 11, lineHeight: 15, letterSpacing: 0.55 }, // 0.05em
  stepNumber: { fontFamily: fontFamily.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 0.72 },
  abbr: { fontFamily: fontFamily.bold, fontSize: 16, lineHeight: 20, letterSpacing: 0 }, // place abbreviation (e.g. "OS")
  codeInline: { fontFamily: fontFamily.semibold, fontSize: 16, lineHeight: 20, letterSpacing: 1.28 }, // K7M-4QX in a row

  // Codes
  codeXL: { fontFamily: fontFamily.bold, fontSize: 28, lineHeight: 32, letterSpacing: 1.68 }, // "place created" screen
  codeM: { fontFamily: fontFamily.bold, fontSize: 22, lineHeight: 26, letterSpacing: 1.32 }, // management
  codeS: { fontFamily: fontFamily.bold, fontSize: 15, lineHeight: 20, letterSpacing: 0.9 }, // "Code, link or QR" row
  otp: { fontFamily: fontFamily.semibold, fontSize: 26, lineHeight: 30 }, // code cell
} as const;

/** Shadows: iOS (shadow*) + Android (elevation). Spread into StyleSheet: `...shadows.card`. */
export const shadows = {
  none: {},
  /** Default card / list row (0 1 2 rgba .06) */
  card: {
    shadowColor: "#1B1B1F",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  /** Dashboard / success card (0 1 2 + 0 8 24 rgba .05) */
  cardRaised: {
    shadowColor: "#1B1B1F",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  /** Selected card / row (red glow 0 6 18 .12) */
  selected: {
    shadowColor: "#E50101",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 9,
    elevation: 4,
  },
  /** Small floating button on the map / active segment (0 2 8 .12) */
  floating: {
    shadowColor: "#1B1B1F",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  /** Focus glow of a text field (COMPONENTS.md → TextField: 4 dp, primary at .10) */
  focusRing: {
    shadowColor: "#E50101",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 0,
  },
} as const;

export const borders = {
  hairline: 1,
  selected: 2, // selected card, focused field, active code cell
  row: 1.5, // place switcher row, dashed frames
} as const;

export const opacity = {
  pressed: 0.85,
  disabled: 0.45,
  onPrimarySubtitle: 0.9,
  /** Halo around the current-location pin on the login map illustration. */
  routeHalo: 0.18,
  /** Dimming behind a bottom sheet (COMPONENTS.md → BottomSheet: rgba(27,27,31,0.55)). */
  scrim: 0.55,
} as const;

export const motion = {
  fast: 120,
  base: 200,
  sheet: 280,
} as const;

export const theme = {
  colors,
  spacing,
  layout,
  radii,
  sizes,
  fontFamily,
  typography,
  shadows,
  borders,
  opacity,
  motion,
} as const;

export type Theme = typeof theme;
export type ColorToken = keyof typeof colors;
export type TypographyToken = keyof typeof typography;
