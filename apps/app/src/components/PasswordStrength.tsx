import { StyleSheet, View } from "react-native";
import { type PasswordCheck, passwordStrength } from "../lib/passwordStrength";
import { t } from "../texts";
import { spacing } from "../theme";
import { SegmentedProgress } from "./SegmentedProgress";
import { Text } from "./Text";

/**
 * Four-segment password meter (COMPONENTS.md → PasswordStrength): fills as the password approaches the minimum
 * length, with a hint until it is met.
 */
export function PasswordStrength({ password }: { password: string }) {
  const { score, missing } = passwordStrength(password);
  const hints: Record<PasswordCheck, string> = {
    length: t.pw_hint_length,
  };
  return (
    <View style={styles.wrap}>
      <SegmentedProgress value={score} segments={4} gap={spacing[2]} />
      <Text variant="small" color="textSecondary">
        {missing ? hints[missing] : t.pw_ok}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing[3] },
});
