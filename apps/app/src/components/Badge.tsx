import type { LucideIcon } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { type ColorToken, colors, radii, sizes, spacing } from "../theme";
import { Icon } from "./Icon";
import { Text } from "./Text";

export type BadgeTone = "neutral" | "accent" | "info" | "warning" | "success";

const TONE: Record<BadgeTone, { bg: ColorToken; fg: ColorToken }> = {
  neutral: { bg: "surfaceMuted", fg: "textSecondary" },
  accent: { bg: "primaryTint", fg: "primaryPressed" },
  info: { bg: "infoTint", fg: "infoText" },
  warning: { bg: "warningTint", fg: "warningText" },
  success: { bg: "successTint", fg: "successText" },
};

export interface BadgeProps {
  text: string;
  tone?: BadgeTone;
  /** A small icon before the text (a list card's tag: "Problem", "Sugestia"). */
  icon?: LucideIcon;
  /** A dot before the text, in the text colour (a status: "Nowe", "Przyjęte"). */
  dot?: boolean;
}

/**
 * Small badge (COMPONENTS.md → RoleBadge). Accent uses primaryPressed on primaryTint for contrast. A list card's tag
 * adds an icon or a dot and sits in a fixed-height pill; the plain badge stays a small chip.
 */
export function Badge({ text, tone = "neutral", icon, dot = false }: BadgeProps) {
  const palette = TONE[tone];
  const tag = icon !== undefined || dot;
  return (
    <View style={[styles.badge, tag && styles.tag, { backgroundColor: colors[palette.bg] }]}>
      {dot ? <View style={[styles.dot, { backgroundColor: colors[palette.fg] }]} /> : null}
      {icon ? <Icon icon={icon} size={sizes.iconXs} color={palette.fg} strokeWidth={2.2} /> : null}
      <Text variant={tag ? "tag" : "chip"} color={palette.fg}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radii.xs,
    paddingVertical: spacing[1],
    paddingHorizontal: spacing[4],
  },
  tag: {
    height: sizes.tagHeight,
    borderRadius: radii.md,
    paddingVertical: 0,
    paddingHorizontal: spacing[4],
    gap: spacing[2],
  },
  dot: { width: sizes.tagDot, height: sizes.tagDot, borderRadius: sizes.tagDot / 2 },
});
