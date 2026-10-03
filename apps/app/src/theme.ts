import { Platform } from "react-native";

/**
 * Design tokens — rebranding = changing this file. Mood: correspondence on fine paper.
 * Do not hardcode colors/typefaces/spacing in components; take them from here.
 */
export const color = {
  paper: "#f5efe3",
  paperDeep: "#ece3d2",
  sheet: "#fffcf6",
  ink: "#1d2230",
  inkSoft: "#4b5061",
  rule: "#d8ccb6",
  seal: "#a3342b",
  sealDeep: "#862920",
  onSeal: "#fff8f0",
  onInk: "#f5efe3",
  onInkSoft: "#cfd2da",
} as const;

export const font = {
  display: Platform.select({
    ios: "Georgia",
    android: "serif",
    default: "Newsreader, 'Iowan Old Style', Georgia, serif",
  }),
  text: Platform.select({ ios: "System", android: "sans-serif", default: "'Public Sans', system-ui, sans-serif" }),
} as const;

export const space = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32, section: 64 } as const;
export const radius = { card: 12, control: 999 } as const;
export const maxWidth = { frame: 1120, narrow: 640 } as const;

export const shadow = {
  sheet: {
    shadowColor: color.ink,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
} as const;

/** Status tones (plugin badges): background + text with WCAG AA contrast. */
export const tone = {
  neutral: { bg: color.paperDeep, fg: color.ink },
  info: { bg: "#dde6f3", fg: "#1f3d6b" },
  success: { bg: "#dcebd8", fg: "#24502a" },
  warning: { bg: "#f3e3c3", fg: "#6b4510" },
  danger: { bg: "#f3d6d2", fg: color.sealDeep },
} as const;
