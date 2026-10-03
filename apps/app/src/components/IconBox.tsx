import type { LucideIcon } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { colors, radii, sizes } from "../theme";
import { Icon } from "./Icon";

export interface IconBoxProps {
  icon: LucideIcon;
  /** Side in dp (default 44). */
  size?: number;
  /** Selected variant: `primary` background, white icon (e.g. the chosen kind of place). */
  selected?: boolean;
  /** Neutral variant: `surfaceSunken` background, `text` icon (e.g. a closed section of "Zarządzaj miejscem"). */
  neutral?: boolean;
}

/** Rounded square with an accent icon (COMPONENTS.md → IconBox): `primaryTint` background, `primary` icon. */
export function IconBox({ icon, size = sizes.iconBox, selected = false, neutral = false }: IconBoxProps) {
  return (
    <View style={[styles.box, { width: size, height: size }, neutral && styles.neutral, selected && styles.selected]}>
      <Icon icon={icon} color={selected ? "onPrimary" : neutral ? "text" : "primary"} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: radii.md,
    backgroundColor: colors.primaryTint,
    alignItems: "center",
    justifyContent: "center",
  },
  neutral: { backgroundColor: colors.surfaceSunken },
  selected: { backgroundColor: colors.primary },
});
