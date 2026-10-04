import { Link as RouterLink } from "expo-router";
import { Plus } from "lucide-react-native";
import { Pressable, StyleSheet } from "react-native";
import { tapFeedback } from "../lib/haptics";
import { usePressed } from "../lib/pressed";
import { borders, colors, opacity, radii, sizes, spacing } from "../theme";
import { AccentGradient } from "./AccentGradient";
import { Icon } from "./Icon";
import { Text } from "./Text";

export interface CreateRowProps {
  label: string;
  /** Route the row opens. */
  href: string;
}

/** Dashed row with a red plus that starts creating something (COMPONENTS.md → CreateRow). A link on the web. */
export function CreateRow({ label, href }: CreateRowProps) {
  const press = usePressed(tapFeedback);
  return (
    <RouterLink href={href as never} asChild>
      <Pressable
        accessibilityRole="link"
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={StyleSheet.flatten([styles.row, press.pressed && styles.pressed])}
      >
        <AccentGradient style={styles.plus}>
          <Icon icon={Plus} color="onPrimary" strokeWidth={2.2} />
        </AccentGradient>
        <Text variant="cardTitle">{label}</Text>
      </Pressable>
    </RouterLink>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: opacity.pressed },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[7],
    padding: spacing[8],
    borderRadius: radii["2xl"],
    borderWidth: borders.row,
    borderStyle: "dashed",
    borderColor: colors.dashed,
  },
  plus: {
    width: sizes.iconBox,
    height: sizes.iconBox,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});
