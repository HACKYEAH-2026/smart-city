import { useState } from "react";
import { StyleSheet, TextInput, type TextInputProps, View } from "react-native";
import { borders, colors, radii, shadows, sizes, spacing, typography } from "../theme";
import { Text } from "./Text";

export interface TextFieldProps extends TextInputProps {
  /** Eyebrow label above the field; also the accessible name of the input. */
  label: string;
  multiline?: boolean;
}

/** Text field with an eyebrow label (COMPONENTS.md → TextField). Focus: 2 px primary border + soft red glow. */
export function TextField({ label, multiline, style, onFocus, onBlur, ...rest }: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      <Text variant="label" color="textSecondary">
        {label}
      </Text>
      <TextInput
        aria-label={label}
        placeholderTextColor={colors.placeholder}
        multiline={multiline}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          styles.input,
          multiline && styles.multiline,
          focused && styles.focused,
          focused && shadows.focusRing,
          style,
        ]}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing[3] },
  input: {
    ...typography.input,
    height: sizes.input,
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: borders.hairline,
    borderColor: colors.border,
    paddingHorizontal: spacing[8],
  },
  // Focused border is 2 px, so horizontal padding shrinks by the same 1 px to keep the text in place.
  focused: {
    borderWidth: borders.selected,
    borderColor: colors.primary,
    paddingHorizontal: spacing[8] - (borders.selected - borders.hairline),
  },
  multiline: {
    height: undefined,
    minHeight: typography.input.lineHeight * 3 + spacing[7] * 2,
    paddingVertical: spacing[7],
    textAlignVertical: "top",
  },
});
