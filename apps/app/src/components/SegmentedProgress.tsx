import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { colors, motion, sizes, spacing } from "../theme";
import { AccentGradient } from "./AccentGradient";

export interface SegmentedProgressProps {
  /** How many segments are filled, 0–`segments`; a fraction fills part of a segment. */
  value: number;
  segments: number;
  /** Space between segments (default `spacing[3]`, StepProgress; PasswordStrength uses `spacing[2]`). */
  gap?: number;
}

/**
 * Animates a single progress value towards `value`, so the fill flows across the segments from left to right
 * (and drains right to left), one `motion.base` per segment.
 */
function useAnimatedValue(value: number): Animated.Value {
  const progress = useRef(new Animated.Value(value)).current;
  const shown = useRef(value);
  useEffect(() => {
    const distance = Math.abs(value - shown.current);
    shown.current = value;
    const animation = Animated.timing(progress, {
      toValue: value,
      duration: motion.base * distance,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [value, progress]);
  return progress;
}

/**
 * Row of equal segments filled `primary` over `border` (COMPONENTS.md → SegmentedProgress): the steps of a wizard
 * and the password meter. Takes the width it is given. Decorative (`aria-hidden`): the caller shows the same
 * progress as text.
 */
export function SegmentedProgress({ value, segments, gap = spacing[3] }: SegmentedProgressProps) {
  const progress = useAnimatedValue(value);
  return (
    <View aria-hidden style={[styles.row, { gap }]}>
      {Array.from({ length: segments }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed number of identical segments
        <View key={i} style={styles.segment}>
          <Animated.View
            style={[
              styles.fillBox,
              {
                width: progress.interpolate({
                  inputRange: [i, i + 1],
                  outputRange: ["0%", "100%"],
                  extrapolate: "clamp",
                }),
              },
            ]}
          >
            <AccentGradient style={StyleSheet.absoluteFill} />
          </Animated.View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row" },
  segment: {
    flex: 1,
    height: sizes.stepBarHeight,
    borderRadius: sizes.stepBarHeight / 2,
    backgroundColor: colors.border,
    overflow: "hidden",
  },
  // The animated width is on the box; the gradient fills it.
  fillBox: { height: "100%", overflow: "hidden" },
});
