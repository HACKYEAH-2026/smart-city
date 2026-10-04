import { Pressable, StyleSheet, View } from "react-native";
import { tapFeedback } from "../lib/haptics";
import { borders, colors, opacity, radii, shadows, sizes, spacing } from "../theme";
import { Badge } from "./Badge";
import { Text } from "./Text";

export interface RadioCardProps {
  label: string;
  /** What the option means, under the label (e.g. a join rule). */
  description?: string;
  /** Chip next to the label, e.g. "Polecane". */
  badge?: string;
  selected: boolean;
  onPress: () => void;
  /** Shown dimmed and not pressable (e.g. while the choice is being saved). */
  disabled?: boolean;
}

/**
 * Selectable option (COMPONENTS.md → RadioCard). Selection is shown by the border, the shadow and the filled dot,
 * not by color alone. Put several inside a View with role="radiogroup".
 */
export function RadioCard({ label, description, badge, selected, onPress, disabled = false }: RadioCardProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      aria-checked={selected}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPressIn={tapFeedback}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        description ? styles.top : null,
        selected ? styles.selected : styles.idle,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <View style={[styles.dot, selected && styles.dotSelected]}>
        {selected ? <View style={styles.dotFill} /> : null}
      </View>
      <View style={styles.text}>
        <View style={styles.titleRow}>
          <Text variant="button">{label}</Text>
          {badge ? <Badge text={badge} tone="accent" /> : null}
        </View>
        {description ? (
          <Text variant="captionRelaxed" color="textSecondary">
            {description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: opacity.pressed },
  disabled: { opacity: opacity.disabled },
  card: {
    minHeight: sizes.iconBox,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[7],
    padding: spacing[8],
    borderRadius: radii["2xl"],
    borderWidth: borders.selected,
  },
  top: { alignItems: "flex-start" },
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
  text: { flex: 1, gap: spacing[1] },
  titleRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing[4] },
});
