import type { ReactNode } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { colors, radii, shadows, spacing } from "../theme";

export interface CardProps {
  children: ReactNode;
  style?: ViewStyle;
}

/** White card with a raised shadow (COMPONENTS.md → Card). */
export function Card({ children, style }: CardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii["3xl"],
    padding: spacing[9],
    gap: spacing[4],
    ...shadows.cardRaised,
  },
});
