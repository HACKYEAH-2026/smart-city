import { StyleSheet, View } from "react-native";
import { type ColorToken, colors, radii, spacing } from "../theme";
import { Text } from "./Text";

export type BadgeTone = "neutral" | "accent";

const TONE: Record<BadgeTone, { bg: ColorToken; fg: ColorToken }> = {
  neutral: { bg: "surfaceMuted", fg: "textSecondary" },
  accent: { bg: "primaryTint", fg: "primaryPressed" },
};

export interface BadgeProps {
  text: string;
  tone?: BadgeTone;
}

/** Small uppercase chip (COMPONENTS.md → RoleBadge). Accent uses primaryPressed on primaryTint for contrast. */
export function Badge({ text, tone = "neutral" }: BadgeProps) {
  const palette = TONE[tone];
  return (
    <View style={[styles.badge, { backgroundColor: colors[palette.bg] }]}>
      <Text variant="chip" color={palette.fg}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    borderRadius: radii.xs,
    paddingVertical: spacing[1],
    paddingHorizontal: spacing[4],
  },
});
