import type { LucideIcon } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { colors, radii, sizes, type TypographyToken } from "../theme";
import { Icon } from "./Icon";
import { Text } from "./Text";

type IconBoxSize = "sm" | "md" | "xl";

export interface IconBoxProps {
  /** A line icon, or an emoji (a plugin's icon: decoration, hidden from screen readers). */
  icon: LucideIcon | string;
  /** sm 40 (list rows, choice cards) · md 44 (default) · xl 52 radius 16 (a plugin's catalog card). */
  size?: IconBoxSize;
  /** Selected variant: `primary` background, white icon (e.g. the chosen kind of place). */
  selected?: boolean;
  /** Neutral variant: `surfaceSunken` background, `text` icon (e.g. a closed section of "Zarządzaj miejscem"). */
  neutral?: boolean;
  /** Dark variant: `text` background, white icon (a plugin's admin row that needs attention). */
  dark?: boolean;
}

const BOX: Record<IconBoxSize, { side: number; radius: number; emoji: TypographyToken }> = {
  sm: { side: sizes.iconBoxSm, radius: radii.md, emoji: "emojiM" },
  md: { side: sizes.iconBox, radius: radii.md, emoji: "emojiM" },
  xl: { side: sizes.iconBoxXl, radius: radii.xl, emoji: "emojiL" },
};

/** Rounded square with an accent icon (COMPONENTS.md → IconBox): `primaryTint` background, `primary` icon. */
export function IconBox({ icon, size = "md", selected = false, neutral = false, dark = false }: IconBoxProps) {
  const box = BOX[size];
  return (
    <View
      style={[
        styles.box,
        { width: box.side, height: box.side, borderRadius: box.radius },
        neutral && styles.neutral,
        selected && styles.selected,
        dark && styles.dark,
      ]}
    >
      {typeof icon === "string" ? (
        <Text variant={box.emoji} aria-hidden>
          {icon}
        </Text>
      ) : (
        <Icon icon={icon} color={selected || dark ? "onPrimary" : neutral ? "text" : "primary"} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.primaryTint,
    alignItems: "center",
    justifyContent: "center",
  },
  neutral: { backgroundColor: colors.surfaceSunken },
  selected: { backgroundColor: colors.primary },
  dark: { backgroundColor: colors.text },
});
