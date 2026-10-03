import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { type PasswordCheck, passwordStrength } from "../lib/passwordStrength";
import { t } from "../texts";
import { colors, motion, sizes, spacing } from "../theme";
import { Text } from "./Text";

/** Segment indexes; segment `i` covers the score range [i, i + 1]. */
const SEGMENTS = [0, 1, 2, 3];

/**
 * Animates a single progress value (0–4) towards the score, so the fill flows across the segments
 * from left to right (and drains right to left), one `motion.base` per segment.
 */
function useAnimatedScore(score: number): Animated.Value {
  const progress = useRef(new Animated.Value(score)).current;
  const shown = useRef(score);
  useEffect(() => {
    const distance = Math.abs(score - shown.current);
    shown.current = score;
    const animation = Animated.timing(progress, {
      toValue: score,
      duration: motion.base * distance,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [score, progress]);
  return progress;
}

/**
 * Four-segment password meter (COMPONENTS.md → PasswordStrength): fills as the password approaches the minimum
 * length, with a hint until it is met.
 */
export function PasswordStrength({ password }: { password: string }) {
  const { score, missing } = passwordStrength(password);
  const progress = useAnimatedScore(score);
  const hints: Record<PasswordCheck, string> = {
    length: t.pw_hint_length,
  };
  return (
    <View style={styles.wrap}>
      <View aria-hidden style={styles.segments}>
        {SEGMENTS.map((i) => (
          <View key={i} style={styles.segment}>
            <Animated.View
              style={[
                styles.fill,
                {
                  width: progress.interpolate({
                    inputRange: [i, i + 1],
                    outputRange: ["0%", "100%"],
                    extrapolate: "clamp",
                  }),
                },
              ]}
            />
          </View>
        ))}
      </View>
      <Text variant="small" color="textSecondary">
        {missing ? hints[missing] : t.pw_ok}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing[3] },
  segments: { flexDirection: "row", gap: spacing[1] },
  segment: {
    flex: 1,
    height: sizes.stepBarHeight,
    borderRadius: sizes.stepBarHeight / 2,
    backgroundColor: colors.border,
    overflow: "hidden",
  },
  fill: { height: "100%", backgroundColor: colors.primary },
});
