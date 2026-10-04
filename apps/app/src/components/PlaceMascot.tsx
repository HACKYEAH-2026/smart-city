import type { PlaceKind } from "@app/shared";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { SvgXml } from "react-native-svg";
import { sizes } from "../theme";
import { MASCOT_VIEWBOX, PLACE_MASCOTS } from "./mascots";
import { useScrollY } from "./Screen";

const APPEAR_MS = 200;
/** The largest z-index (a 32-bit int): the mascot is drawn over everything else on the screen. */
const TOP_Z_INDEX = 2147483647;
const DROP_DELAY_MS = 150;
/**
 * The drop and the two bounces after it, from the rest position: each step is [offset in dp, duration in ms]. The
 * fall eases in, each bounce eases out and back.
 */
const DROP_STEPS: [number, number][] = [
  [0, 420],
  [-14, 240],
  [0, 240],
  [-5, 160],
  [0, 160],
];

/**
 * The place's mascot, centred in the dashboard's content (it scrolls with it): it appears, falls a little and bounces
 * twice, once. Then it stays still, and fades with the scroll. With reduced motion it appears in place. Decoration
 * only: it takes no touches and is hidden from assistive tech.
 */
export function PlaceMascot({ kind }: { kind: PlaceKind }) {
  const reduced = useReducedMotion();
  const scrollY = useScrollY();
  const appear = useSharedValue(0);
  const drop = useSharedValue(-sizes.dashboardMascotDrop);

  useEffect(() => {
    appear.value = withTiming(1, { duration: APPEAR_MS });
    if (reduced) {
      drop.value = 0;
      return;
    }
    const steps = DROP_STEPS.map(([offset, duration], i) =>
      withTiming(offset, { duration, easing: i % 2 === 0 ? Easing.in(Easing.quad) : Easing.out(Easing.quad) }),
    );
    drop.value = withDelay(DROP_DELAY_MS, withSequence(...steps));
  }, [appear, drop, reduced]);

  const style = useAnimatedStyle(() => ({
    opacity: appear.value * interpolate(scrollY.value, [0, sizes.dashboardBlurRange], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateY: drop.value }],
  }));

  const width = sizes.dashboardMascot;
  const height = (width * MASCOT_VIEWBOX.height) / MASCOT_VIEWBOX.width;
  return (
    <View style={styles.block}>
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.frame}
      >
        <Animated.View style={style}>
          <SvgXml xml={PLACE_MASCOTS[kind]} width={width} height={height} />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // The block is the first thing in the content but takes no room: the header stays where it is. The drawing hangs
  // from its top, centred on two thirds of the content's width.
  block: { height: 0 },
  frame: {
    position: "absolute",
    top: -sizes.dashboardMascotLift,
    left: `${sizes.dashboardMascotX * 100}%`,
    zIndex: TOP_Z_INDEX,
  },
});
