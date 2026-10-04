import { Link as RouterLink } from "expo-router";
import { ChevronRight, type LucideIcon } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { tapFeedback } from "../lib/haptics";
import { usePressed } from "../lib/pressed";
import { colors, opacity, radii, shadows, sizes, spacing } from "../theme";
import { Icon } from "./Icon";
import { IconBox } from "./IconBox";
import { Text } from "./Text";

export interface ActionRowProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  /** Route the row opens; without it or `onPress` the row is shown disabled (its screen does not exist yet). */
  href?: string;
  /** An action instead of a route (e.g. opening the system settings): the row is a button. */
  onPress?: () => void;
}

/**
 * Row that opens a screen (COMPONENTS.md → ActionRow): icon box, title over subtitle, chevron. A link on the web, or a
 * button with `onPress`.
 */
export function ActionRow({ icon, title, subtitle, href, onPress }: ActionRowProps) {
  const press = usePressed(tapFeedback);
  const content = (
    <>
      <IconBox icon={icon} />
      <View style={styles.body}>
        <Text variant="cardTitle">{title}</Text>
        <Text variant="caption" color="textSecondary">
          {subtitle}
        </Text>
      </View>
      <Icon icon={ChevronRight} size={sizes.iconS} color="iconMuted" strokeWidth={2} />
    </>
  );
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={[styles.row, press.pressed && styles.pressed]}
      >
        {content}
      </Pressable>
    );
  }
  if (!href) {
    return (
      <View accessibilityState={{ disabled: true }} style={[styles.row, styles.disabled]}>
        {content}
      </View>
    );
  }
  return (
    <RouterLink href={href as never} asChild>
      <Pressable
        accessibilityRole="link"
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={StyleSheet.flatten([styles.row, press.pressed && styles.pressed])}
      >
        {content}
      </Pressable>
    </RouterLink>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: opacity.pressed },
  disabled: { opacity: opacity.disabled },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[7],
    paddingVertical: spacing[6],
    paddingHorizontal: spacing[7],
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  body: { flex: 1, gap: spacing[1] },
});
