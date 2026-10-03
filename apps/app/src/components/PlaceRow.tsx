import type { MyPlace } from "@app/shared";
import { Pressable, StyleSheet, View } from "react-native";
import { placeAbbr } from "../lib/places";
import { t } from "../texts";
import { borders, colors, radii, shadows, sizes, spacing } from "../theme";
import { Badge } from "./Badge";
import { Text } from "./Text";

export interface PlaceRowProps {
  place: MyPlace;
  active: boolean;
  onPress: () => void;
}

/** A place in a list (COMPONENTS.md → PlaceRow): abbreviation, name, role; the active place has a red frame. */
export function PlaceRow({ place, active, onPress }: PlaceRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${place.name}, ${place.role === "admin" ? t.place_role_admin : t.place_role_member}`}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.row, active ? styles.active : styles.idle]}
    >
      <View style={styles.avatar}>
        <Text variant="abbr" color="primary">
          {placeAbbr(place.name)}
        </Text>
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text variant="button">{place.name}</Text>
          {place.isDefault ? <Badge text={t.place_default_badge} tone="accent" /> : null}
        </View>
        <Text variant="small" color="textSecondary">
          {place.role === "admin" ? t.place_role_admin : t.place_role_member}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[7],
    paddingVertical: spacing[5],
    paddingLeft: spacing[5],
    paddingRight: spacing[7],
    borderRadius: radii.xl,
    borderWidth: borders.row,
    backgroundColor: colors.surface,
  },
  active: { borderColor: colors.primary, ...shadows.selected },
  idle: { borderColor: "transparent", ...shadows.card },
  avatar: {
    width: sizes.iconBox,
    height: sizes.iconBox,
    borderRadius: radii.md,
    backgroundColor: colors.primaryTint,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, gap: spacing[1] },
  titleRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing[4] },
});
