import type { LucideIcon } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { colors, radii, sizes } from "../theme";
import { Icon } from "./Icon";

export interface IconBoxProps {
  icon: LucideIcon;
}

/** Rounded square with an accent icon (COMPONENTS.md → IconBox): 44 dp, `primaryTint` background, `primary` icon. */
export function IconBox({ icon }: IconBoxProps) {
  return (
    <View style={styles.box}>
      <Icon icon={icon} color="primary" />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: sizes.iconBox,
    height: sizes.iconBox,
    borderRadius: radii.md,
    backgroundColor: colors.primaryTint,
    alignItems: "center",
    justifyContent: "center",
  },
});
