import { Pressable, StyleSheet, View } from "react-native";
import { tapFeedback } from "../lib/haptics";
import { colors, opacity, radii, shadows, sizes, spacing } from "../theme";
import { Text } from "./Text";

export interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /**
   * `tabs` (default): the segments switch what the screen shows (tablist/tab). `radio`: a choice that is kept, e.g. a
   * setting (radiogroup/radio, named by `label`).
   */
  kind?: "tabs" | "radio";
  /** The group's accessible name. */
  label?: string;
  /** Shown dimmed and not pressable (e.g. while the choice is being saved). */
  disabled?: boolean;
}

/** Two or more options side by side, one selected (COMPONENTS.md → SegmentedControl). */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  kind = "tabs",
  label,
  disabled = false,
}: SegmentedControlProps<T>) {
  const radio = kind === "radio";
  return (
    <View role={radio ? "radiogroup" : "tablist"} aria-label={label} style={styles.track}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            role={radio ? "radio" : "tab"}
            aria-selected={radio ? undefined : selected}
            aria-checked={radio ? selected : undefined}
            accessibilityRole={radio ? "radio" : "tab"}
            accessibilityLabel={option.label}
            accessibilityState={radio ? { checked: selected, disabled } : { selected, disabled }}
            disabled={disabled}
            onPressIn={radio ? tapFeedback : undefined}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.segment,
              selected && styles.selected,
              pressed && { opacity: opacity.pressed },
              disabled && { opacity: opacity.disabled },
            ]}
          >
            <Text variant="buttonM" color={selected ? "text" : "textSecondary"}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    padding: spacing[2],
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceSunken,
  },
  segment: {
    flex: 1,
    height: sizes.buttonXs,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  selected: { backgroundColor: colors.surface, ...shadows.card },
});
