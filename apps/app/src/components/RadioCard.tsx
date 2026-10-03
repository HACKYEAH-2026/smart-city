import { Pressable, StyleSheet, View } from "react-native";
import { borders, colors, radii, shadows, sizes, spacing } from "../theme";
import { Text } from "./Text";

export interface RadioCardProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

/**
 * Selectable option (COMPONENTS.md → RadioCard). Selection is shown by the border, the shadow and the filled dot,
 * not by color alone. Put several inside a View with role="radiogroup".
 */
export function RadioCard({ label, selected, onPress }: RadioCardProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[styles.card, selected ? styles.selected : styles.idle]}
    >
      <View style={[styles.dot, selected && styles.dotSelected]}>
        {selected ? <View style={styles.dotFill} /> : null}
      </View>
      <Text variant="button">{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: sizes.iconBox,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[7],
    padding: spacing[8],
    borderRadius: radii["2xl"],
    borderWidth: borders.selected,
  },
  idle: { borderColor: "transparent", backgroundColor: colors.surface, ...shadows.card },
  selected: { borderColor: colors.primary, backgroundColor: colors.surface, ...shadows.selected },
  dot: {
    width: sizes.radioDot,
    height: sizes.radioDot,
    borderRadius: sizes.radioDot / 2,
    borderWidth: borders.selected,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  dotSelected: { borderColor: colors.primary },
  dotFill: { width: spacing[6], height: spacing[6], borderRadius: spacing[6], backgroundColor: colors.primary },
});
