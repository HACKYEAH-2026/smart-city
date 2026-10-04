import type { GeoPoint } from "@app/plugin-sdk";
import { type Ref, useEffect, useImperativeHandle, useRef, useState } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { MapSurface, type MapSurfaceHandle } from "../lib/map/MapSurface";
import {
  type Anchor,
  boundsOf,
  flyTo,
  type MapArea,
  type MapEvent,
  type MapPin,
  type MapRoute,
  mapSources,
  mapSpec,
} from "../lib/map/spec";
import { colors } from "../theme";

/** Stable defaults: a new [] on every render would resend the map's data each time. */
const NO_ROUTES: MapRoute[] = [];
const NO_AREAS: MapArea[] = [];

export type MapViewHandle = { flyTo: (to: GeoPoint, zoom?: number) => void };

export interface MapViewProps {
  /** Accessible name of the map (the pins are drawn on a canvas: list them next to it for screen readers and E2E). */
  label: string;
  center: GeoPoint;
  zoom: number;
  /** Where `center` sits in the view, as fractions of its width and height (default the middle). */
  anchor?: Anchor;
  /** The first view fits everything on the map instead (when it shows anything): `center` and `zoom` are fallbacks. */
  fit?: boolean;
  pins?: MapPin[];
  /** Lines (plugin routes) and areas (circles in metres or polygons), coloured by tone like pins. */
  routes?: MapRoute[];
  areas?: MapArea[];
  selectedId?: string | null;
  /** The user's own position (blue dot). */
  me?: GeoPoint | null;
  /** Off: a still preview (no gestures). */
  interactive?: boolean;
  /** Off: no text on the map (street names, pin labels). */
  labels?: boolean;
  /** On: the base map in black and white. */
  monochrome?: boolean;
  /** Height of a panel over the map's lower edge: the map's attribution stays above it. */
  bottomInset?: number;
  /** A tap on the map (not on a pin) moves the view there and calls `onTap` (the location picker). */
  onTap?: (at: GeoPoint) => void;
  /** A tap on a pin, a route or an area: its id. */
  onPinPress?: (id: string) => void;
  /** After every move; `user` when the user moved the map (not `flyTo`). */
  onMove?: (center: GeoPoint, user: boolean) => void;
  style?: ViewStyle;
  ref?: Ref<MapViewHandle>;
}

/**
 * Live map (COMPONENTS.md → MapView): OpenStreetMap base map in the app's colours, pins with labels (red place pins,
 * or coloured by tone), routes, areas and the user's position. `center` and `zoom` (or `fit`) set the first view only;
 * move it later with `flyTo` (ref). The map loads in the background: the `mapBase` colour shows until it does.
 */
export function MapView({
  label,
  center,
  zoom,
  anchor,
  fit = false,
  pins = [],
  routes = NO_ROUTES,
  areas = NO_AREAS,
  selectedId = null,
  me = null,
  interactive = true,
  labels = true,
  monochrome = false,
  bottomInset = 0,
  onTap,
  onPinPress,
  onMove,
  style,
  ref,
}: MapViewProps) {
  const surface = useRef<MapSurfaceHandle>(null);
  const [spec] = useState(() =>
    mapSpec(
      {
        center,
        zoom,
        anchor,
        fit: fit ? boundsOf({ pins, routes, areas }) : null,
        interactive,
        labels,
        monochrome,
        tapToCenter: Boolean(onTap),
        bottomInset,
      },
      { pins, routes, areas, selectedId, me },
    ),
  );
  const handlers = useRef({ onTap, onPinPress, onMove });
  handlers.current = { onTap, onPinPress, onMove };

  useImperativeHandle(ref, () => ({ flyTo: (to, z) => surface.current?.send(flyTo(to, z)) }));
  useEffect(() => {
    surface.current?.send({ type: "data", sources: mapSources({ pins, routes, areas, selectedId, me }) });
  }, [pins, routes, areas, selectedId, me]);

  const onEvent = (event: MapEvent) => {
    if (event.type === "press") handlers.current.onPinPress?.(event.id);
    if (event.type === "tap") handlers.current.onTap?.({ lat: event.lat, lng: event.lng });
    if (event.type === "move") handlers.current.onMove?.({ lat: event.lat, lng: event.lng }, event.user);
    if (event.type === "error") console.warn("map:", event.message);
  };

  return (
    <View style={[styles.map, style]} pointerEvents={interactive ? "auto" : "none"}>
      <MapSurface ref={surface} spec={spec} label={label} onEvent={onEvent} />
    </View>
  );
}

const styles = StyleSheet.create({ map: { overflow: "hidden", backgroundColor: colors.mapBase } });
