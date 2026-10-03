import { useEffect } from "react";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { colors, opacity, sizes } from "../theme";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** The dashed route's pattern ("2 7" in the path below): one dash and one gap, in SVG units. */
const DASH_CYCLE = 9;
const FLOW_MS = 2400;
const PULSE_MS = 1600;
const HALO_RADIUS = 13;
const HALO_GROWTH = 8;

/**
 * Decorative map illustration behind the login screen (COMPONENTS.md → login). Pure decoration: no accessible content.
 * The route's dashes flow along it and the pin's halo breathes. Both stop when the system asks for reduced motion.
 * Coordinates are the design's 390 × 300 artboard; `slice` keeps it covering wider screens.
 */
export function MapDecoration() {
  const reduced = useReducedMotion();
  const flow = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    flow.value = withRepeat(withTiming(-DASH_CYCLE, { duration: FLOW_MS, easing: Easing.linear }), -1, false);
    pulse.value = withRepeat(withTiming(1, { duration: PULSE_MS, easing: Easing.inOut(Easing.ease) }), -1, true);
    return () => {
      cancelAnimation(flow);
      cancelAnimation(pulse);
    };
  }, [reduced, flow, pulse]);

  const routeProps = useAnimatedProps(() => ({ strokeDashoffset: flow.value }));
  const haloProps = useAnimatedProps(() => ({
    r: HALO_RADIUS + pulse.value * HALO_GROWTH,
    opacity: opacity.routeHalo * (1 - pulse.value * 0.6),
  }));

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
      <AnimatedPath
        d="M74 52 L190 52 L201 124 L304 112"
        stroke={colors.primary}
        strokeWidth={3}
        strokeDasharray="2 7"
        strokeLinecap="round"
        fill="none"
        animatedProps={routeProps}
      />
      <AnimatedCircle cx={64} cy={120} fill={colors.primary} animatedProps={haloProps} />
      <Circle cx={64} cy={120} r={6} fill={colors.primary} />

      <AnimatedCircle cx={214} cy={170} fill={colors.primary} animatedProps={haloProps} />
      <Circle cx={214} cy={170} r={6} fill={colors.primary} />

      <AnimatedCircle cx={304} cy={112} fill={colors.primary} animatedProps={haloProps} />
      <Circle cx={304} cy={112} r={6} fill={colors.primary} />
      <Circle cx={74} cy={52} r={5} fill={colors.surface} stroke={colors.primary} strokeWidth={2.5} />
    </Svg>
  );
}
