import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from "react-native";
import { type ColorToken, colors, type TypographyToken, typography } from "../theme";

/** Typography variants that are always rendered in UPPERCASE (labels). */
const UPPERCASE: ReadonlySet<TypographyToken> = new Set<TypographyToken>([
  "label",
  "labelL",
  "labelHero",
  "chip",
  "stepNumber",
  "abbr",
  "sectionLabel",
]);

export interface TextProps extends RNTextProps {
  /** Typography token from the design system (default: body). */
  variant?: TypographyToken;
  /** Color token from the design system (default: text). */
  color?: ColorToken;
}

/** The only text component in the app: every text takes its font and color from tokens. */
export function Text({ variant = "body", color = "text", style, ...rest }: TextProps) {
  const base: TextStyle = {
    ...typography[variant],
    color: colors[color],
    ...(UPPERCASE.has(variant) ? { textTransform: "uppercase" as const } : null),
  };
  return <RNText allowFontScaling style={[base, style]} {...rest} />;
}
