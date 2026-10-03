import { INVITE_CODE_ALPHABET, INVITE_CODE_LENGTH } from "@app/shared";
import { Fragment, useRef, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { borders, colors, radii, shadows, sizes, spacing, typography } from "../theme";

export interface OtpInputProps {
  /** The code typed so far (up to INVITE_CODE_LENGTH characters). */
  value: string;
  onChange: (code: string) => void;
  /** Accessible name of the cells; each cell is named "<label> <number>". */
  label: string;
}

/**
 * Invite code in six cells with a dash after the third (COMPONENTS.md → OtpInput). Typing moves on to the next
 * cell, backspace moves back, and a pasted code fills the cells from the one it was pasted into.
 */
export function OtpInput({ value, onChange, label }: OtpInputProps) {
  const cells = useRef<(TextInput | null)[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const chars = Array.from({ length: INVITE_CODE_LENGTH }, (_, i) => value[i] ?? "");

  const focus = (index: number) => cells.current[Math.min(index, INVITE_CODE_LENGTH - 1)]?.focus();

  const write = (index: number, text: string) => {
    const typed = [...text.toUpperCase()].filter((ch) => INVITE_CODE_ALPHABET.includes(ch));
    const next = [...chars];
    if (typed.length === 0) next[index] = "";
    typed.forEach((ch, offset) => {
      if (index + offset < INVITE_CODE_LENGTH) next[index + offset] = ch;
    });
    onChange(next.join(""));
    if (typed.length > 0) focus(index + typed.length);
  };

  const backspace = (index: number) => {
    if (chars[index] !== "" || index === 0) return;
    const next = [...chars];
    next[index - 1] = "";
    onChange(next.join(""));
    focus(index - 1);
  };

  return (
    <View style={styles.row}>
      {chars.map((ch, index) => {
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: the six cells are fixed positions, the index is their identity
          <Fragment key={index}>
            {index === INVITE_CODE_LENGTH / 2 ? <View style={styles.dash} /> : null}
            <TextInput
              ref={(cell) => {
                cells.current[index] = cell;
              }}
              aria-label={`${label} ${index + 1}`}
              value={ch}
              onChangeText={(text) => write(index, text)}
              onKeyPress={(event) => {
                if (event.nativeEvent.key === "Backspace") backspace(index);
              }}
              onFocus={() => setActive(index)}
              onBlur={() => setActive(null)}
              autoCapitalize="characters"
              autoCorrect={false}
              autoComplete="off"
              style={[styles.cell, ch ? styles.filled : styles.empty, active === index && styles.active]}
            />
          </Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing[3] },
  cell: {
    flex: 1,
    minWidth: 0,
    height: sizes.otpCell,
    borderRadius: radii.lg,
    borderWidth: borders.hairline,
    textAlign: "center",
    padding: 0,
    ...typography.otp,
    color: colors.text,
  },
  filled: { backgroundColor: colors.surface, borderColor: colors.border, ...shadows.card },
  empty: { backgroundColor: colors.surfaceDisabled, borderColor: colors.borderEmpty },
  active: { borderWidth: borders.selected, borderColor: colors.primary, ...shadows.focusRing },
  dash: { width: spacing[5], height: borders.selected, borderRadius: borders.hairline, backgroundColor: colors.dot },
});
