import type { GeoPoint, Tone } from "@app/plugin-sdk";
// tokens.ts itself, not ../../theme: the theme index loads fonts (Expo), and this file is unit-tested with bun.
import { colors, mapMarks, opacity } from "../../theme/tokens";

/** OpenFreeMap's light style (OpenStreetMap data, no API key), recoloured to the app's map tokens. */
const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
/** Where a map opens without a better guess: the centre of Kraków, the demo city. */
export const DEFAULT_CENTER: GeoPoint = { lat: 50.0617, lng: 19.9373 };
export const CITY_ZOOM = 12;
export const STREET_ZOOM = 16;

/** A pin on the map, by id: `title` is its label under the pin, `tone` its colour (none: the red of place pins). */
export type MapPin = GeoPoint & { id: string; title: string; tone?: Tone };
/** A line through `path` (a plugin's route); `dashed` for detours and planned routes. */
export type MapRoute = { id: string; path: GeoPoint[]; tone?: Tone; dashed?: boolean };
/** A circle (`center`, `radius` in metres) or a polygon (a plugin's area). */
export type MapArea = { id: string; tone?: Tone } & ({ center: GeoPoint; radius: number } | { polygon: GeoPoint[] });
/** What a map shows over the base map: pins (one may be selected), routes, areas and the user's own position. */
export type MapData = {
  pins: MapPin[];
  routes?: MapRoute[];
  areas?: MapArea[];
  selectedId: string | null;
  me: GeoPoint | null;
};
/** [[west, south], [east, north]] in degrees. */
export type Bounds = [[number, number], [number, number]];
export type MapOptions = {
  center: GeoPoint;
  zoom: number;
  /** The first view fits these bounds instead of `center` and `zoom` (no closer than STREET_ZOOM). */
  fit?: Bounds | null;
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
  bounds: Bounds | null;
  /** How the first view fits `bounds` (MapLibre fitBoundsOptions). */
  fitOptions: { padding: { top: number; right: number; bottom: number; left: number }; maxZoom: number };
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
const ROUTES = "routes";
const AREAS = "areas";
const ME = "me";

/** Plugin tones on the map (tokens.ts); no tone = the brand red, like place pins. */
const TONE_COLORS: Record<Tone, string> = {
  neutral: colors.mapNeutral,
  info: colors.mapInfo,
  success: colors.mapSuccess,
  warning: colors.mapWarning,
  danger: colors.primary,
};
/** The colour of a tone on the map (also the legend's and the list's colour marks). */
export const colorOf = (tone: Tone | undefined) => (tone ? TONE_COLORS[tone] : colors.primary);

const METRES_PER_DEGREE = 111_320;
/**
 * A circle as a closed ring of points (`radius` in metres): MapLibre sizes its own circles in pixels, an area keeps
 * its size on the ground. Good enough for city distances (the earth is flat at this scale).
 */
export const circle = (center: GeoPoint, radius: number, steps = 64): GeoPoint[] => {
  const dLat = radius / METRES_PER_DEGREE;
  const dLng = dLat / Math.cos((center.lat * Math.PI) / 180);
  return Array.from({ length: steps + 1 }, (_, i) => {
    const angle = (2 * Math.PI * (i % steps)) / steps;
    return { lat: center.lat + dLat * Math.sin(angle), lng: center.lng + dLng * Math.cos(angle) };
  });
};
const ringOf = (area: MapArea): GeoPoint[] =>
  "polygon" in area ? [...area.polygon, area.polygon[0] as GeoPoint] : circle(area.center, area.radius);

/** The smallest bounds around everything on the map (pins, routes, areas), or null when it shows nothing. */
export const boundsOf = ({ pins, routes = [], areas = [] }: Pick<MapData, "pins" | "routes" | "areas">) => {
  const points = [...pins, ...routes.flatMap((r) => r.path), ...areas.flatMap(ringOf)];
  if (!points.length) return null;
  const lngs = points.map((p) => p.lng);
  const lats = points.map((p) => p.lat);
  const bounds: Bounds = [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
  return bounds;
};

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

const feature = (geometry: { type: string; coordinates: unknown }, properties: Record<string, unknown>) => ({
  type: "Feature",
  properties,
  geometry,
});

/** The GeoJSON sources for the data (sent again whenever the data changes). */
export const mapSources = ({
  pins,
  routes = [],
  areas = [],
  selectedId,
  me,
}: MapData): Record<string, GeoJsonSource> => ({
  [PINS]: collection(
    pins.map((pin) =>
      point(pin, { id: pin.id, title: pin.title, selected: pin.id === selectedId, color: colorOf(pin.tone) }),
    ),
  ),
  [ROUTES]: collection(
    routes.map((route) =>
      feature(
        { type: "LineString", coordinates: route.path.map(lngLat) },
        { id: route.id, color: colorOf(route.tone), dashed: Boolean(route.dashed) },
      ),
    ),
  ),
  [AREAS]: collection(
    areas.map((area) =>
      feature({ type: "Polygon", coordinates: [ringOf(area).map(lngLat)] }, { id: area.id, color: colorOf(area.tone) }),
    ),
  ),
  [ME]: collection(me ? [point(me, {})] : []),
});

const ROUTE_LINE = {
  type: "line",
  source: ROUTES,
  layout: { "line-cap": "round", "line-join": "round" },
} as const;

const LAYERS: Layer[] = [
  {
    id: AREAS,
    type: "fill",
    source: AREAS,
    paint: { "fill-color": ["get", "color"], "fill-opacity": opacity.mapArea },
  },
  {
    id: "area-outlines",
    type: "line",
    source: AREAS,
    paint: { "line-color": ["get", "color"], "line-width": mapMarks.areaStroke },
  },
  {
    ...ROUTE_LINE,
    id: "route-casings",
    paint: { "line-color": colors.surface, "line-width": mapMarks.routeCasing },
  },
  // Dashes cannot depend on the data in MapLibre: dashed routes get a layer of their own.
  {
    ...ROUTE_LINE,
    id: ROUTES,
    filter: ["!", ["get", "dashed"]],
    paint: { "line-color": ["get", "color"], "line-width": mapMarks.routeWidth },
  },
  {
    ...ROUTE_LINE,
    id: "routes-dashed",
    layout: { "line-join": "round" },
    filter: ["get", "dashed"],
    paint: { "line-color": ["get", "color"], "line-width": mapMarks.routeWidth, "line-dasharray": mapMarks.routeDash },
  },
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
      "circle-color": ["get", "color"],
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
  bounds: options.fit ?? null,
  fitOptions: {
    padding: {
      top: mapMarks.fitPadding,
      right: mapMarks.fitPadding,
      bottom: mapMarks.fitPadding + options.bottomInset,
      left: mapMarks.fitPadding,
    },
    maxZoom: STREET_ZOOM,
  },
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
  // Topmost first: a pin over an area is the pin.
  pressable: [PINS, ROUTES, "routes-dashed", AREAS],
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
