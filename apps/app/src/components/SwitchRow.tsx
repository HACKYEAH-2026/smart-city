import { Pressable, StyleSheet, Switch, View } from "react-native";
import { tapFeedback } from "../lib/haptics";
import { colors, opacity, radii, shadows, spacing } from "../theme";
import { Text } from "./Text";

export interface SwitchRowProps {
  label: string;
  /** Short text under the label (e.g. what the switch changes). */
  hint?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

/**
 * White row with a switch on the right (COMPONENTS.md → Checkbox / Switch, "Ustaw jako domyślne"). The whole row is
 * the switch for touch and for screen readers; the drawn Switch is decoration.
 */
export function SwitchRow({ label, hint, value, onChange }: SwitchRowProps) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      aria-checked={value}
      onPressIn={tapFeedback}
      onPress={() => onChange(!value)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.label}>
        <Text variant="buttonM">{label}</Text>
        {hint ? (
          <Text variant="small" color="textSecondary">
            {hint}
          </Text>
        ) : null}
      </View>
      <View pointerEvents="none" aria-hidden>
        <Switch
          value={value}
          trackColor={{ true: colors.primary, false: colors.border }}
          thumbColor={colors.surface}
          tabIndex={-1}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: opacity.pressed },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[6],
    paddingVertical: spacing[7],
    paddingHorizontal: spacing[8],
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  label: { flex: 1 },
});
