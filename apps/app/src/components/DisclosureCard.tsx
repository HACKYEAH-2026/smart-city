import { ChevronDown, type LucideIcon } from "lucide-react-native";
import { type ReactNode, useEffect, useState } from "react";
import { type LayoutChangeEvent, Pressable, StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { tapFeedback } from "../lib/haptics";
import { borders, colors, motion, radii, shadows, sizes, spacing } from "../theme";
import { Icon } from "./Icon";
import { IconBox } from "./IconBox";
import { Text } from "./Text";

export interface DisclosureCardProps {
  icon: LucideIcon;
  title: string;
  /** One line under the title: what the section holds, e.g. "8 osób · 2 administratorów". */
  summary: string;
  open: boolean;
  onToggle: () => void;
  /** The section's content, shown under the header while open. */
  children: ReactNode;
  /** Content without the body's padding and gap: rows that reach the card's edges, each with its own padding. */
  flush?: boolean;
}

/** Opening and closing; with reduced motion on in the system, reanimated jumps straight to the end. */
const REVEAL = { duration: motion.sheet, easing: Easing.out(Easing.cubic) };

/**
 * A section that opens in place (COMPONENTS.md → DisclosureCard; design E-ZarzadzanieMiejscem): icon box, title,
 * summary and a chevron. Open, the icon box turns `primary`, the chevron turns over in a circle and the content
 * unfolds under a hairline (and folds back when closed). The header is the button (named by the title,
 * `aria-expanded`), so not only color tells.
 */
export function DisclosureCard({ icon, title, summary, open, onToggle, children, flush = false }: DisclosureCardProps) {
  const reveal = useReveal(open);
  return (
    <View style={[styles.card, open && styles.open]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        aria-expanded={open}
        onPressIn={tapFeedback}
        onPress={onToggle}
        style={styles.head}
      >
        <IconBox icon={icon} selected={open} neutral={!open} />
        <View style={styles.text}>
          <Text variant="cardTitle">{title}</Text>
          <Text variant="small" color="textSecondary">
            {summary}
          </Text>
        </View>
        <View style={[styles.chevron, open && styles.chevronOpen]}>
          <Animated.View style={reveal.chevron}>
            <Icon icon={ChevronDown} size={sizes.iconS} color={open ? "text" : "textSecondary"} />
          </Animated.View>
        </View>
      </Pressable>
      {reveal.mounted ? (
        <Animated.View style={[styles.clip, reveal.body]}>
          {/* Out of the flow, so it is measured at its full height while the clip around it grows. */}
          <View onLayout={reveal.measure} style={[styles.body, !flush && styles.padded]}>
            {children}
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

/**
 * The body's height follows `open` from 0 to the content's height and back. The content stays mounted until it has
 * folded away, then unmounts: closed, it is out of the accessibility tree, and every opening starts afresh.
 */
function useReveal(open: boolean) {
  const progress = useSharedValue(open ? 1 : 0);
  const height = useSharedValue(0);
  const [folded, setFolded] = useState(!open);
  useEffect(() => {
    if (open) setFolded(false);
    progress.value = withTiming(open ? 1 : 0, REVEAL, (finished) => {
      if (finished && !open) scheduleOnRN(setFolded, true);
    });
  }, [open, progress]);
  const body = useAnimatedStyle(() => ({ height: height.value * progress.value }));
  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${progress.value * 180}deg` }] }));
  const measure = (e: LayoutChangeEvent) => {
    height.value = e.nativeEvent.layout.height;
  };
  return { mounted: open || !folded, measure, body, chevron };
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radii["3xl"], ...shadows.card },
  open: shadows.cardRaised,
  head: { flexDirection: "row", alignItems: "center", gap: spacing[7], padding: spacing[8] },
  text: { flex: 1, gap: spacing[1] },
  chevron: {
    width: sizes.iconButton,
    height: sizes.iconButton,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  chevronOpen: { backgroundColor: colors.surfaceSunken },
  // The card's bottom corners round the clip too.
  clip: { overflow: "hidden", borderBottomLeftRadius: radii["3xl"], borderBottomRightRadius: radii["3xl"] },
  body: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    borderTopWidth: borders.hairline,
    borderTopColor: colors.borderSubtle,
  },
  padded: { gap: spacing[7], padding: spacing[8] },
});
