import { Link as RouterLink } from "expo-router";
import type { ReactNode } from "react";
import { useState } from "react";
import { StyleSheet } from "react-native";
import { colors, opacity, typography } from "../theme";

export interface LinkProps {
  /** Internal route, e.g. "/app/c/krakow". */
  href: string;
  children: ReactNode;
  /** inline: accent link inside a sentence; nav: header/footer navigation item. */
  variant?: "inline" | "nav";
}

/**
 * Internal link (Expo Router): an <a href> on the web, a tappable text natively. Pressed: the darker accent for inline
 * links (COMPONENTS.md → Link), faded for navigation items.
 */
export function Link({ href, children, variant = "inline" }: LinkProps) {
  const [pressed, setPressed] = useState(false);
  const base = variant === "nav" ? styles.nav : styles.inline;
  const pressedStyle = pressed ? (variant === "nav" ? styles.navPressed : styles.inlinePressed) : null;
  return (
    <RouterLink
      href={href as never}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[base, pressedStyle]}
    >
      {children}
    </RouterLink>
  );
}

const styles = StyleSheet.create({
  inline: { ...typography.buttonM, color: colors.primary, textDecorationLine: "none" },
  nav: { ...typography.buttonS, color: colors.text, textDecorationLine: "none" },
  inlinePressed: { color: colors.primaryPressed },
  navPressed: { opacity: opacity.pressed },
});
