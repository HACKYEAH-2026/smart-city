import { Pressable, StyleSheet, View } from "react-native";
import { colors, opacity, radii, shadows, sizes, spacing } from "../theme";
import { Text } from "./Text";

export interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

/** Two or more options side by side, one selected (COMPONENTS.md → SegmentedControl). */
export function SegmentedControl<T extends string>({ options, value, onChange }: SegmentedControlProps<T>) {
  return (
    <View role="tablist" style={styles.track}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            role="tab"
            aria-selected={selected}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.segment,
              selected && styles.selected,
              pressed && { opacity: opacity.pressed },
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
    height: sizes.buttonSm,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  selected: { backgroundColor: colors.surface, ...shadows.card },
});
