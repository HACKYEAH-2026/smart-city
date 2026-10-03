import { Pressable, StyleSheet } from "react-native";
import { tapFeedback } from "../lib/haptics";
import { borders, colors, opacity, radii, shadows, sizes, spacing } from "../theme";
import { Text } from "./Text";

export interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

/**
 * A pill choice in a wrapping row (COMPONENTS.md → Chip): the chosen one is dark, the others are white with a border.
 * A radio: put the chips in a View with role="radiogroup".
 */
export function Chip({ label, selected, onPress }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      aria-checked={selected}
      onPressIn={tapFeedback}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected ? styles.selected : styles.idle, pressed && styles.pressed]}
    >
      <Text variant="buttonS" style={[styles.label, selected && styles.labelSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: opacity.pressed },
  chip: {
    minHeight: sizes.chipHeight,
    justifyContent: "center",
    paddingHorizontal: spacing[8],
    borderRadius: radii.pill,
    borderWidth: borders.hairline,
  },
  idle: { backgroundColor: colors.surface, borderColor: colors.border, ...shadows.card },
  selected: { backgroundColor: colors.text, borderColor: colors.text },
  label: { color: colors.text },
  labelSelected: { color: colors.surface },
});
