import type { GeoPoint } from "@app/plugin-sdk";
import { type Ref, useEffect, useImperativeHandle, useRef, useState } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { MapSurface, type MapSurfaceHandle } from "../lib/map/MapSurface";
import { flyTo, type MapEvent, type MapPin, mapSources, mapSpec } from "../lib/map/spec";
import { colors } from "../theme";

export type MapViewHandle = { flyTo: (to: GeoPoint, zoom?: number) => void };

export interface MapViewProps {
  /** Accessible name of the map (the pins are drawn on a canvas: list them next to it for screen readers and E2E). */
  label: string;
  center: GeoPoint;
  zoom: number;
  pins?: MapPin[];
  selectedId?: string | null;
  /** The user's own position (blue dot). */
  me?: GeoPoint | null;
  /** Off: a still preview (no gestures). */
  interactive?: boolean;
  /** Height of a panel over the map's lower edge: the map's attribution stays above it. */
  bottomInset?: number;
  /** A tap on the map (not on a pin) moves the view there and calls `onTap` (the location picker). */
  onTap?: (at: GeoPoint) => void;
  onPinPress?: (id: string) => void;
  /** After every move; `user` when the user moved the map (not `flyTo`). */
  onMove?: (center: GeoPoint, user: boolean) => void;
  style?: ViewStyle;
  ref?: Ref<MapViewHandle>;
}

/**
 * Live map (COMPONENTS.md → MapView): OpenStreetMap base map in the app's colours, red place pins with labels and the
 * user's position. `center` and `zoom` set the first view only; move it later with `flyTo` (ref). The map loads in the
 * background: the `mapBase` colour shows until it does.
 */
export function MapView({
  label,
  center,
  zoom,
  pins = [],
  selectedId = null,
  me = null,
  interactive = true,
  bottomInset = 0,
  onTap,
  onPinPress,
  onMove,
  style,
  ref,
}: MapViewProps) {
  const surface = useRef<MapSurfaceHandle>(null);
  const [spec] = useState(() =>
    mapSpec({ center, zoom, interactive, tapToCenter: Boolean(onTap), bottomInset }, { pins, selectedId, me }),
  );
  const handlers = useRef({ onTap, onPinPress, onMove });
  handlers.current = { onTap, onPinPress, onMove };

  useImperativeHandle(ref, () => ({ flyTo: (to, z) => surface.current?.send(flyTo(to, z)) }));
  useEffect(() => {
    surface.current?.send({ type: "data", sources: mapSources({ pins, selectedId, me }) });
  }, [pins, selectedId, me]);

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
