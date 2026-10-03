import type { LucideIcon } from "lucide-react-native";
import { ChevronRight } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { colors, opacity, radii, shadows, sizes, spacing } from "../theme";
import { Icon } from "./Icon";
import { Text } from "./Text";

export interface ActionRowProps {
  icon: LucideIcon;
  title: string;
  /** Caption under the title. */
  hint: string;
  onPress: () => void;
}

/** A way to do something, as a white row with a red icon tile (COMPONENTS.md → ActionRow). */
export function ActionRow({ icon, title, hint, onPress }: ActionRowProps) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: opacity.pressed }]}
    >
      <View style={styles.tile}>
        <Icon icon={icon} size={spacing[9]} color="primary" />
      </View>
      <View style={styles.body}>
        <Text variant="button">{title}</Text>
        <Text variant="caption" color="textSecondary">
          {hint}
        </Text>
      </View>
      <Icon icon={ChevronRight} size={spacing[8] + spacing[1]} color="iconMuted" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[7],
    paddingVertical: spacing[6],
    paddingHorizontal: spacing[7],
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  tile: {
    width: sizes.iconBox,
    height: sizes.iconBox,
    borderRadius: radii.md,
    backgroundColor: colors.primaryTint,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, gap: spacing[1] },
});
