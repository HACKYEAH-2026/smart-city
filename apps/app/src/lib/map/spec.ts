import type { GeoPoint } from "@app/plugin-sdk";
import { colors, mapMarks, opacity } from "../../theme";

/** OpenFreeMap's light style (OpenStreetMap data, no API key), recoloured to the app's map tokens. */
const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
/** Where a map opens without a better guess: the centre of Kraków, the demo city. */
export const DEFAULT_CENTER: GeoPoint = { lat: 50.0617, lng: 19.9373 };
export const CITY_ZOOM = 12;
export const STREET_ZOOM = 16;

/** A pin on the map: a place, by id; `title` is its label under the pin. */
export type MapPin = GeoPoint & { id: string; title: string };
/** What a map shows over the base map: pins (one may be selected) and the user's own position. */
export type MapData = { pins: MapPin[]; selectedId: string | null; me: GeoPoint | null };
export type MapOptions = {
  center: GeoPoint;
  zoom: number;
  interactive: boolean;
  tapToCenter: boolean;
  /** Height of whatever covers the map's lower edge (a panel): the attribution goes above it. */
  bottomInset: number;
};

type GeoJsonSource = { type: "geojson"; data: { type: "FeatureCollection"; features: unknown[] } };
// The page hands these to MapLibre as they are (MapLibre style spec JSON).
type Layer = Record<string, unknown>;
export type MapSpec = {
  style: string;
  center: [number, number];
  zoom: number;
  interactive: boolean;
  tapToCenter: boolean;
  bottomInset: number;
  recolor: { type: string; match: string; prop: string; value: string }[];
  /** Replaces the base map's name labels: the Polish name where there is one. */
  labelField: unknown;
  sources: Record<string, GeoJsonSource>;
  layers: Layer[];
  pressable: string[];
};

const PINS = "pins";
const ME = "me";

const lngLat = (p: GeoPoint): [number, number] => [p.lng, p.lat];
const collection = (features: unknown[]): GeoJsonSource => ({
  type: "geojson",
  data: { type: "FeatureCollection", features },
});
const point = (p: GeoPoint, properties: Record<string, unknown>) => ({
  type: "Feature",
  properties,
  geometry: { type: "Point", coordinates: lngLat(p) },
});

/** The GeoJSON sources for the data (sent again whenever the data changes). */
export const mapSources = ({ pins, selectedId, me }: MapData): Record<string, GeoJsonSource> => ({
  [PINS]: collection(pins.map((pin) => point(pin, { id: pin.id, title: pin.title, selected: pin.id === selectedId }))),
  [ME]: collection(me ? [point(me, {})] : []),
});

const LAYERS: Layer[] = [
  {
    id: "me-halo",
    type: "circle",
    source: ME,
    paint: {
      "circle-radius": mapMarks.meHaloRadius,
      "circle-color": colors.mapMe,
      "circle-opacity": opacity.routeHalo,
    },
  },
  {
    id: ME,
    type: "circle",
    source: ME,
    paint: {
      "circle-radius": mapMarks.meRadius,
      "circle-color": colors.mapMe,
      "circle-stroke-color": colors.surface,
      "circle-stroke-width": mapMarks.meStroke,
    },
  },
  {
    id: PINS,
    type: "circle",
    source: PINS,
    paint: {
      "circle-radius": ["case", ["get", "selected"], mapMarks.pinRadiusSelected, mapMarks.pinRadius],
      "circle-color": colors.primary,
      "circle-stroke-color": colors.onPrimary,
      "circle-stroke-width": mapMarks.pinStroke,
    },
  },
  {
    id: "pin-labels",
    type: "symbol",
    source: PINS,
    layout: {
      "text-field": ["get", "title"],
      "text-font": ["Noto Sans Bold"],
      "text-size": mapMarks.labelSize,
      "text-anchor": "top",
      "text-offset": [0, mapMarks.labelOffset],
      "text-optional": true,
    },
    paint: { "text-color": colors.text, "text-halo-color": colors.surface, "text-halo-width": mapMarks.labelHalo },
  },
];

/** Everything the map page needs to start (html.ts: the "init" message). */
export const mapSpec = (options: MapOptions, data: MapData): MapSpec => ({
  style: STYLE_URL,
  center: lngLat(options.center),
  zoom: options.zoom,
  interactive: options.interactive,
  tapToCenter: options.tapToCenter,
  bottomInset: options.bottomInset,
  labelField: ["coalesce", ["get", "name:pl"], ["get", "name"]],
  recolor: [
    { type: "background", match: ".", prop: "background-color", value: colors.mapBase },
    { type: "fill", match: "water", prop: "fill-color", value: colors.mapWater },
    { type: "fill", match: "park|wood|grass", prop: "fill-color", value: colors.mapPark },
    { type: "fill", match: "residential", prop: "fill-color", value: colors.mapBase },
    { type: "fill", match: "building", prop: "fill-color", value: colors.mapBuilding },
  ],
  sources: mapSources(data),
  layers: LAYERS,
  pressable: [PINS],
});

/** Messages to the map page (after "init"). */
export type MapCommand =
  | { type: "data"; sources: Record<string, GeoJsonSource> }
  | { type: "fly"; center: [number, number]; zoom?: number };
export const flyTo = (to: GeoPoint, zoom?: number): MapCommand => ({ type: "fly", center: lngLat(to), zoom });

/** Messages from the map page. */
export type MapEvent =
  | { type: "ready" }
  | { type: "press"; id: string }
  | { type: "tap"; lat: number; lng: number }
  | { type: "move"; lat: number; lng: number; user: boolean }
  | { type: "error"; message: string };
