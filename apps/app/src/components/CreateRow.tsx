import { Plus } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { borders, colors, opacity, radii, sizes, spacing } from "../theme";
import { Icon } from "./Icon";
import { Text } from "./Text";

export interface CreateRowProps {
  label: string;
  onPress: () => void;
}

/** Dashed row with a red plus button: create something new (COMPONENTS.md → CreateRow). */
export function CreateRow({ label, onPress }: CreateRowProps) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: opacity.pressed }]}
    >
      <View style={styles.plus}>
        <Icon icon={Plus} size={sizes.tabIcon} color="onPrimary" strokeWidth={2.2} />
      </View>
      <Text variant="button">{label}</Text>
    </Pressable>
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
    width: sizes.iconButton,
    height: sizes.iconButton,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});
