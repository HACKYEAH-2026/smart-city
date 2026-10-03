import Svg, { Circle, Path } from "react-native-svg";
import { brandMark, type ColorToken, colors, sizes } from "../theme";

export interface BrandMarkProps {
  size?: number;
  color?: ColorToken;
}

/** The app's logo mark, "Roofline M" (theme/brand.ts). Decorative: the wordmark next to it carries the name. */
export function BrandMark({ size = sizes.brandMark, color = "primary" }: BrandMarkProps) {
  return (
    <Svg width={size} height={size} viewBox={brandMark.viewBox} aria-hidden>
      <Path d={brandMark.roofs} fill="none" stroke={colors[color]} strokeWidth={brandMark.strokeWidth} />
      <Circle cx={brandMark.dot.cx} cy={brandMark.dot.cy} r={brandMark.dot.r} fill={colors[color]} />
    </Svg>
  );
}
