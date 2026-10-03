import { Check } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { tapFeedback } from "../lib/haptics";
import { borders, colors, opacity, radii, spacing } from "../theme";
import { Icon } from "./Icon";
import { Text } from "./Text";

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Label text; also the accessible name of the checkbox. */
  label: string;
}

/** Checkbox with a text label (COMPONENTS.md → Checkbox): 20 px box, primary when checked, label aligned to the top. */
export function Checkbox({ checked, onChange, label }: CheckboxProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPressIn={tapFeedback}
      onPress={() => onChange(!checked)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked ? <Icon icon={Check} size={spacing[7]} color="onPrimary" strokeWidth={2.6} /> : null}
      </View>
      <Text variant="caption" color="textBody" style={styles.label}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: opacity.pressed },
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing[6] },
  box: {
    width: spacing[9],
    height: spacing[9],
    borderRadius: radii.xs,
    borderWidth: borders.hairline,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  boxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  label: { flex: 1 },
});
