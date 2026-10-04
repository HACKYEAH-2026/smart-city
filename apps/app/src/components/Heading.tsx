import type { TypographyToken } from "../theme";
import { Text, type TextProps } from "./Text";

type HeadingLevel = 1 | 2 | 3;
type HeadingVariant = Extract<
  TypographyToken,
  | "titleXL"
  | "title"
  | "heading"
  | "headingM"
  | "headingS"
  | "cardTitleL"
  | "cardTitle"
  | "label"
  | "sectionLabel"
  | "smallStrong"
>;

export interface HeadingProps extends Omit<TextProps, "variant"> {
  /** Semantic level: h1–h3 on the web, aria-level for screen readers. */
  level: HeadingLevel;
  /** Visual size (default: title for level 1, headingS otherwise). */
  variant?: HeadingVariant;
}

/** Heading with a real level, so the page outline and E2E selectors (role=heading) work on web and native. */
export function Heading({ level, variant = level === 1 ? "title" : "headingS", ...rest }: HeadingProps) {
  return <Text role="heading" aria-level={level} variant={variant} {...rest} />;
}
