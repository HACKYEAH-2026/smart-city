import { Pressable, StyleSheet, View } from "react-native";
import { tapFeedback } from "../lib/haptics";
import { colors, opacity, radii, shadows, sizes, spacing } from "../theme";
import { Text } from "./Text";

export interface SwitchRowProps {
  label: string;
  /** Short text under the label (e.g. what the switch changes). */
  hint?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  /** A row inside a white group (no card of its own): the group draws the background and the lines. */
  flush?: boolean;
  disabled?: boolean;
}

/**
 * White row with a switch on the right (COMPONENTS.md → Checkbox / Switch, "Ustaw jako domyślne"). The whole row is
 * the switch for touch and for screen readers; the drawn Switch is decoration.
 */
export function SwitchRow({ label, hint, value, onChange, flush = false, disabled = false }: SwitchRowProps) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      aria-checked={value}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPressIn={tapFeedback}
      onPress={() => onChange(!value)}
      style={({ pressed }) => [
        styles.row,
        !flush && styles.card,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <View style={styles.label}>
        <Text variant="buttonM">{label}</Text>
        {hint ? (
          <Text variant="small" color="textSecondary">
            {hint}
          </Text>
        ) : null}
      </View>
      <View pointerEvents="none" aria-hidden style={[styles.track, value && styles.trackOn]}>
        <View style={[styles.knob, value && styles.knobOn]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: opacity.pressed },
  disabled: { opacity: opacity.disabled },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[6],
    paddingVertical: spacing[7],
    paddingHorizontal: spacing[8],
  },
  card: { borderRadius: radii.xl, backgroundColor: colors.surface, ...shadows.card },
  label: { flex: 1 },
  track: {
    width: sizes.switchTrack,
    height: sizes.switchHeight,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
    justifyContent: "center",
    paddingHorizontal: spacing[3] / 2,
    flexShrink: 0,
  },
  trackOn: { backgroundColor: colors.primary },
  knob: {
    width: sizes.switchKnob,
    height: sizes.switchKnob,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  knobOn: { alignSelf: "flex-end" },
});
