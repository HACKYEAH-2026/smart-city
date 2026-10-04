import type { PlaceDetails, PlaceKind } from '@app/shared';
import { BlurTargetView, BlurView } from 'expo-blur';
import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { STREET_ZOOM } from '../lib/map/spec';
import { placeKindIcon } from '../lib/placeKinds';
import { t } from '../texts';
import { colors, layout, sizes } from '../theme';
import { DashboardMap } from './DashboardMap';
import { MapView } from './MapView';
import { PlacePin } from './PlacePin';
import { useScrollY } from './Screen';

export interface PlaceBackdropProps {
  location: PlaceDetails['location'];
  /** The kind of place: the icon on its pin. */
  kind: PlaceKind;
}

/**
 * The dashboard's backdrop (design E-Dashboard): the place's own map behind the header, with no text on it, fading
 * into the screen at its lower edge. The place's pin stands right of centre, beside its name (the free side of the
 * header), and the map is centred under it. A place without a location keeps the illustration, with the pin at the
 * same spot. Not interactive: the screen's backdrop layer takes no touches.
 */
export function PlaceBackdrop({ location, kind }: PlaceBackdropProps) {
  const insets = useSafeAreaInsets();
  // The content starts below the status bar (Screen): so does the pin, whatever the device.
  const pinTop = insets.top + layout.screenTopOffset + sizes.dashboardPinTop;
  const scrollY = useScrollY();
  // Blurs in as the content scrolls under the header (the screen's scroll position, read on the UI thread).
  const blur = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [0, sizes.dashboardBlurRange],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));
  // Android blurs only what is drawn in the blur target (expo-blur): the artwork and pin live inside it.
  const blurTarget = useRef<View>(null);
  const pin = (
    <View style={[styles.pin, { height: 2 * pinTop }]}>
      <PlacePin icon={placeKindIcon(kind)} />
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
        {pin}
      </BlurTargetView>
      <Animated.View
        pointerEvents='none'
        style={[StyleSheet.absoluteFill, blur]}
      >
        <BlurView
          blurTarget={blurTarget}
          blurMethod='dimezisBlurViewSdk31Plus'
          intensity={BLUR_INTENSITY}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      {location ? (
        // Drawn over the blur as well, so the blurred map still fades into the screen at its lower edge.
        <Svg style={styles.fade} width='100%' height={sizes.dashboardMapFade}>
          <Defs>
            <LinearGradient id='fade' x1='0' y1='0' x2='0' y2='1'>
              <Stop offset='0' stopColor={colors.background} stopOpacity='0' />
              <Stop offset='1' stopColor={colors.background} stopOpacity='1' />
            </LinearGradient>
          </Defs>
          <Rect x='0' y='0' width='100%' height='100%' fill='url(#fade)' />
        </Svg>
      ) : null}
    </View>
  );
}

const MAP_HEIGHT = sizes.dashboardMap + sizes.dashboardMapCrop;
/** The blur strength of the backdrop once fully scrolled (expo-blur intensity, 0–100). */
const BLUR_INTENSITY = 30;
const styles = StyleSheet.create({
  // The whole backdrop (map, fade, pin) sits higher, so the pin lines up with the header's name.
  wrap: {
    height: sizes.dashboardMap,
    overflow: 'hidden',
    top: -sizes.dashboardMapLift,
  },
  map: { height: MAP_HEIGHT },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  // PlacePin puts its tip in the middle of its box: a box from the corner, twice the tip's offset, ends it there.
  pin: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: `${200 * sizes.dashboardPinX}%`,
  },
});
