import { type Href, Link as RouterLink } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, type PressableProps, type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";
import { tapFeedback } from "../lib/haptics";
import { usePressed } from "../lib/pressed";
import { colors, opacity, radii, sizes, spacing } from "../theme";
import { Text } from "./Text";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "tint"
  | "accent"
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
  /**
   * Route the button opens: then it is a link (an <a href> on the web) that looks like a button. Disabled, it is shown
   * dimmed and does not navigate.
   */
  href?: Href;
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
  accent: { bg: colors.primaryTint, fg: colors.primaryPressed, pressedBg: colors.primaryTintPressed },
  dark: { bg: colors.text, fg: colors.surface, pressedBg: colors.textBody },
  onDark: { bg: colors.surface, fg: colors.text, pressedBg: colors.surfaceSunken },
  ghost: { bg: "transparent", fg: colors.text, pressedBg: colors.surfaceSunken },
  ghostOnDark: { bg: colors.onDarkOverlay, fg: colors.onPrimary, pressedBg: colors.onPrimaryOverlay },
  destructiveGhost: { bg: "transparent", fg: colors.primaryPressed, pressedBg: colors.primaryTint },
};

/**
 * Button from the design system (see COMPONENTS.md → Button). Exposes role=button and the label as its name; with
 * `href` it is a link (role=link) styled the same. A press gives a light haptic tick.
 */
export function Button({
  label,
  variant = "primary",
  size = "lg",
  leftIcon,
  fullWidth = true,
  href,
  disabled,
  style,
  onPressIn,
  ...rest
}: ButtonProps) {
  const v = VARIANT[variant];
  const link = usePressed(tapFeedback);
  const frame = (pressed: boolean): StyleProp<ViewStyle> => [
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
  ];
  const content = (
    <>
      {leftIcon ? <View style={styles.icon}>{leftIcon}</View> : null}
      <Text
        variant={size === "lg" ? "button" : size === "md" || size === "sm" ? "buttonM" : "buttonS"}
        style={{ color: v.fg }}
      >
        {label}
      </Text>
    </>
  );
  if (href) {
    const anchor = (
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={label}
        accessibilityState={{ disabled: !!disabled }}
        disabled={disabled}
        {...rest}
        onPressIn={(event) => {
          link.onPressIn();
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          link.onPressOut();
          rest.onPressOut?.(event);
        }}
        style={StyleSheet.flatten(frame(link.pressed))}
      >
        {content}
      </Pressable>
    );
    // Disabled, it is left out of the router's link (no href on the web), so there is nothing to follow.
    return disabled ? (
      anchor
    ) : (
      <RouterLink href={href} asChild>
        {anchor}
      </RouterLink>
    );
  }
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
      style={({ pressed }) => frame(pressed)}
      {...rest}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  icon: { marginRight: spacing[4] },
});
