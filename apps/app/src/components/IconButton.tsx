import { Link as RouterLink } from "expo-router";
import type { LucideIcon } from "lucide-react-native";
import { Pressable, StyleSheet } from "react-native";
import { tapFeedback } from "../lib/haptics";
import { borders, type ColorToken, colors, opacity, radii, shadows, sizes } from "../theme";
import { AccentGradient } from "./AccentGradient";
import { Icon } from "./Icon";
import { Text } from "./Text";

/**
 * square: bordered button on a surface (reorder on the dashboard) · plain: back or cancel without a background in
 * screen and step headers · round: bell or account avatar · roundSunken: close in a bottom sheet · roundOnDark: close
 * and torch on the dark QR scanner · roundDark: an admin's dark round button (a plugin screen's settings gear) ·
 * roundOnImage: back over a photo or a map, dark and see-through like the photo counter · floating: "my location" over
 * a map, with a shadow instead of a border.
 * Back in the top left corner never has a white background (it pulls the eye from the screen): `plain`, or
 * `roundOnImage` over a photo or a map.
 */
export type IconButtonVariant =
  | "square"
  | "plain"
  | "round"
  | "roundSunken"
  | "roundOnDark"
  | "roundDark"
  | "roundOnImage"
  | "floating";

export type IconButtonProps = {
  /** Accessible name, required for icon-only buttons. */
  label: string;
  variant?: IconButtonVariant;
  /** Icon colour when it is not the variant's (e.g. the blue "my location" on a map). */
  color?: ColorToken;
  /** Shown dimmed and not pressable (e.g. a sheet's close while its action runs). */
  disabled?: boolean;
} & (
  | { onPress: () => void; href?: undefined }
  /** A link to a route of the app instead of an action (role link), e.g. "Zarządzaj miejscem" on the dashboard. */
  | { href: string; onPress?: undefined }
) &
  (
    | { icon: LucideIcon; text?: undefined }
    /** Initials instead of an icon (account avatar, `typography.buttonS`). */
    | { text: string; icon?: undefined }
  );

/** 44 × 44 icon button (COMPONENTS.md → IconButton). A press gives a light haptic tick. */
export function IconButton({
  label,
  onPress,
  href,
  variant = "square",
  icon,
  text,
  color,
  disabled = false,
}: IconButtonProps) {
  const button = (
    <Pressable
      accessibilityRole={href ? "link" : "button"}
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={tapFeedback}
      // A link gets one flat style object: expo-router's Link (asChild) drops a style function and, on the web,
      // hands a style array to the DOM <a> as is (which throws).
      style={
        href
          ? StyleSheet.flatten([styles.button, styles[variant], disabled && styles.disabled])
          : ({ pressed }) => [
              styles.button,
              styles[variant],
              pressed && { opacity: opacity.pressed },
              disabled && styles.disabled,
            ]
      }
    >
      {variant === "roundDark" ? (
        <AccentGradient style={[StyleSheet.absoluteFill, { borderRadius: radii.pill }]} />
      ) : null}
      {icon ? (
        <Icon
          icon={icon}
          size={variant === "roundSunken" ? sizes.iconS : sizes.iconM}
          color={color ?? (ON_DARK.includes(variant) ? "onPrimary" : "text")}
        />
      ) : (
        <Text variant="buttonS">{text}</Text>
      )}
    </Pressable>
  );
  return href ? (
    <RouterLink href={href as never} asChild>
      {button}
    </RouterLink>
  ) : (
    button
  );
}

/** Variants with a dark background, so a white icon. */
const ON_DARK: IconButtonVariant[] = ["roundOnDark", "roundDark", "roundOnImage"];

const styles = StyleSheet.create({
  disabled: { opacity: opacity.disabled },
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
  // Keeps its 44 dp touch target but is pulled out by the padding around its icon, so the icon lines up with the
  // content edge (like the title below it) and sits a row's `gap` away from its neighbour.
  plain: { marginHorizontal: -(sizes.iconButton - sizes.iconM) / 2 },
  round: {
    borderRadius: radii.pill,
    borderWidth: borders.hairline,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface,
  },
  roundSunken: { borderRadius: radii.pill, backgroundColor: colors.surfaceSunken },
  roundOnDark: { borderRadius: radii.pill, backgroundColor: colors.onDarkOverlay },
  roundDark: { borderRadius: radii.pill, backgroundColor: colors.primary },
  roundOnImage: { borderRadius: radii.pill, backgroundColor: colors.photoOverlay },
  floating: { borderRadius: radii.lg, backgroundColor: colors.surface, ...shadows.floating },
});
