import type { LucideIcon } from "lucide-react-native";
import { Pressable, StyleSheet } from "react-native";
import { borders, colors, opacity, radii, sizes, spacing } from "../theme";
import { Icon } from "./Icon";

export interface IconButtonProps {
  icon: LucideIcon;
  /** Accessible name, required for icon-only buttons. */
  label: string;
  onPress: () => void;
}

/** Square 44 × 44 icon button, e.g. the back button in a screen header (COMPONENTS.md → IconButton, square). */
export function IconButton({ icon, label, onPress }: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && { opacity: opacity.pressed }]}
    >
      <Icon icon={icon} size={spacing[9]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: sizes.iconButton,
    height: sizes.iconButton,
    borderRadius: radii.lg,
    borderWidth: borders.hairline,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
});
