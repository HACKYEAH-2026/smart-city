import type { MyPlace } from "@app/shared";
import { Check, CircleStar } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { tapFeedback } from "../lib/haptics";
import { placeKindLabel } from "../lib/placeKinds";
import { initials } from "../lib/places";
import { t } from "../texts";
import { borders, colors, opacity, radii, shadows, sizes, spacing } from "../theme";
import { Badge } from "./Badge";
import { Icon } from "./Icon";
import { Text } from "./Text";

export interface PlaceRowProps {
  place: MyPlace;
  active: boolean;
  onPress: () => void;
}

/**
 * A place in the switcher (COMPONENTS.md → PlaceRow): abbreviation, name, kind of place; the active place has a red
 * frame and a check. A star in a circle (like a sheriff's badge) left of the name marks a place the user administers.
 */
export function PlaceRow({ place, active, onPress }: PlaceRowProps) {
  const admin = place.role === "admin";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[place.name, admin && t.role_admin, placeKindLabel(place.kind)].filter(Boolean).join(", ")}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      onPressIn={tapFeedback}
      style={({ pressed }) => [styles.row, active ? styles.active : styles.idle, pressed && styles.pressed]}
    >
      <View style={styles.avatar}>
        <Text variant="abbr" color="primary">
          {initials(place.name)}
        </Text>
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <View style={styles.name}>
            {admin ? <Icon icon={CircleStar} size={sizes.iconS} color="primary" strokeWidth={2} /> : null}
            <Text variant="button" style={styles.nameText}>
              {place.name}
            </Text>
          </View>
          {place.isDefault ? <Badge text={t.place_default_badge} tone="accent" /> : null}
        </View>
        <Text variant="small" color="textSecondary">
          {placeKindLabel(place.kind)}
        </Text>
      </View>
      {active ? (
        <View style={styles.check}>
          <Icon icon={Check} size={sizes.iconXs} color="onPrimary" strokeWidth={3} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: opacity.pressed },
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
  name: { flexDirection: "row", alignItems: "center", gap: spacing[3], flexShrink: 1 },
  nameText: { flexShrink: 1 },
  check: {
    width: sizes.selectedMark,
    height: sizes.selectedMark,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});
