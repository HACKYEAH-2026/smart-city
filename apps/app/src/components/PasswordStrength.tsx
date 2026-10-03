import { StyleSheet, View } from "react-native";
import { type PasswordCheck, passwordStrength } from "../lib/passwordStrength";
import { t } from "../texts";
import { borders, colors, radii, sizes, spacing } from "../theme";
import { Text } from "./Text";

/** One step per segment; a segment is filled when its step is reached by the score. */
const STEPS = [1, 2, 3, 4];

/** Four-segment password meter with a hint for the first missing check (COMPONENTS.md → PasswordStrength). */
export function PasswordStrength({ password }: { password: string }) {
  const { score, missing } = passwordStrength(password);
  const hints: Record<PasswordCheck, string> = {
    length: t.pw_hint_length,
    digit: t.pw_hint_digit,
    case: t.pw_hint_case,
    symbol: t.pw_hint_symbol,
  };
  return (
    <View style={styles.wrap}>
      <View aria-hidden style={styles.segments}>
        {STEPS.map((step) => (
          <View key={step} style={[styles.segment, step <= score && styles.filled]} />
        ))}
      </View>
      <Text variant="small" color="textSecondary">
        {missing ? hints[missing] : t.pw_strong}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing[3] },
  segments: { flexDirection: "row", gap: spacing[1] },
  segment: {
    flex: 1,
    height: sizes.stepBarHeight,
    borderRadius: sizes.stepBarHeight / 2,
    backgroundColor: colors.border,
  },
  filled: { backgroundColor: colors.primary },
});
