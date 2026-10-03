import type { ReactNode } from "react";
import { Pressable, type PressableProps, StyleSheet, View, type ViewStyle } from "react-native";
import { tapFeedback } from "../lib/haptics";
import { colors, opacity, radii, sizes, spacing } from "../theme";
import { Text } from "./Text";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "tint"
  | "dark"
  | "onDark"
  | "ghost"
  | "ghostOnDark"
  | "destructiveGhost";
type ButtonSize = "lg" | "md" | "sm" | "xs";

export interface ButtonProps extends Omit<PressableProps, "children" | "style"> {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: ReactNode;
  /** Stretch to the container width (default). Use false for buttons inside a row. */
  fullWidth?: boolean;
  style?: ViewStyle;
}

const HEIGHT: Record<ButtonSize, number> = {
  lg: sizes.buttonLg,
  md: sizes.buttonMd,
  sm: sizes.buttonSm,
  xs: sizes.buttonXs,
};

const RADIUS: Record<ButtonSize, number> = {
  lg: radii.lg,
  md: radii.lg,
  sm: radii.md,
  xs: radii.md,
};

const VARIANT: Record<ButtonVariant, { bg: string; border?: string; fg: string; pressedBg: string }> = {
  primary: { bg: colors.primary, fg: colors.onPrimary, pressedBg: colors.primaryPressed },
  secondary: { bg: colors.surface, border: colors.border, fg: colors.text, pressedBg: colors.surfaceSunken },
  tint: { bg: colors.background, fg: colors.text, pressedBg: colors.surfaceMuted },
  dark: { bg: colors.text, fg: colors.surface, pressedBg: colors.textBody },
  onDark: { bg: colors.surface, fg: colors.text, pressedBg: colors.surfaceSunken },
  ghost: { bg: "transparent", fg: colors.text, pressedBg: colors.surfaceSunken },
  ghostOnDark: { bg: colors.onDarkOverlay, fg: colors.onPrimary, pressedBg: colors.onPrimaryOverlay },
  destructiveGhost: { bg: "transparent", fg: colors.primaryPressed, pressedBg: colors.primaryTint },
};

/**
 * Button from the design system (see COMPONENTS.md → Button). Exposes role=button and the label as its name.
 * A press gives a light haptic tick.
 */
export function Button({
  label,
  variant = "primary",
  size = "lg",
  leftIcon,
  fullWidth = true,
  disabled,
  style,
  onPressIn,
  ...rest
}: ButtonProps) {
  const v = VARIANT[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPressIn={(event) => {
        tapFeedback();
        onPressIn?.(event);
      }}
      style={({ pressed }) => [
        styles.base,
        {
          height: HEIGHT[size],
          borderRadius: RADIUS[size],
          backgroundColor: pressed ? v.pressedBg : v.bg,
          borderColor: v.border ?? "transparent",
          borderWidth: v.border ? 1 : 0,
          alignSelf: fullWidth ? "stretch" : "flex-start",
          paddingHorizontal: size === "xs" || !fullWidth ? spacing[6] : spacing[8],
          opacity: disabled ? opacity.disabled : 1,
        },
        style,
      ]}
      {...rest}
    >
      {leftIcon ? <View style={styles.icon}>{leftIcon}</View> : null}
      <Text
        variant={size === "lg" ? "button" : size === "md" || size === "sm" ? "buttonM" : "buttonS"}
        style={{ color: v.fg }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  icon: { marginRight: spacing[4] },
});
