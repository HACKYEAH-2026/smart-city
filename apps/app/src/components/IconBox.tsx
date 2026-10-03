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
}

/** Rounded square with an accent icon (COMPONENTS.md → IconBox): `primaryTint` background, `primary` icon. */
export function IconBox({ icon, size = sizes.iconBox, selected = false }: IconBoxProps) {
  return (
    <View style={[styles.box, { width: size, height: size }, selected && styles.selected]}>
      <Icon icon={icon} color={selected ? "onPrimary" : "primary"} />
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
  selected: { backgroundColor: colors.primary },
});
