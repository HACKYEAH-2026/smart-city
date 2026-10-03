import type { LucideIcon } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { tapFeedback } from "../lib/haptics";
import { borders, colors, opacity, radii, shadows, sizes, spacing } from "../theme";
import { IconBox } from "./IconBox";
import { Text } from "./Text";

export interface SelectableCardProps {
  icon: LucideIcon;
  title: string;
  hint: string;
  selected: boolean;
  onPress: () => void;
}

/**
 * One choice in a two-column grid (COMPONENTS.md → SelectableCard), e.g. the kind of a new place. A radio: put the
 * cards in a View with role="radiogroup". Selection shows in the border, the shadow and the icon box, not color alone.
 */
export function SelectableCard({ icon, title, hint, selected, onPress }: SelectableCardProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={title}
      aria-checked={selected}
      onPressIn={tapFeedback}
      onPress={onPress}
      style={({ pressed }) => [styles.card, selected ? styles.selected : styles.idle, pressed && styles.pressed]}
    >
      <IconBox icon={icon} size={sizes.avatarLg} selected={selected} />
      <View style={styles.text}>
        <Text variant="buttonM">{title}</Text>
        <Text variant="small" color="textSecondary">
          {hint}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: opacity.pressed },
  card: {
    flexBasis: "40%",
    flexGrow: 1,
    minHeight: sizes.selectableCard,
    gap: spacing[7],
    padding: spacing[7],
    borderRadius: radii["2xl"],
    borderWidth: borders.selected,
    backgroundColor: colors.surface,
  },
  idle: { borderColor: "transparent", ...shadows.card },
  selected: { borderColor: colors.primary, ...shadows.selected },
  text: { gap: spacing[1] },
});
