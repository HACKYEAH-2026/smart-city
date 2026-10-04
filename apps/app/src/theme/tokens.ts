/**
 * Twoje Miejsce design tokens (direction E · red #E50101).
 * SINGLE SOURCE OF TRUTH for every visual value in the React Native app.
 * Components and screens take values from here (via `../theme`) — never hardcode hex colors,
 * spacing, radii, font sizes or shadows.
 */

export const colors = {
  // Brand
  primary: '#E50101', // primary CTA, active elements, links, accent icons
  primaryPressed: '#B30000', // pressed state, text on primaryTint (contrast), destructive text
  primaryTint: '#FDECEC', // icon/avatar/badge background, success ring
  primaryTintPressed: '#FAD9D9', // pressed state of an accent button on primaryTint (outside the design)
  // Status tags on list cards: a tint for the background and a deep tone for the text (contrast on the tint).
  neutralTint: '#ECEAE5',
  neutralText: '#3E3E46',
  infoTint: '#E8EEF8',
  infoText: '#1F4E8C',
  warningTint: '#FFF1D6',
  warningText: '#7A4F00',
  successTint: '#E3F1E6',
  successText: '#1E6B34',
  onPrimary: '#FFFFFF',

  // Text
  text: '#1B1B1F', // main text, headings, "dark" button
  textBody: '#3E3E46', // longer descriptions
  textSecondary: '#5E5E66', // captions, labels, helper text
  iconMuted: '#8A919C', // chevrons in list rows
  placeholder: '#8A8A92', // input placeholder

  // Backgrounds and surfaces
  background: '#F5F3EE', // screen background (warm off-white)
  surface: '#FFFFFF', // cards, fields, list rows, tab bar
  surfaceSunken: '#EAE7E0', // segmented control background, close button in sheet
  surfaceMuted: '#F0EEE9', // neutral avatars/badges (member)
  surfaceDisabled: '#FAF9F7', // empty code cells
  mapBase: '#ECE9E1', // map / photo placeholder

  // Borders
  border: '#DDD9CF', // fields, secondary buttons
  borderSubtle: '#E3E0D8', // icon buttons, tab bar top edge
  borderEmpty: '#E6E3DC', // empty code cells
  divider: '#EEEBE4', // separators inside cards/lists
  dashed: '#D3CEC2', // dashed frames, bottom sheet handle
  dashedStrong: '#B9B4A9', // dashed "Dodaj widżet" tile on the sunken grid of the layout editor
  dot: '#B5B2AA', // dash in the ABC-DEF code

  // Dark mode (QR scanner only)
  scannerBg: '#17171A',
  scannerText: '#C8C8CC',
  scannerHint: '#707078',
  onDarkOverlay: 'rgba(255,255,255,0.10)', // buttons on dark background
  onPrimaryOverlay: 'rgba(255,255,255,0.18)', // icon on a red card

  // Layers
  scrim: '#5F646C', // backdrop under the bottom sheet (RN: rgba(27,27,31,0.55) or this color with opacity)
  focusRing: 'rgba(229,1,1,0.10)', // field focus glow
  focusRingStrong: 'rgba(229,1,1,0.12)', // code cell / selected card glow

  // Map decorations (illustrations on login and dashboard screens)
  mapPark: '#E4EBDD',
  mapWater: '#E4EAF3',
  mapRoad: '#E6E2D8',
  mapRoadMinor: '#ECE8DF',
  // Live maps (OpenFreeMap base recoloured to the tokens above, src/lib/map/spec.ts)
  mapBuilding: '#E3DFD5', // buildings, a shade darker than mapBase
  mapMe: '#3D6AE0', // the user's own position (blue dot with a halo)
  // What plugin maps mean by a tone (ui.map: pins, routes, areas). The app's UI shows only danger in colour, but on a
  // map colour is how layers tell apart; danger is the brand red, and info stays clear of the blue "me" dot.
  mapNeutral: '#5E5E66',
  mapInfo: '#1F6FA8',
  mapSuccess: '#2E7D32',
  mapWarning: '#C26A00',

  // Google "G" on the Google sign-in button: Google's own colors (its branding guidelines forbid changing the logo)
  googleBlue: '#4285F4',
  googleGreen: '#34A853',
  googleYellow: '#FBBC05',
  googleRed: '#EA4335',
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
  /** Red hero banner: inner padding (design 22, off the spacing scale). */
  heroPadding: 22,
  /** A plugin's card in the catalog: inner padding (design 18, off the spacing scale). */
  pluginCardPadding: 18,
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
  '2xl': 18, // list groups, SelectableCard
  '3xl': 20, // dashboard cards, dashboard tiles
  '4xl': 22, // banner/hero, success card, the layout editor's grid
  panel: 24, // top corners of a non-modal panel at the bottom of a screen (layout editor)
  mini: 8, // tiles of the dashboard layout preview
  outline: 3, // the outline rectangle of a widget size choice ("3 × 2")
  sheet: 28, // top corners of the bottom sheet
  pill: 999,
} as const;

export const sizes = {
  iconButton: 44,
  buttonLg: 54,
  /** A square icon button beside a field or a main button (its height matches the button). */
  squareButton: 54,
  buttonMd: 50,
  buttonSm: 46,
  buttonXs: 40,
  /** "Dodaj do miejsca" on a plugin's catalog card (design 44; a `sm` button made lower). */
  buttonPluginAdd: 44,
  input: 52,
  /** A search field above a list (design "Dodaj rozszerzenie": 50). */
  inputS: 50,
  otpCell: 64,
  avatarSm: 28,
  avatarMd: 36,
  avatarLg: 40,
  avatarXl: 44,
  /** Icon boxes: 40 in list rows and choice cards, 44 by default, 48 in empty states, 52 on a plugin's catalog card. */
  iconBoxSm: 40,
  /** The signed-in user's initials at the top of the account. */
  avatarProfile: 64,
  iconBox: 44,
  iconBoxLg: 48,
  iconBoxXl: 52,
  radioDot: 22,
  stepBarHeight: 4,
  tabIcon: 22,
  /** The icon in an IconButton (20). */
  iconM: 20,
  /** Small icons: chevrons in list rows and icons inside buttons (18), the check in the active-place mark (14). */
  iconS: 18,
  iconXs: 14,
  /** Red circle with a check on the active row of the place switcher. */
  selectedMark: 24,
  /** The logo mark ("Roofline M") next to the wordmark. */
  brandMark: 24,
  /** Red hero banner (no-places screen): minimum height, text sits at the bottom. */
  heroBanner: 172,
  successMark: 64,
  /** Success mark: the light ring around the 64 dp circle (8 dp wide) and its check. */
  successRing: 80,
  successIcon: 30,
  /** "Jesteś administratorem" pill. */
  statusPill: 30,
  /** QR code on the invite card ("place created"). */
  qrCard: 104,
  /** Choice cards in a two-column grid (kind of place): minimum height. */
  selectableCard: 128,
  /** A choice chip (categories in a form). */
  chipHeight: 38,
  /** A choice button in a form (two options side by side). */
  choiceButton: 52,
  /** Plugin forms: a photo tile (square, design "Dodaj") and the remove button on a chosen photo. */
  photoTile: 84,
  photoRemove: 26,
  photoRemoveIcon: 12,
  /** Text under the success mark of a plugin view: keeps long lines short. */
  heroTextWidth: 300,
  scannerFrame: 268,
  /** QR scanner frame: corner length and the frame's corner radius (design: 52 and 32). */
  scannerCorner: 52,
  scannerRadius: 32,
  /** Text under the scanner frame: max width. */
  scannerHint: 280,
  /** Login screen: height of the map illustration at the top. */
  authMap: 300,
  /** Dashboard header: height of the map decoration. */
  dashboardMap: 330,
  /** Dashboard header: the map fades into the screen over this height at its lower edge. */
  dashboardMapFade: 160,
  /** Dashboard header: the map is this much taller than its frame, so its bottom strip (the attribution icon) is cut off. */
  dashboardMapCrop: 48,
  /** Dashboard header: the tip of the place's pin, this far below the top of the content (beside the place's name). */
  dashboardPinTop: 154,
  /** Dashboard header: the place's pin across the screen, a fraction of its width (between the name and the gear). */
  dashboardPinX: 0.64,
  /** Dashboard header: the backdrop (map and pin) moves up this much, so the pin lines up with the header. */
  dashboardMapLift: 16,
  /** Dashboard header: scrolling this far (dp) blurs the backdrop fully; it starts blurring at the first scroll. */
  dashboardBlurRange: 200,
  /** Icon inside the dashboard's empty-state card (48 dp box). */
  emptyIcon: 24,
  /** Bottom sheet handle (40 × 5). */
  sheetHandleWidth: 40,
  sheetHandleHeight: 5,
  /** Dot under the active bottom-bar tab. */
  tabDot: 5,
  /** Dot by an unread notification in the account. */
  unreadDot: 8,
  /** The still map with a place's pin in the "new place" wizard. */
  locationPreview: 140,
  /** A map in a plugin's view; in a dashboard widget it is a still preview of `locationPreview`. */
  pluginMap: 260,
  /** The colour mark of a plugin map's layer or item in its legend and list (a route's mark is a wider line). */
  mapSwatch: 12,
  mapSwatchRoute: 18,
  /** The map of places: the panel under the map (list or a place's card) at most this tall. */
  mapPanel: 340,
  /** Dashboard: height of one grid row; a plugin widget spans 1-3 rows (WidgetSize.h). */
  widgetRow: 112,
  /** Dashboard layout (design "Układ pulpitu"): a grid row in the editor and in the preview on "Zarządzaj miejscem". */
  layoutRow: 64,
  layoutPreviewRow: 22,
  /** Layout editor: one grid cell in a size choice's outline icon (a 3 × 2 widget draws 21 × 14). */
  layoutSizeUnit: 7,
  /** Layout editor: a size choice ("3 × 2"). */
  layoutSizeOption: 48,
  /** A small pill button in a list row ("Dodaj" in the "Dodaj widżet" sheet). */
  pillButton: 38,
  /** A list card's counter (votes): its width and minimum height. */
  voteWidth: 48,
  voteHeight: 64,
  /** A tag (badge) on a list card: its height, and the dot in a status tag. */
  tagHeight: 24,
  tagDot: 6,
  /** The floating button over a screen. */
  fab: 56,
  highlightThumb: 64,
  /** An action row in a bottom sheet (design "Opcje członka": 56). */
  sheetAction: 56,
} as const;

/** Font families (names from the @expo-google-fonts packages — see fonts.ts). One typeface everywhere. */
export const fontFamily = {
  // Schibsted Grotesk — text, headings, buttons, labels, codes
  regular: 'SchibstedGrotesk_400Regular',
  medium: 'SchibstedGrotesk_500Medium',
  semibold: 'SchibstedGrotesk_600SemiBold',
  bold: 'SchibstedGrotesk_700Bold',
} as const;

/**
 * Text styles. letterSpacing in RN is in px: em * fontSize.
 * Values derived from the design (e.g. -0.025em × 30 px = -0.75).
 */
export const typography = {
  // Headings
  titleXL: {
    fontFamily: fontFamily.bold,
    fontSize: 32,
    lineHeight: 35,
    letterSpacing: -0.8,
  }, // login
  title: {
    fontFamily: fontFamily.bold,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.75,
  }, // screen title
  heading: {
    fontFamily: fontFamily.bold,
    fontSize: 28,
    lineHeight: 31,
    letterSpacing: -0.7,
  }, // place name, success screen
  headingM: {
    fontFamily: fontFamily.bold,
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.52,
  }, // hero, place preview
  headingS: {
    fontFamily: fontFamily.bold,
    fontSize: 24,
    lineHeight: 29,
    letterSpacing: -0.48,
  }, // bottom sheet, management
  brand: {
    fontFamily: fontFamily.bold,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.17,
  }, // wordmark

  // Body copy
  bodyL: { fontFamily: fontFamily.regular, fontSize: 16, lineHeight: 24 }, // lead under a title
  body: { fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20 },
  captionRelaxed: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 20.3,
  }, // descriptions in cards (1.45)
  cardTitle: { fontFamily: fontFamily.semibold, fontSize: 16, lineHeight: 20 }, // titles in cards and list rows (16/600)
  cardTitleL: { fontFamily: fontFamily.bold, fontSize: 17, lineHeight: 22 }, // a plugin's name on its catalog card (17/700)
  rowTitle: { fontFamily: fontFamily.semibold, fontSize: 15, lineHeight: 20 }, // titles in flush rows inside a card (15/600)
  small: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18 },
  smallStrong: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    lineHeight: 18,
  }, // group headers in a sheet (13/600)
  tileTitle: { fontFamily: fontFamily.semibold, fontSize: 12, lineHeight: 15 }, // a widget's name on a layout tile
  tab: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 16 },
  tabActive: { fontFamily: fontFamily.semibold, fontSize: 12, lineHeight: 16 },

  // Interactive
  button: { fontFamily: fontFamily.semibold, fontSize: 16, lineHeight: 20 }, // main button
  buttonM: { fontFamily: fontFamily.semibold, fontSize: 15, lineHeight: 20 },
  buttonS: { fontFamily: fontFamily.semibold, fontSize: 14, lineHeight: 18 },
  input: { fontFamily: fontFamily.regular, fontSize: 16, lineHeight: 22 },
  link: { fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 20 },

  // Labels — always UPPERCASE (textTransform: 'uppercase'), tracked out
  label: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.72,
  }, // 0.06em
  labelL: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    lineHeight: 17,
    letterSpacing: 0.78,
  },
  labelHero: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.96,
  }, // 0.08em on the red banner
  chip: {
    fontFamily: fontFamily.semibold,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.55,
  }, // 0.05em
  /** Tags on list cards: sentence case, unlike the uppercase chip. */
  tag: { fontFamily: fontFamily.semibold, fontSize: 12, lineHeight: 16 },
  stepNumber: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.72,
  },
  abbr: {
    fontFamily: fontFamily.bold,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 0,
  }, // place abbreviation (e.g. "OS")
  codeInline: {
    fontFamily: fontFamily.semibold,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 1.28,
  }, // K7M-4QX in a row

  // Codes
  codeXL: {
    fontFamily: fontFamily.bold,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: 1.68,
  }, // "place created" screen
  codeM: {
    fontFamily: fontFamily.bold,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: 1.32,
  }, // management
  codeS: {
    fontFamily: fontFamily.bold,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: 0.9,
  }, // "Code, link or QR" row
  otp: { fontFamily: fontFamily.semibold, fontSize: 26, lineHeight: 30 }, // code cell

  // Emoji in an icon box (a plugin's icon), the size of the line icon it stands in for
  emojiM: { fontFamily: fontFamily.regular, fontSize: 20, lineHeight: 26 },
  emojiL: { fontFamily: fontFamily.regular, fontSize: 26, lineHeight: 32 },
} as const;

/** Shadows: iOS (shadow*) + Android (elevation). Spread into StyleSheet: `...shadows.card`. */
export const shadows = {
  none: {},
  /** Default card / list row (0 1 2 rgba .06) */
  card: {
    shadowColor: '#1B1B1F',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  /** Dashboard / success card (0 1 2 + 0 8 24 rgba .05) */
  cardRaised: {
    shadowColor: '#1B1B1F',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  /** Selected card / row (red glow 0 6 18 .12) */
  selected: {
    shadowColor: '#E50101',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 9,
    elevation: 4,
  },
  /** Small floating button on the map / active segment (0 2 8 .12) */
  floating: {
    shadowColor: '#1B1B1F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  /** A panel at the bottom of a screen, over the content (0 -8 28 rgba .10) */
  panel: {
    shadowColor: '#1B1B1F',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 8,
  },
  /** Focus glow of a text field (COMPONENTS.md → TextField: 4 dp, primary at .10) */
  focusRing: {
    shadowColor: '#E50101',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 0,
  },
} as const;

/** Marks drawn on live maps (MapLibre style values in px): place pins with labels, the user's position. */
export const mapMarks = {
  pinRadius: 9,
  pinRadiusSelected: 12,
  pinStroke: 3,
  meRadius: 7,
  meHaloRadius: 16,
  meStroke: 2.5,
  labelSize: 12,
  labelHalo: 1.5,
  /** The label starts this far below the pin's centre, in ems. */
  labelOffset: 1.3,
  /** Plugin routes: the line and the white casing under it. */
  routeWidth: 4,
  routeCasing: 7,
  /** Dashes of a dashed route (in line widths). */
  routeDash: [2, 1.5],
  /** Plugin areas: the outline. */
  areaStroke: 2,
  /** Room around everything on a plugin map when its first view fits it. */
  fitPadding: 40,
} as const;

export const borders = {
  hairline: 1,
  selected: 2, // selected card, focused field, active code cell
  row: 1.5, // place switcher row, dashed frames
  scanner: 3, // QR scanner frame corners
} as const;

export const opacity = {
  pressed: 0.85,
  disabled: 0.45,
  onPrimarySubtitle: 0.9,
  /** Halo around the current-location pin on the login map illustration. */
  routeHalo: 0.18,
  /** Plugin areas on a map: their fill. */
  mapArea: 0.16,
  /** Hero banner decoration: white streets and the halo around the white pin. */
  heroRoad: 0.09,
  heroPinHalo: 0.25,
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
