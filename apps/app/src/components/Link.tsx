import { Link as RouterLink } from "expo-router";
import type { ReactNode } from "react";
import { StyleSheet } from "react-native";
import { colors, typography } from "../theme";

export interface LinkProps {
  /** Internal route, e.g. "/app/c/krakow". */
  href: string;
  children: ReactNode;
  /** inline: accent link inside a sentence; nav: header/footer navigation item. */
  variant?: "inline" | "nav";
}

/** Internal link (Expo Router): an <a href> on the web, a tappable text natively. */
export function Link({ href, children, variant = "inline" }: LinkProps) {
  return (
    <RouterLink href={href as never} style={variant === "nav" ? styles.nav : styles.inline}>
      {children}
    </RouterLink>
  );
}

const styles = StyleSheet.create({
  inline: { ...typography.buttonM, color: colors.primary, textDecorationLine: "none" },
  nav: { ...typography.buttonS, color: colors.text, textDecorationLine: "none" },
});
