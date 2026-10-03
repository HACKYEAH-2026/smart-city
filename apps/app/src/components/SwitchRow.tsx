import { Pressable, StyleSheet, Switch, View } from "react-native";
import { tapFeedback } from "../lib/haptics";
import { colors, radii, shadows, spacing } from "../theme";
import { Text } from "./Text";

export interface SwitchRowProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

/**
 * White row with a switch on the right (COMPONENTS.md → Checkbox / Switch, "Ustaw jako domyślne"). The whole row is
 * the switch for touch and for screen readers; the drawn Switch is decoration.
 */
export function SwitchRow({ label, value, onChange }: SwitchRowProps) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      aria-checked={value}
      onPressIn={tapFeedback}
      onPress={() => onChange(!value)}
      style={styles.row}
    >
      <Text variant="buttonM" style={styles.label}>
        {label}
      </Text>
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
