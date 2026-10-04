import { Check } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { tapFeedback } from "../lib/haptics";
import { borders, colors, opacity, radii, shadows, sizes, spacing } from "../theme";
import { Icon } from "./Icon";
import { Text } from "./Text";

export interface CheckCardProps {
  label: string;
  /** What the option means, under the label (e.g. what a feature of a place does). */
  description?: string;
  /** Emoji before the label, e.g. a plugin's icon; decoration, not part of the accessible name. */
  emoji?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/**
 * Option switched on or off on its own (COMPONENTS.md → CheckCard), e.g. the features of a new place. RadioCard with
 * a check box instead of the dot: checked shows in the border, the shadow and the filled box, not by color alone.
 */
export function CheckCard({ label, description, emoji, checked, onChange }: CheckCardProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      aria-checked={checked}
      onPressIn={tapFeedback}
      onPress={() => onChange(!checked)}
      style={({ pressed }) => [
        styles.card,
        description ? styles.top : null,
        checked ? styles.checked : styles.idle,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked ? <Icon icon={Check} size={spacing[7]} color="onPrimary" strokeWidth={2.6} /> : null}
      </View>
      <View style={styles.text}>
        <View style={styles.titleRow}>
          {emoji ? (
            <Text variant="button" aria-hidden>
              {emoji}
            </Text>
          ) : null}
          <Text variant="button">{label}</Text>
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
  checked: { borderColor: colors.primary, backgroundColor: colors.surface, ...shadows.selected },
  box: {
    width: sizes.radioDot,
    height: sizes.radioDot,
    borderRadius: radii.xs,
    borderWidth: borders.selected,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  boxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  text: { flex: 1, gap: spacing[1] },
  titleRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing[4] },
});
