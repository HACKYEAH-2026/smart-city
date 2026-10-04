import type { GeoPoint } from "@app/plugin-sdk";
import type { MapPlace } from "@app/shared";
import { useRouter } from "expo-router";
import Head from "expo-router/head";
import { LocateFixed, X } from "lucide-react-native";
import { useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Badge,
  BottomTabBar,
  Button,
  Heading,
  IconBox,
  IconButton,
  MapView,
  type MapViewHandle,
  Text,
} from "../components";
import { useVisitPlace } from "../data/communities";
import { useMapPlaces } from "../data/geo";
import { tapFeedback } from "../lib/haptics";
import { currentPosition } from "../lib/location";
import { CITY_ZOOM, DEFAULT_CENTER, STREET_ZOOM } from "../lib/map/spec";
import { placeKindIcon, placeKindLabel } from "../lib/placeKinds";
import { t } from "../texts";
import { colors, layout, opacity, radii, shadows, sizes, spacing } from "../theme";

/**
 * The map of places (bottom bar → "Mapa"): places their admins show on the map and the user's own places. A pin or
 * a row of the list under the map opens the place's card; members can open the place, others learn how to join.
 * The list is the pins' accessible twin (the pins are drawn on a canvas).
 */
export default function PlacesMap() {
  const insets = useSafeAreaInsets();
  const map = useRef<MapViewHandle>(null);
  const places = useMapPlaces();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [me, setMe] = useState<GeoPoint | null>(null);
  const list = places.data ?? [];
  const selected = list.find((place) => place.id === selectedId) ?? null;
  const pins = useMemo(
    () => list.map((place) => ({ id: place.id, title: place.name, lat: place.lat, lng: place.lng })),
    [list],
  );

  const select = (id: string) => {
    const place = list.find((p) => p.id === id);
    if (!place) return;
    setSelectedId(id);
    map.current?.flyTo(place, STREET_ZOOM);
  };
  const locate = async () => {
    const position = await currentPosition();
    if (!position) return;
    setMe(position);
    map.current?.flyTo(position, STREET_ZOOM);
  };

  return (
    <View style={styles.root}>
      <Head>
        <title>{t.map_title}</title>
      </Head>
      <View style={styles.mapArea}>
        <MapView
          ref={map}
          label={t.map_label}
          center={DEFAULT_CENTER}
          zoom={CITY_ZOOM}
          pins={pins}
          selectedId={selectedId}
          me={me}
          onPinPress={select}
          bottomInset={radii.sheet}
          style={StyleSheet.absoluteFill}
        />
        <View pointerEvents="box-none" style={[styles.top, { paddingTop: insets.top + layout.screenTopOffset }]}>
          <View style={styles.title}>
            <Heading level={1} variant="headingS">
              {t.map_title}
            </Heading>
          </View>
          <IconButton icon={LocateFixed} label={t.location_my} variant="floating" color="mapMe" onPress={locate} />
        </View>
      </View>
      <View role="main" style={styles.panel}>
        {selected ? (
          <PlaceCard place={selected} onClose={() => setSelectedId(null)} />
        ) : places.isError ? (
          <Text variant="bodyL" color="primaryPressed" role="alert">
            {t.map_error}
          </Text>
        ) : places.isPending ? (
          <Text variant="bodyL" color="textSecondary">
            {t.loading}
          </Text>
        ) : list.length ? (
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            <View role="list" aria-label={t.map_list_label} style={styles.rows}>
              {list.map((place) => (
                <View role="listitem" key={place.id}>
                  <MapPlaceRow place={place} onPress={() => select(place.id)} />
                </View>
              ))}
            </View>
          </ScrollView>
        ) : (
          <Text variant="bodyL" color="textSecondary">
            {t.map_empty}
          </Text>
        )}
      </View>
      <BottomTabBar />
    </View>
  );
}

/** A place in the list under the map: the kind's icon, name, kind and address; "Twoje" on the user's own places. */
function MapPlaceRow({ place, onPress }: { place: MapPlace; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${place.name}, ${placeKindLabel(place.kind)}`}
      onPressIn={tapFeedback}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <IconBox icon={placeKindIcon(place.kind)} />
      <View style={styles.rowText}>
        <View style={styles.rowTitle}>
          <Text variant="cardTitle">{place.name}</Text>
          {place.slug ? <Badge text={t.map_member} tone="accent" /> : null}
        </View>
        <Text variant="small" color="textSecondary" numberOfLines={1}>
          {[placeKindLabel(place.kind), place.address].filter(Boolean).join(" · ")}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * The selected place: name, kind, address; members open it (it becomes their current place), others join an open
 * place through its preview (as with a scanned code) or see how to join.
 */
function PlaceCard({ place, onClose }: { place: MapPlace; onClose: () => void }) {
  return (
    <View role="region" aria-label={place.name} style={styles.card}>
      <View style={styles.cardHead}>
        <IconBox icon={placeKindIcon(place.kind)} />
        <View style={styles.rowText}>
          <Heading level={2} variant="headingS">
            {place.name}
          </Heading>
          <Text variant="small" color="textSecondary">
            {placeKindLabel(place.kind)}
          </Text>
        </View>
        <IconButton icon={X} label={t.close} variant="roundSunken" onPress={onClose} />
      </View>
      {place.address ? <Text variant="bodyL">{place.address}</Text> : null}
      <PlaceAction place={place} />
    </View>
  );
}

function PlaceAction({ place }: { place: MapPlace }) {
  const router = useRouter();
  const visit = useVisitPlace();
  const { slug, inviteCode } = place;
  if (slug) {
    const open = () => visit.mutate(slug, { onSuccess: () => router.replace("/app") });
    return <Button label={t.map_open_place} disabled={visit.isPending} onPress={open} />;
  }
  if (inviteCode) {
    const join = () => router.push({ pathname: "/app/preview", params: { code: inviteCode } } as never);
    return <Button label={t.map_join_place} onPress={join} />;
  }
  return (
    <Text variant="caption" color="textSecondary">
      {t.map_join_hint}
    </Text>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  mapArea: { flex: 1 },
  top: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[8],
  },
  title: {
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[8],
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    ...shadows.floating,
  },
  panel: {
    maxHeight: sizes.mapPanel,
    marginTop: -radii.sheet,
    paddingTop: spacing[9],
    paddingHorizontal: layout.screenPaddingX,
    paddingBottom: spacing[8],
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    backgroundColor: colors.background,
    gap: spacing[6],
  },
  list: { flexGrow: 0 },
  listContent: { paddingBottom: spacing[4] },
  rows: { gap: spacing[5] },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[7],
    padding: spacing[5],
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  pressed: { opacity: opacity.pressed },
  rowText: { flex: 1, gap: spacing[1] },
  rowTitle: { flexDirection: "row", alignItems: "center", gap: spacing[4] },
  card: { gap: spacing[8] },
  cardHead: { flexDirection: "row", alignItems: "center", gap: spacing[7] },
});
