import type { LucideIcon } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { colors, radii, sizes, spacing } from "../theme";
import { IconButton } from "./IconButton";
import { Text } from "./Text";

export interface StepHeaderProps {
  /** 1-based step and the number of steps. */
  step: number;
  total: number;
  /** "Krok N z M". */
  label: string;
  /** Back on later steps; cancel (X) on the first one. */
  backIcon: LucideIcon;
  backLabel: string;
  onBack: () => void;
}

/** Header of a multi-step form (COMPONENTS.md → ScreenHeader, step variant): back, StepProgress, "Krok N z M". */
export function StepHeader({ step, total, label, backIcon, backLabel, onBack }: StepHeaderProps) {
  return (
    <View style={styles.row}>
      <IconButton icon={backIcon} label={backLabel} onPress={onBack} />
      <View style={styles.progress} aria-hidden>
        {Array.from({ length: total }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed number of identical segments
          <View key={i} style={[styles.segment, i < step && styles.done]} />
        ))}
      </View>
      <Text variant="stepNumber" color="textSecondary">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing[8] },
  progress: { flex: 1, flexDirection: "row", gap: spacing[3] },
  segment: { flex: 1, height: sizes.stepBarHeight, borderRadius: radii.pill, backgroundColor: colors.border },
  done: { backgroundColor: colors.primary },
});
