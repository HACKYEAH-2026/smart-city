import { ShieldCheck } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { colors, radii, shadows, sizes, spacing } from "../theme";
import { Icon } from "./Icon";
import { Text } from "./Text";

export interface StatusPillProps {
  text: string;
}

/** White pill with a shield (COMPONENTS.md → StatusPill), e.g. "Jesteś administratorem". */
export function StatusPill({ text }: StatusPillProps) {
  return (
    <View style={styles.pill}>
      <Icon icon={ShieldCheck} size={sizes.iconXs} color="primary" strokeWidth={2.4} />
      <Text variant="buttonS">{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: spacing[3],
    height: sizes.statusPill,
    paddingHorizontal: spacing[6],
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
});
