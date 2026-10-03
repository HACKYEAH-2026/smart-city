import type { PlaceDetails } from "@app/shared";
import { StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { STREET_ZOOM } from "../lib/map/spec";
import { t } from "../texts";
import { colors, sizes } from "../theme";
import { DashboardMap } from "./DashboardMap";
import { MapView } from "./MapView";

/**
 * The dashboard's backdrop (design E-Dashboard): the place's own map behind the header, with no text on it and no pin,
 * fading into the screen at its lower edge. A place without a location keeps the illustration. Not interactive: the
 * screen's backdrop layer takes no touches.
 */
export function PlaceBackdrop({ location }: { location: PlaceDetails["location"] }) {
  if (!location) return <DashboardMap />;
  return (
    <View style={styles.wrap}>
      <MapView
        label={t.dashboard_map_label}
        center={location}
        zoom={STREET_ZOOM}
        interactive={false}
        labels={false}
        monochrome
        style={styles.map}
      />
      <Svg style={styles.fade} width="100%" height={sizes.dashboardMapFade}>
        <Defs>
          <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.background} stopOpacity="0" />
            <Stop offset="1" stopColor={colors.background} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#fade)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: sizes.dashboardMap, overflow: "hidden" },
  map: { height: sizes.dashboardMap + sizes.dashboardMapCrop },
  fade: { position: "absolute", left: 0, right: 0, bottom: 0 },
});
