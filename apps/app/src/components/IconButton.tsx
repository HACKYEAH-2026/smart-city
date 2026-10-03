import type { LucideIcon } from "lucide-react-native";
import { Pressable, StyleSheet } from "react-native";
import { tapFeedback } from "../lib/haptics";
import { borders, colors, opacity, radii, sizes, spacing } from "../theme";
import { Icon } from "./Icon";
import { Text } from "./Text";

/**
 * square: back button in screen headers · round: bell or account avatar · roundSunken: close in a bottom sheet ·
 * roundOnDark: close and torch on the dark QR scanner.
 */
export type IconButtonVariant = "square" | "round" | "roundSunken" | "roundOnDark";

export type IconButtonProps = {
  /** Accessible name, required for icon-only buttons. */
  label: string;
  onPress: () => void;
  variant?: IconButtonVariant;
} & (
  | { icon: LucideIcon; text?: undefined }
  /** Initials instead of an icon (account avatar, `typography.buttonS`). */
  | { text: string; icon?: undefined }
);

/** 44 × 44 icon button (COMPONENTS.md → IconButton). A press gives a light haptic tick. */
export function IconButton({ label, onPress, variant = "square", icon, text }: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onPressIn={tapFeedback}
      style={({ pressed }) => [styles.button, styles[variant], pressed && { opacity: opacity.pressed }]}
    >
      {icon ? (
        <Icon
          icon={icon}
          size={variant === "roundSunken" ? sizes.iconS : spacing[9]}
          color={variant === "roundOnDark" ? "onPrimary" : "text"}
        />
      ) : (
        <Text variant="buttonS">{text}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: sizes.iconButton,
    height: sizes.iconButton,
    alignItems: "center",
    justifyContent: "center",
  },
  square: {
    borderRadius: radii.lg,
    borderWidth: borders.hairline,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface,
  },
  round: {
    borderRadius: radii.pill,
    borderWidth: borders.hairline,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface,
  },
  roundSunken: { borderRadius: radii.pill, backgroundColor: colors.surfaceSunken },
  roundOnDark: { borderRadius: radii.pill, backgroundColor: colors.onDarkOverlay },
});
