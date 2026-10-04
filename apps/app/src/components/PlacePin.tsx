import type { LucideIcon } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { borders, colors, radii, shadows, sizes, spacing } from "../theme";
import { Icon } from "./Icon";

export interface PlacePinProps {
  /** The kind of place's icon (lib/placeKinds.ts). */
  icon: LucideIcon;
}

/**
 * The pin of a place over a map (COMPONENTS.md → PlacePin): a red circle with the kind's icon on a short stem, for the
 * place being placed or the current one behind the dashboard. Laid out so that the stem's tip is at the centre of its
 * parent; not interactive.
 */
export function PlacePin({ icon }: PlacePinProps) {
  return (
    <View pointerEvents="none" style={styles.frame}>
      <View style={styles.pin}>
        <View style={styles.head}>
          <Icon icon={icon} size={sizes.iconM} color="onPrimary" strokeWidth={2} />
        </View>
        <View style={styles.stem} />
      </View>
      <View style={styles.shadow} />
    </View>
  );
}

const HEAD = sizes.iconBoxLg;
const STEM = spacing[7];
const styles = StyleSheet.create({
  // Twice the pin's height, centred: the pin fills the top half, so the stem ends exactly at the centre.
  frame: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center" },
  pin: { alignItems: "center", marginBottom: HEAD + STEM },
  head: {
    width: HEAD,
    height: HEAD,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderWidth: borders.scanner,
    borderColor: colors.surface,
    ...shadows.selected,
  },
  stem: { width: borders.scanner, height: STEM, backgroundColor: colors.primary },
  shadow: {
    position: "absolute",
    width: spacing[8],
    height: spacing[3],
    borderRadius: radii.pill,
    backgroundColor: colors.dot,
    top: "50%",
    marginTop: -spacing[2],
  },
});
