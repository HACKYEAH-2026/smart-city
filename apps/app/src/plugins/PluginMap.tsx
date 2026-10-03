import type { Action, GeoPoint, MapLayer, Tone, UINode } from "@app/plugin-sdk";
import { ChevronRight } from "lucide-react-native";
import { useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Button, Card, Icon, MapView, type MapViewHandle, Text } from "../components";
import { tapFeedback } from "../lib/haptics";
import {
  CITY_ZOOM,
  colorOf,
  DEFAULT_CENTER,
  type MapArea,
  type MapPin,
  type MapRoute,
  STREET_ZOOM,
} from "../lib/map/spec";
import { t } from "../texts";
import { borders, colors, mapMarks, opacity, radii, sizes, spacing } from "../theme";

type MapNode = Extract<UINode, { type: "Map" }>;

/** One thing on a plugin map, by its key on the map page (`<layer>:<id>`: ids are unique within a layer only). */
type Item = {
  key: string;
  kind: MapLayer["kind"];
  title: string;
  subtitle?: string;
  tone?: Tone;
  onPress?: Action;
  /** Where the map flies when the item is picked from the list. */
  anchor: GeoPoint;
};

/** A plugin's map node → what MapView draws, and the flat list of its items (the map is a canvas). */
function mapDataOf(node: MapNode) {
  const keyed = node.layers.flatMap((layer, l) =>
    layer.items.map((item) => ({ layer, item, key: `${l}:${item.id}`, tone: item.tone ?? layer.tone })),
  );
  const pins: MapPin[] = keyed.flatMap(({ item, key, tone }) =>
    "at" in item ? [{ id: key, title: item.title, tone, ...item.at }] : [],
  );
  const routes: MapRoute[] = keyed.flatMap(({ item, key, tone }) =>
    "path" in item ? [{ id: key, path: item.path, tone, dashed: item.dashed }] : [],
  );
  const areas = keyed.flatMap(({ item, key, tone }): MapArea[] =>
    "polygon" in item
      ? [{ id: key, tone, polygon: item.polygon }]
      : "center" in item
        ? [{ id: key, tone, center: item.center, radius: item.radius }]
        : [],
  );
  const items: Item[] = keyed.map(({ layer, item, key, tone }) => ({
    key,
    kind: layer.kind,
    title: item.title,
    subtitle: item.subtitle,
    tone,
    onPress: item.onPress,
    anchor:
      "at" in item
        ? item.at
        : "path" in item
          ? (item.path[Math.floor(item.path.length / 2)] as GeoPoint)
          : "center" in item
            ? item.center
            : (item.polygon[0] as GeoPoint),
  }));
  return { pins, routes, areas, items };
}

/**
 * A plugin's map (`ui.map`): MapView with its pins, routes and areas, a legend when it has several layers, the card of
 * what was tapped on the map, and the list of everything on it (behind "Pokaż listę"), which is what screen readers,
 * keyboards and E2E use. In a dashboard widget (`still`) it is only a still preview: the tile is what is pressable.
 */
export function PluginMap({
  node,
  still,
  onAction,
}: {
  node: MapNode;
  still: boolean;
  onAction: (action: Action) => void;
}) {
  const map = useRef<MapViewHandle>(null);
  const data = useMemo(() => mapDataOf(node), [node]);
  const [selected, setSelected] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const picked = data.items.find((item) => item.key === selected);

  const select = (key: string) => {
    setSelected(key);
    const item = data.items.find((i) => i.key === key);
    if (item) map.current?.flyTo(item.anchor);
  };
  const open = (item: Item) => (item.onPress ? onAction(item.onPress) : select(item.key));

  return (
    <View style={styles.root}>
      <MapView
        ref={map}
        label={node.label}
        center={node.center ?? DEFAULT_CENTER}
        zoom={node.zoom ?? (node.center ? STREET_ZOOM : CITY_ZOOM)}
        fit={!node.center}
        pins={data.pins}
        routes={data.routes}
        areas={data.areas}
        selectedId={selected}
        interactive={!still}
        onPinPress={select}
        style={still ? styles.still : styles.map}
      />
      {still ? null : (
        <>
          {node.layers.length > 1 ? <Legend layers={node.layers} /> : null}
          {picked ? <PickedItem item={picked} onPress={() => open(picked)} /> : null}
          <Button
            label={`${listOpen ? t.plugin_map_list_hide : t.plugin_map_list_show} (${data.items.length})`}
            variant="ghost"
            size="sm"
            fullWidth={false}
            onPress={() => setListOpen((v) => !v)}
            style={styles.toggle}
          />
          {listOpen ? (
            <View role="list" aria-label={node.label}>
              {data.items.map((item, i) => (
                <View key={item.key} role="listitem" style={i > 0 ? styles.divider : undefined}>
                  <ItemRow item={item} onPress={() => open(item)} />
                </View>
              ))}
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

/** The colour mark of a layer or an item: a dot for pins, a line for routes, a square for areas. */
function Swatch({ kind, tone }: { kind: MapLayer["kind"]; tone?: Tone }) {
  const color = colorOf(tone);
  return (
    <View
      style={[
        kind === "pins" ? styles.swatchPin : kind === "routes" ? styles.swatchRoute : styles.swatchArea,
        kind === "areas" ? { borderColor: color } : { backgroundColor: color },
      ]}
    />
  );
}

function Legend({ layers }: { layers: MapLayer[] }) {
  return (
    <View role="list" aria-label={t.plugin_map_legend} style={styles.legend}>
      {layers.map((layer, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: layers have no ids; order = identity
        <View key={i} role="listitem" style={styles.legendItem}>
          <Swatch kind={layer.kind} tone={layer.tone} />
          <Text variant="small" color="textSecondary">
            {layer.title}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** What was tapped on the map: its title and subtitle; pressing it runs its action (a chevron says it has one). */
function PickedItem({ item, onPress }: { item: Item; onPress: () => void }) {
  const body = (
    <Card style={styles.picked}>
      <ItemText item={item} />
      {item.onPress ? <Icon icon={ChevronRight} size={sizes.iconS} color="iconMuted" /> : null}
    </Card>
  );
  return item.onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.title}
      onPressIn={tapFeedback}
      onPress={onPress}
      style={({ pressed }) => (pressed ? styles.pressed : undefined)}
    >
      {body}
    </Pressable>
  ) : (
    body
  );
}

function ItemText({ item }: { item: Item }) {
  return (
    <View style={styles.itemText}>
      <View style={styles.itemTitle}>
        <Swatch kind={item.kind} tone={item.tone} />
        <Text variant="cardTitle" style={styles.shrink}>
          {item.title}
        </Text>
      </View>
      {item.subtitle ? (
        <Text variant="small" color="textSecondary">
          {item.subtitle}
        </Text>
      ) : null}
    </View>
  );
}

/** A row of the map's list: its action, or (without one) showing it on the map. */
function ItemRow({ item, onPress }: { item: Item; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[item.title, item.subtitle].filter(Boolean).join(", ")}
      onPressIn={tapFeedback}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <ItemText item={item} />
      {item.onPress ? <Icon icon={ChevronRight} size={sizes.iconS} color="iconMuted" /> : null}
    </Pressable>
  );
}

const frame = {
  borderRadius: radii.xl,
  borderWidth: borders.hairline,
  borderColor: colors.border,
} as const;

const styles = StyleSheet.create({
  root: { gap: spacing[5] },
  map: { ...frame, height: sizes.pluginMap },
  still: { ...frame, height: sizes.locationPreview },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: spacing[6] },
  legendItem: { flexDirection: "row", alignItems: "center", gap: spacing[3] },
  swatchPin: { width: sizes.mapSwatch, height: sizes.mapSwatch, borderRadius: sizes.mapSwatch / 2 },
  swatchRoute: { width: sizes.mapSwatchRoute, height: mapMarks.routeWidth, borderRadius: mapMarks.routeWidth / 2 },
  swatchArea: {
    width: sizes.mapSwatch,
    height: sizes.mapSwatch,
    borderRadius: sizes.mapSwatch / 4,
    borderWidth: borders.selected,
  },
  picked: { flexDirection: "row", alignItems: "center", gap: spacing[6] },
  toggle: { alignSelf: "flex-start" },
  divider: { borderTopWidth: borders.hairline, borderTopColor: colors.divider },
  row: { flexDirection: "row", alignItems: "center", gap: spacing[6], paddingVertical: spacing[5] },
  itemText: { flex: 1, gap: spacing[1] },
  itemTitle: { flexDirection: "row", alignItems: "center", gap: spacing[4] },
  shrink: { flexShrink: 1 },
  pressed: { opacity: opacity.pressed },
});
