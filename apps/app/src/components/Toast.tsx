import { CircleCheck } from "lucide-react-native";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeOutDown, SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, layout, motion, radii, shadows, sizes, spacing } from "../theme";
import { Icon } from "./Icon";
import { Text } from "./Text";

/** What happened; `n` tells a repeat of the same text (a second vote) from the one already shown. */
export type ToastMessage = { text: string; n: number };

export interface ToastProps {
  message: ToastMessage | null;
  /** Points kept free above the bottom edge's inset, e.g. for a floating button there. */
  lift?: number;
}

/** How long a toast stays before it goes. */
const TOAST_MS = 4000;

/**
 * A confirmation floating over the bottom of the screen (COMPONENTS.md → Toast), e.g. a plugin's "Dziękujemy za
 * głos!": a dark bubble slides up, stays TOAST_MS and goes; nothing under it moves. Screen readers announce it
 * (`role="status"`); it takes no touches.
 */
export function Toast({ message, lift = 0 }: ToastProps) {
  const insets = useSafeAreaInsets();
  const [gone, setGone] = useState<number | null>(null);
  const n = message?.n;
  useEffect(() => {
    if (n === undefined) return;
    const timer = setTimeout(() => setGone(n), TOAST_MS);
    return () => clearTimeout(timer);
  }, [n]);
  return (
    <View pointerEvents="none" style={[styles.layer, { bottom: insets.bottom + spacing[12] + lift }]}>
      {message && gone !== message.n ? (
        <Animated.View
          key={message.n}
          role="status"
          entering={SlideInDown.duration(motion.sheet)}
          exiting={FadeOutDown.duration(motion.base)}
          style={styles.toast}
        >
          <Icon icon={CircleCheck} size={sizes.iconS} color="onPrimary" strokeWidth={2.2} />
          <Text variant="button" color="onPrimary" style={styles.text}>
            {message.text}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: "absolute", left: layout.screenPaddingX, right: layout.screenPaddingX, alignItems: "center" },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[4],
    minHeight: sizes.fab,
    paddingHorizontal: spacing[9],
    paddingVertical: spacing[5],
    borderRadius: radii.pill,
    backgroundColor: colors.text,
    ...shadows.floating,
  },
  text: { flexShrink: 1 },
});
