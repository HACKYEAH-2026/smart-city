import type { LucideIcon } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { sizes, spacing } from "../theme";
import { IconButton } from "./IconButton";
import { SegmentedProgress } from "./SegmentedProgress";
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

/**
 * Header of a multi-step form (COMPONENTS.md → ScreenHeader, step variant): back, StepProgress, "Krok N z M".
 * Keep it mounted across steps (one element above the steps) so the progress animates from step to step.
 */
export function StepHeader({ step, total, label, backIcon, backLabel, onBack }: StepHeaderProps) {
  return (
    <View style={styles.row}>
      <View style={styles.back}>
        <IconButton variant="plain" icon={backIcon} label={backLabel} onPress={onBack} />
      </View>
      <View style={styles.progress}>
        <SegmentedProgress value={step} segments={total} />
      </View>
      <Text variant="stepNumber" color="textSecondary">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing[8] },
  // The plain button keeps its 44 dp touch target; pull it out by the padding around its icon so the icon lines up
  // with the screen edge (like the title below) and sits `gap` away from the progress.
  back: { marginHorizontal: -(sizes.iconButton - sizes.iconM) / 2 },
  progress: { flex: 1 },
});
