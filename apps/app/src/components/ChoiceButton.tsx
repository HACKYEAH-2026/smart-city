import type { LucideIcon } from "lucide-react-native";
import { Pressable, StyleSheet } from "react-native";
import { tapFeedback } from "../lib/haptics";
import { borders, colors, opacity, radii, shadows, sizes, spacing } from "../theme";
import { Icon } from "./Icon";
import { Text } from "./Text";

export interface ChoiceButtonProps {
  label: string;
  icon?: LucideIcon;
  selected: boolean;
  onPress: () => void;
}

/**
 * One of two or more choices as a button: an optional icon and the label in one row (design: "Rodzaj" in the report
 * form). A radio: put the buttons in a View with role="radiogroup". Selection shows in the red border and the glow.
 */
export function ChoiceButton({ label, icon, selected, onPress }: ChoiceButtonProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      aria-checked={selected}
      onPressIn={tapFeedback}
      onPress={onPress}
      style={({ pressed }) => [styles.button, selected ? styles.selected : styles.idle, pressed && styles.pressed]}
    >
      {icon ? <Icon icon={icon} size={sizes.iconS} color="text" strokeWidth={2} /> : null}
      <Text variant="buttonM">{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: opacity.pressed },
  button: {
    flex: 1,
    height: sizes.choiceButton,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[4],
    borderRadius: radii.lg,
    borderWidth: borders.selected,
    backgroundColor: colors.surface,
  },
  idle: { borderColor: "transparent", ...shadows.card },
  selected: { borderColor: colors.primary, ...shadows.selected },
});
