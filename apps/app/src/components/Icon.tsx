import type { LucideIcon } from "lucide-react-native";
import { type ColorToken, colors, sizes } from "../theme";

export interface IconProps {
  /** Glyph from lucide-react-native (the design's icon family). */
  icon: LucideIcon;
  size?: number;
  color?: ColorToken;
  strokeWidth?: number;
}

/** Line icon with colors from tokens (COMPONENTS.md → Icon: 20–22 px, stroke 1.8 by default). */
export function Icon({ icon: Glyph, size = sizes.tabIcon, color = "text", strokeWidth = 1.8 }: IconProps) {
  return <Glyph size={size} color={colors[color]} strokeWidth={strokeWidth} />;
}
