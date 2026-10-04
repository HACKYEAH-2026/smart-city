import type { GeoPoint } from "@app/plugin-sdk";
import type { GeoAddress } from "@app/shared";
import Head from "expo-router/head";
import { ChevronLeft, LocateFixed, type LucideIcon, MapPin } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { BackHandler, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Button,
  Card,
  Icon,
  IconBox,
  IconButton,
  MapView,
  type MapViewHandle,
  PlacePin,
  SearchField,
  Text,
} from "../components";
import { useAddressAt, useAddressSearch } from "../data/geo";
import { tapFeedback } from "../lib/haptics";
import { currentPosition } from "../lib/location";
import { DEFAULT_CENTER, STREET_ZOOM } from "../lib/map/spec";
import { t } from "../texts";
import { colors, layout, opacity, radii, sizes, spacing } from "../theme";

export type PickedLocation = { location: GeoPoint; address: string };

export interface LocationPickerProps {
  /** The page title (the wizard: "Lokalizacja miejsca"; a plugin: its field's label). */
  title?: string;
  /** Under the address in the panel: what the pin is for ("Kamienica · tu pojawi się pinezka miejsca"). */
  hint: string;
  /** In the pin (the wizard: the place kind's icon). */
  icon?: LucideIcon;
  initial: GeoPoint | null;
  onConfirm: (picked: PickedLocation) => void;
  onCancel: () => void;
}

/**
 * Where something is (design: the location picker of the "new place" wizard; plugins' location fields reuse it). The
 * pin stays in the middle: the user moves the map under it, taps the map, finds an address or goes to their own
 * position. The panel shows the address under the pin (the geocoder's; an address picked from the search is kept as it
 * is). Shown over the form that opened it, so going back keeps the answers; the system back button closes it too.
 */
export default function LocationPicker({
  title = t.location_title,
  hint,
  icon = MapPin,
  initial,
  onConfirm,
  onCancel,
}: LocationPickerProps) {
  const insets = useSafeAreaInsets();
  const map = useRef<MapViewHandle>(null);
  const [start] = useState(() => initial ?? DEFAULT_CENTER);
  const [pin, setPin] = useState<GeoPoint>(start);
  const [found, setFound] = useState<GeoAddress | null>(null);
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [me, setMe] = useState<GeoPoint | null>(null);
  const [meFailed, setMeFailed] = useState(false);
  const search = useAddressSearch(submitted, pin);
  const lookup = useAddressAt(found ? null : pin);
  const address = found ?? lookup.data?.address ?? null;

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      onCancel();
      return true;
    });
    return () => subscription.remove();
  }, [onCancel]);

  const movePin = (to: GeoPoint) => {
    setFound(null);
    setPin(to);
  };
  const choose = (result: GeoAddress) => {
    setFound(result);
    setPin(result);
    setSubmitted(null);
    map.current?.flyTo(result, STREET_ZOOM);
  };
  const locate = async () => {
    const position = await currentPosition();
    setMeFailed(!position);
    if (!position) return;
    setMe(position);
    movePin(position);
    map.current?.flyTo(position, STREET_ZOOM);
  };
  const submit = (text: string) => {
    const trimmed = text.trim();
    if (trimmed.length >= 2) setSubmitted(trimmed);
  };

  return (
    <View style={styles.root}>
      <Head>
        <title>{title}</title>
      </Head>
      <View style={styles.mapArea}>
        <MapView
          ref={map}
          label={t.map_label}
          center={start}
          zoom={STREET_ZOOM}
          me={me}
          bottomInset={radii.sheet}
          onTap={movePin}
          onMove={(center, user) => user && movePin(center)}
          style={StyleSheet.absoluteFill}
        />
        <PlacePin icon={icon} />
        <View style={styles.locate}>
          <IconButton icon={LocateFixed} label={t.location_my} variant="floating" color="mapMe" onPress={locate} />
        </View>
      </View>
      <View pointerEvents="box-none" style={[styles.top, { paddingTop: insets.top + layout.screenTopOffset }]}>
        <View style={styles.searchRow}>
          <IconButton icon={ChevronLeft} label={t.back} variant="roundOnImage" onPress={onCancel} />
          <SearchField
            label={t.location_search}
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              if (!text) setSubmitted(null);
            }}
            onSubmit={submit}
          />
        </View>
        {submitted ? (
          <SearchResults
            loading={search.isFetching}
            failed={search.isError}
            results={search.data ?? []}
            onChoose={choose}
          />
        ) : (
          <View style={styles.hint}>
            <Text variant="caption" color="onPrimary">
              {t.location_hint}
            </Text>
          </View>
        )}
      </View>
      <View style={[styles.panel, { paddingBottom: insets.bottom + spacing[8] }]}>
        <View style={styles.handle} />
        <View style={styles.address}>
          <IconBox icon={MapPin} />
          <View style={styles.addressText}>
            <Text variant="cardTitle">
              {address ? address.address : lookup.isFetching ? t.location_looking_up : t.location_unknown}
            </Text>
            <Text variant="small" color="textSecondary">
              {hint}
            </Text>
          </View>
        </View>
        {meFailed ? (
          <Text variant="small" color="primaryPressed" role="alert">
            {t.location_my_unavailable}
          </Text>
        ) : null}
        <Button
          label={t.location_confirm}
          onPress={() => onConfirm({ location: pin, address: address?.address ?? "" })}
        />
      </View>
    </View>
  );
}

/** Addresses found by the search, under the search field; a tap moves the pin there. */
function SearchResults({
  loading,
  failed,
  results,
  onChoose,
}: {
  loading: boolean;
  failed: boolean;
  results: GeoAddress[];
  onChoose: (result: GeoAddress) => void;
}) {
  const message = loading
    ? t.location_searching
    : failed
      ? t.location_search_error
      : results.length
        ? null
        : t.location_no_results;
  return (
    <Card style={styles.results}>
      {message ? (
        <Text variant="body" color="textSecondary" role={failed ? "alert" : undefined}>
          {message}
        </Text>
      ) : (
        <View role="list" aria-label={t.location_results}>
          {results.map((result) => (
            <View role="listitem" key={`${result.label}|${result.detail}|${result.lat}`}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={[result.label, result.detail].filter(Boolean).join(", ")}
                onPressIn={tapFeedback}
                onPress={() => onChoose(result)}
                style={({ pressed }) => [styles.result, pressed && styles.pressed]}
              >
                <Icon icon={MapPin} size={sizes.iconS} color="primary" />
                <View style={styles.addressText}>
                  <Text variant="buttonM">{result.label}</Text>
                  {result.detail ? (
                    <Text variant="small" color="textSecondary">
                      {result.detail}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.mapBase },
  mapArea: { flex: 1 },
  top: { position: "absolute", top: 0, left: 0, right: 0, paddingHorizontal: spacing[8], gap: spacing[6] },
  searchRow: { flexDirection: "row", alignItems: "center", gap: spacing[5] },
  hint: {
    alignSelf: "center",
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[8],
    borderRadius: radii.pill,
    backgroundColor: colors.text,
  },
  results: { gap: spacing[2], paddingVertical: spacing[4] },
  result: { flexDirection: "row", alignItems: "center", gap: spacing[6], paddingVertical: spacing[5] },
  pressed: { opacity: opacity.pressed },
  panel: {
    marginTop: -radii.sheet,
    gap: spacing[8],
    paddingTop: spacing[5],
    paddingHorizontal: layout.screenPaddingX,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    backgroundColor: colors.background,
  },
  locate: { position: "absolute", right: spacing[8], bottom: radii.sheet + spacing[8] },
  handle: {
    alignSelf: "center",
    width: sizes.sheetHandleWidth,
    height: sizes.sheetHandleHeight,
    borderRadius: radii.pill,
    backgroundColor: colors.dashed,
  },
  address: { flexDirection: "row", alignItems: "center", gap: spacing[7] },
  addressText: { flex: 1, gap: spacing[1] },
});
