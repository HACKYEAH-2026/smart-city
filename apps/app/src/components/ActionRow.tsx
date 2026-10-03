import { Link as RouterLink } from "expo-router";
import { ChevronRight, type LucideIcon } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { tapFeedback } from "../lib/haptics";
import { colors, radii, shadows, sizes, spacing } from "../theme";
import { Icon } from "./Icon";
import { IconBox } from "./IconBox";
import { Text } from "./Text";

export interface ActionRowProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  /** Route the row opens. */
  href: string;
}

/** Row that opens a screen (COMPONENTS.md → ActionRow): icon box, title over subtitle, chevron. A link on the web. */
export function ActionRow({ icon, title, subtitle, href }: ActionRowProps) {
  return (
    <RouterLink href={href as never} asChild>
      <Pressable accessibilityRole="link" onPressIn={tapFeedback} style={styles.row}>
        <IconBox icon={icon} />
        <View style={styles.body}>
          <Text variant="cardTitle">{title}</Text>
          <Text variant="caption" color="textSecondary">
            {subtitle}
          </Text>
        </View>
        <Icon icon={ChevronRight} size={sizes.iconS} color="iconMuted" strokeWidth={2} />
      </Pressable>
    </RouterLink>
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
  body: { flex: 1, gap: spacing[1] },
});
