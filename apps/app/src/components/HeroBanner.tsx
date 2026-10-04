import { StyleSheet, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { colors, layout, opacity, radii, sizes, spacing } from "../theme";
import { AccentGradient } from "./AccentGradient";
import { Heading } from "./Heading";
import { Text } from "./Text";

export interface HeroBannerProps {
  /** Eyebrow above the title (`labelHero`). */
  label: string;
  /** The screen's h1. */
  title: string;
}

/**
 * Red banner card (COMPONENTS.md → HeroBanner): eyebrow and h1 at the bottom, decorated with white streets and a pin.
 * The decoration's coordinates are the design's 342 × 172 card.
 */
export function HeroBanner({ label, title }: HeroBannerProps) {
  return (
    <AccentGradient style={styles.banner}>
      <View pointerEvents="none" aria-hidden style={StyleSheet.absoluteFill}>
        <Svg width="100%" height="100%" viewBox="0 0 342 172" preserveAspectRatio="xMaxYMid slice">
          <Path
            d="M0 40 H342 M0 96 L342 80 M60 0 V172 M170 0 L186 172 M280 0 L266 172"
            stroke={colors.onPrimary}
            strokeOpacity={opacity.heroRoad}
            strokeWidth={6}
            strokeLinecap="round"
            fill="none"
          />
          <Circle cx={266} cy={52} r={16} fill={colors.onPrimary} opacity={opacity.heroPinHalo} />
          <Circle cx={266} cy={52} r={7} fill={colors.onPrimary} />
        </Svg>
      </View>
      <Text variant="labelHero" color="onPrimary">
        {label}
      </Text>
      <Heading level={1} variant="headingM" color="onPrimary">
        {title}
      </Heading>
    </AccentGradient>
  );
}

const styles = StyleSheet.create({
  banner: {
    minHeight: sizes.heroBanner,
    justifyContent: "flex-end",
    gap: spacing[5],
    padding: layout.heroPadding,
    borderRadius: radii["4xl"],
    backgroundColor: colors.primary,
    overflow: "hidden",
  },
});
