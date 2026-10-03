import Svg, { Circle, Path, Rect } from "react-native-svg";
import { colors, opacity, sizes } from "../theme";

/**
 * Decorative map illustration behind the login screen (COMPONENTS.md → login). Pure decoration: no accessible content.
 * Coordinates are the design's 390 × 300 artboard; `slice` keeps it covering wider screens.
 */
export function MapDecoration() {
  return (
    <Svg width="100%" height={sizes.authMap} viewBox="0 0 390 300" preserveAspectRatio="xMidYMin slice">
      <Rect x={96} y={70} width={70} height={44} rx={8} fill={colors.mapPark} />
      <Rect x={236} y={150} width={54} height={60} rx={8} fill={colors.mapPark} />
      <Path
        d="M-20 250 C 80 200, 150 285, 250 235 S 370 170, 420 200"
        stroke={colors.mapWater}
        strokeWidth={26}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M0 52 H390 M0 136 L390 112 M74 0 V300 M190 0 L214 300 M318 0 L296 300"
        stroke={colors.mapRoad}
        strokeWidth={7}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M0 196 L160 176 M240 0 L260 120 M120 150 L74 300"
        stroke={colors.mapRoadMinor}
        strokeWidth={3.5}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M74 52 L190 52 L201 124 L304 112"
        stroke={colors.primary}
        strokeWidth={3}
        strokeDasharray="2 7"
        strokeLinecap="round"
        fill="none"
      />
      <Circle cx={304} cy={112} r={13} fill={colors.primary} opacity={opacity.routeHalo} />
      <Circle cx={304} cy={112} r={6} fill={colors.primary} />
      <Circle cx={74} cy={52} r={5} fill={colors.surface} stroke={colors.primary} strokeWidth={2.5} />
    </Svg>
  );
}
