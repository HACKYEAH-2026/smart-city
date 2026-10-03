import { Link as RouterLink } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { usePressed } from "../lib/pressed";
import { t } from "../texts";
import { opacity, spacing } from "../theme";
import { BrandMark } from "./BrandMark";
import { Text } from "./Text";

export interface BrandProps {
  /** Route the wordmark opens (the header); without one it is not a link. */
  href?: string;
}

/** Wordmark: the logo mark + "Twoje Miejsce" (login, no-places screen, header). */
export function Brand({ href }: BrandProps) {
  const press = usePressed();
  const content = (
    <>
      <BrandMark />
      <Text variant="brand">{t.app_name}</Text>
    </>
  );
  if (!href) return <View style={styles.brand}>{content}</View>;
  return (
    <RouterLink href={href as never} asChild>
      <Pressable
        accessibilityRole="link"
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={StyleSheet.flatten([styles.brand, press.pressed && styles.pressed])}
      >
        {content}
      </Pressable>
    </RouterLink>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: opacity.pressed },
  brand: { flexDirection: "row", alignItems: "center", gap: spacing[4] },
});
