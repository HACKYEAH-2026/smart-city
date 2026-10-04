import { StyleSheet, View } from "react-native";
import { initials } from "../lib/places";
import { type ColorToken, colors, radii, sizes } from "../theme";
import { Text } from "./Text";

export type AvatarTone = "accent" | "neutral";

const TONE: Record<AvatarTone, { bg: ColorToken; fg: ColorToken }> = {
  accent: { bg: "primaryTint", fg: "primary" },
  neutral: { bg: "surfaceMuted", fg: "text" },
};

export interface AvatarProps {
  /** The person's name (or email); the avatar shows its initials. */
  name: string;
  /** accent: an admin (red on tint) · neutral: everyone else. */
  tone?: AvatarTone;
}

/**
 * A person's initials in a 40 dp circle (COMPONENTS.md → Avatar). Decorative: the name always stands next to it, so
 * screen readers skip it.
 */
export function Avatar({ name, tone = "neutral" }: AvatarProps) {
  const palette = TONE[tone];
  return (
    <View aria-hidden style={[styles.avatar, { backgroundColor: colors[palette.bg] }]}>
      <Text variant="buttonS" color={palette.fg}>
        {initials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: sizes.avatarLg,
    height: sizes.avatarLg,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
});
