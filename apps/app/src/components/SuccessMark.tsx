import { Check } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { colors, radii, sizes } from "../theme";
import { Icon } from "./Icon";

/** Red circle with a check in a light ring (COMPONENTS.md → SuccessMark). Decoration: the heading says what happened. */
export function SuccessMark() {
  return (
    <View style={styles.ring} aria-hidden>
      <View style={styles.mark}>
        <Icon icon={Check} size={sizes.successIcon} color="onPrimary" strokeWidth={2.6} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    width: sizes.successRing,
    height: sizes.successRing,
    borderRadius: radii.pill,
    backgroundColor: colors.primaryTint,
    alignItems: "center",
    justifyContent: "center",
  },
  mark: {
    width: sizes.successMark,
    height: sizes.successMark,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});
