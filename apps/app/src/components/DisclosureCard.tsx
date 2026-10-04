import { ChevronDown, ChevronUp, type LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { tapFeedback } from "../lib/haptics";
import { borders, colors, radii, shadows, sizes, spacing } from "../theme";
import { Icon } from "./Icon";
import { IconBox } from "./IconBox";
import { Text } from "./Text";

export interface DisclosureCardProps {
  icon: LucideIcon;
  title: string;
  /** One line under the title: what the section holds, e.g. "8 osób · 2 administratorów". */
  summary: string;
  open: boolean;
  onToggle: () => void;
  /** The section's content, shown under the header while open. */
  children: ReactNode;
  /** Content without the body's padding and gap: rows that reach the card's edges, each with its own padding. */
  flush?: boolean;
}

/**
 * A section that opens in place (COMPONENTS.md → DisclosureCard; design E-ZarzadzanieMiejscem): icon box, title,
 * summary and a chevron. Open, the icon box turns `primary`, the chevron sits in a circle and the content shows
 * under a hairline. The header is the button (named by the title, `aria-expanded`), so not only color tells.
 */
export function DisclosureCard({ icon, title, summary, open, onToggle, children, flush = false }: DisclosureCardProps) {
  return (
    <View style={[styles.card, open && styles.open]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        aria-expanded={open}
        onPressIn={tapFeedback}
        onPress={onToggle}
        style={styles.head}
      >
        <IconBox icon={icon} selected={open} neutral={!open} />
        <View style={styles.text}>
          <Text variant="cardTitle">{title}</Text>
          <Text variant="small" color="textSecondary">
            {summary}
          </Text>
        </View>
        <View style={[styles.chevron, open && styles.chevronOpen]}>
          <Icon icon={open ? ChevronUp : ChevronDown} size={sizes.iconS} color={open ? "text" : "textSecondary"} />
        </View>
      </Pressable>
      {open ? <View style={[styles.body, !flush && styles.padded]}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radii["3xl"], ...shadows.card },
  open: shadows.cardRaised,
  head: { flexDirection: "row", alignItems: "center", gap: spacing[7], padding: spacing[8] },
  text: { flex: 1, gap: spacing[1] },
  chevron: {
    width: sizes.iconButton,
    height: sizes.iconButton,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  chevronOpen: { backgroundColor: colors.surfaceSunken },
  body: { borderTopWidth: borders.hairline, borderTopColor: colors.borderSubtle },
  padded: { gap: spacing[7], padding: spacing[8] },
});
