import { Link as RouterLink } from "expo-router";
import { Plus } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { tapFeedback } from "../lib/haptics";
import { borders, colors, radii, sizes, spacing } from "../theme";
import { Icon } from "./Icon";
import { Text } from "./Text";

export interface CreateRowProps {
  label: string;
  /** Route the row opens. */
  href: string;
}

/** Dashed row with a red plus that starts creating something (COMPONENTS.md → CreateRow). A link on the web. */
export function CreateRow({ label, href }: CreateRowProps) {
  return (
    <RouterLink href={href as never} asChild>
      <Pressable accessibilityRole="link" onPressIn={tapFeedback} style={styles.row}>
        <View style={styles.plus}>
          <Icon icon={Plus} color="onPrimary" strokeWidth={2.2} />
        </View>
        <Text variant="cardTitle">{label}</Text>
      </Pressable>
    </RouterLink>
  );
}

const styles = StyleSheet.create({
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
