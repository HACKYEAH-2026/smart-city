import { StyleSheet, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { colors, opacity, radii, spacing } from "../theme";
import { Text } from "./Text";

export interface HeroBannerProps {
  /** Eyebrow above the title (uppercase label). */
  label: string;
  title: string;
}

/**
 * Red banner with a map decoration and the title at its bottom edge (COMPONENTS.md → HeroBanner).
 * The decoration is hidden from screen readers.
 */
export function HeroBanner({ label, title }: HeroBannerProps) {
  return (
    <View style={styles.banner}>
      <Svg style={styles.map} width="100%" height="100%" viewBox="0 0 342 172" preserveAspectRatio="xMidYMin slice">
        <Path
          d="M0 40 H342 M0 96 L342 80 M60 0 V172 M170 0 L186 172 M280 0 L266 172"
          stroke={colors.onPrimary}
          strokeOpacity={opacity.heroStreet}
          strokeWidth={6}
          strokeLinecap="round"
          fill="none"
        />
        <Circle cx={266} cy={52} r={16} fill={colors.onPrimary} fillOpacity={opacity.heroHalo} />
        <Circle cx={266} cy={52} r={7} fill={colors.onPrimary} />
      </Svg>
      <Text variant="labelHero" color="onPrimary" style={styles.label}>
        {label}
      </Text>
      <Text role="heading" aria-level={1} variant="headingM" color="onPrimary" style={styles.title}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    overflow: "hidden",
    minHeight: 172,
    padding: spacing[9],
    borderRadius: radii["4xl"],
    backgroundColor: colors.primary,
    justifyContent: "flex-end",
    gap: spacing[5],
  },
  map: { position: "absolute", top: 0, left: 0 },
  label: { zIndex: 1 },
  title: { zIndex: 1 },
});
