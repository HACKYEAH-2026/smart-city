import type { PlaceDetails } from "@app/shared";
import { BlurTargetView, BlurView } from "expo-blur";
import { useRef } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Extrapolation, interpolate, useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop } from "react-native-svg";
import { STREET_ZOOM } from "../lib/map/spec";
import { t } from "../texts";
import { colors, gradients, layout, opacity, sizes } from "../theme";
import { DashboardMap } from "./DashboardMap";
import { MapView } from "./MapView";
import { useScrollY } from "./Screen";

export interface PlaceBackdropProps {
  location: PlaceDetails["location"];
}

/**
 * The dashboard's backdrop (design E-Dashboard): the place's own map behind the header, with no text on it, fading
 * into the screen at its lower edge. The place's marker is a soft red glow right of centre, beside its name (the free
 * side of the header), and the map is centred under it. A place without a location keeps the illustration, with the
 * glow at the same spot. Not interactive: the screen's backdrop layer takes no touches.
 */
export function PlaceBackdrop({ location }: PlaceBackdropProps) {
  const insets = useSafeAreaInsets();
  // The content starts below the status bar (Screen): so does the pin, whatever the device.
  const contentTop = insets.top + layout.screenTopOffset;
  const pinTop = contentTop + sizes.dashboardPinTop;
  const scrollY = useScrollY();
  // Blurs in as the content scrolls under the header (the screen's scroll position, read on the UI thread).
  const blur = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, sizes.dashboardBlurRange], [0, 1], Extrapolation.CLAMP),
  }));
  // Android blurs only what is drawn in the blur target (expo-blur): the artwork and pin live inside it.
  const blurTarget = useRef<View>(null);
  // The marker: a red radial glow centred on the same point the map is anchored to.
  const glow = (
    <View style={[styles.pin, { height: 2 * pinTop }]}>
      <Svg
        style={[styles.glow, { marginTop: pinTop - sizes.dashboardGlow }]}
        width={sizes.dashboardGlow * 2}
        height={sizes.dashboardGlow * 2}
      >
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={gradients.accent[0]} stopOpacity={opacity.dashboardGlow / 3} />
            <Stop offset="1" stopColor={gradients.accent[1]} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx="50%" cy="50%" r="50%" fill="url(#glow)" />
      </Svg>
    </View>
  );
  const artwork = location ? (
    <MapView
      label={t.dashboard_map_label}
      center={location}
      zoom={STREET_ZOOM}
      anchor={{ x: sizes.dashboardPinX, y: pinTop / MAP_HEIGHT }}
      interactive={false}
      labels={false}
      monochrome
      style={styles.map}
    />
  ) : (
    <DashboardMap />
  );
  return (
    <View style={styles.wrap}>
      <BlurTargetView ref={blurTarget} style={StyleSheet.absoluteFill}>
        {artwork}
        {glow}
      </BlurTargetView>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, blur]}>
        <BlurView
          blurTarget={blurTarget}
          blurMethod="dimezisBlurViewSdk31Plus"
          intensity={BLUR_INTENSITY}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      {location ? (
        // Drawn over the blur as well, so the blurred map still fades into the screen at its lower edge.
        <Svg style={styles.fade} width="100%" height={sizes.dashboardMapFade}>
          <Defs>
            <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.background} stopOpacity="0" />
              <Stop offset="1" stopColor={colors.background} stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#fade)" />
        </Svg>
      ) : null}
    </View>
  );
}

const MAP_HEIGHT = sizes.dashboardMap + sizes.dashboardMapCrop;
/** The blur strength of the backdrop once fully scrolled (expo-blur intensity, 0–100). */
const BLUR_INTENSITY = 30;
const styles = StyleSheet.create({
  // The whole backdrop (map, fade, marker) sits higher, so the marker lines up with the header's name.
  wrap: {
    height: sizes.dashboardMap,
    overflow: "hidden",
    top: -sizes.dashboardMapLift,
  },
  map: { height: MAP_HEIGHT },
  fade: { position: "absolute", left: 0, right: 0, bottom: 0 },
  glow: { alignSelf: "center" },
  // On the right of the header, below its top: the free side next to the name, above the marker.
  // The box ends at the marker's centre: its width puts that centre at the pin's x, its height at twice pinTop.
  pin: {
    position: "absolute",
    top: 0,
    left: 0,
    width: `${200 * sizes.dashboardPinX}%`,
  },
});
