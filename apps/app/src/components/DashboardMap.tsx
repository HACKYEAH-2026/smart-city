import Svg, { Path } from "react-native-svg";
import { colors, sizes } from "../theme";

/**
 * Decorative map behind the dashboard header (design E-Dashboard). Pure decoration, hidden from screen readers.
 * Coordinates are the design's 390 × 230 artboard.
 */
export function DashboardMap() {
  return (
    <Svg width="100%" height={sizes.dashboardMap} viewBox="0 0 390 230" preserveAspectRatio="xMidYMin slice">
      <Path
        d="M0 70 H390 M0 170 L390 150 M60 0 V230 M230 0 L246 230 M340 0 L330 230"
        stroke={colors.mapRoadMinor}
        strokeWidth={7}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M-20 220 C 100 190, 200 240, 420 200"
        stroke={colors.mapWater}
        strokeWidth={20}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}
