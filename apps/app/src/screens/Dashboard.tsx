import type { MyPlace } from "@app/shared";
import { useRouter } from "expo-router";
import Head from "expo-router/head";
import { ChevronDown, LayoutDashboard } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { BottomSheet, Button, Card, DashboardMap, Heading, Icon, Link, PlaceRow, Screen, Text } from "../components";
import { useCommunities, useCommunityNav, useDashboard, useSetDefaultPlace, useVisitPlace } from "../data/communities";
import { useSession } from "../data/session";
import { currentPlace } from "../lib/places";
import { widgetsCount } from "../lib/plural";
import { Dashboard as DashboardWidgets } from "../plugins/Dashboard";
import { pluginHref } from "../plugins/href";
import { t } from "../texts";
import { borders, colors, radii, sizes, spacing } from "../theme";

/** Dashboard after sign-in (design E-Dashboard): greeting, the current place, its widgets, the switcher and the bottom bar. */
export default function Dashboard() {
  const places = useCommunities();
  if (places.isPending) {
    return (
      <Screen chrome={false} tabBar>
        <Text variant="bodyL" color="textSecondary">
          {t.loading}
        </Text>
      </Screen>
    );
  }
  const list = places.data ?? [];
  const current = currentPlace(list);
  return current ? <PlaceDashboard place={current} places={list} /> : <NoPlaces />;
}

/** Stage for a user without places: create one or join an existing one. */
function NoPlaces() {
  const router = useRouter();
  return (
    <Screen chrome={false} tabBar backdrop={<DashboardMap />}>
      <Head>
        <title>{t.app_name}</title>
      </Head>
      <Greeting />
      <Heading level={1} variant="heading">
        {t.dashboard_empty_title}
      </Heading>
      <Text variant="bodyL" color="textSecondary">
        {t.dashboard_empty_body}
      </Text>
      <Button label={t.place_create} onPress={() => router.push("/app/create")} />
      <Button label={t.place_join} variant="secondary" onPress={() => router.push("/app/join")} />
    </Screen>
  );
}

/** "Dzień dobry, <name>" — the signed-in user's name from the session. */
function Greeting() {
  const session = useSession();
  return (
    <Text variant="body" color="textSecondary">
      {session.data?.name ? `${t.dashboard_greeting}, ${session.data.name}` : t.dashboard_greeting}
    </Text>
  );
}

function PlaceDashboard({ place, places }: { place: MyPlace; places: MyPlace[] }) {
  const router = useRouter();
  const visit = useVisitPlace();
  const setDefault = useSetDefaultPlace();
  const nav = useCommunityNav(place.slug);
  const widgets = useDashboard(place.slug);
  const [switching, setSwitching] = useState(false);
  const { mutate: visitPlace } = visit;

  // Showing a place remembers it as the last visited one; the dashboard opens on it next time.
  useEffect(() => {
    visitPlace(place.slug);
  }, [place.slug, visitPlace]);

  const choose = (slug: string) => {
    setSwitching(false);
    visitPlace(slug);
  };

  const widgetList = widgets.data?.widgets ?? [];

  return (
    <Screen
      chrome={false}
      tabBar
      backdrop={<DashboardMap />}
      overlay={
        <BottomSheet visible={switching} title={t.places_sheet_title} onClose={() => setSwitching(false)}>
          <View style={styles.sheetList}>
            {places.map((p) => (
              <PlaceRow key={p.id} place={p} active={p.id === place.id} onPress={() => choose(p.slug)} />
            ))}
          </View>
          <Button label={t.place_set_default} variant="secondary" onPress={() => setDefault.mutate(place.slug)} />
          <Button
            label={t.place_join}
            variant="secondary"
            onPress={() => {
              setSwitching(false);
              router.push("/app/join");
            }}
          />
          <Button
            label={t.place_create}
            onPress={() => {
              setSwitching(false);
              router.push("/app/create");
            }}
          />
        </BottomSheet>
      }
    >
      <Head>
        <title>{place.name}</title>
      </Head>
      <Greeting />

      <View style={styles.place}>
        <Text variant="label" color="textSecondary">
          {t.place_current_label}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={place.name}
          hitSlop={spacing[6]}
          onPress={() => setSwitching(true)}
          style={styles.nameRow}
        >
          <Heading level={1} variant="heading">
            {place.name}
          </Heading>
          <View style={styles.chevron}>
            <Icon icon={ChevronDown} size={spacing[8]} color="primary" strokeWidth={2.6} />
          </View>
        </Pressable>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Text variant="label" color="textSecondary">
            {t.community_dashboard_label}
          </Text>
          <Text variant="small" color="textSecondary">
            {widgetsCount(widgetList.length)}
          </Text>
        </View>
        {widgets.isPending ? null : widgetList.length ? <DashboardWidgets slug={place.slug} /> : <EmptyGrid />}
      </View>

      <View style={styles.section}>
        <Text variant="label" color="textSecondary">
          {t.community_features_label}
        </Text>
        {nav.isPending ? null : nav.data?.length ? (
          nav.data.map((n) => (
            <Card key={`${n.pluginId}/${n.view}`} style={styles.feature}>
              <Text variant="headingS" aria-hidden>
                {n.icon}
              </Text>
              <Link href={pluginHref(place.slug, n.pluginId, n.view)}>{n.label}</Link>
            </Card>
          ))
        ) : (
          <Text variant="bodyL" color="textSecondary">
            {t.community_features_empty}
          </Text>
        )}
      </View>
    </Screen>
  );
}

/** Two-column grid with a span-2 empty-state card and dashed placeholder tiles (design: no widgets yet). */
function EmptyGrid() {
  return (
    <View style={styles.grid}>
      <Card style={styles.emptyCard}>
        <View style={styles.emptyIcon}>
          <Icon icon={LayoutDashboard} size={spacing[9]} color="primary" />
        </View>
        <View style={styles.emptyText}>
          <Heading level={2}>{t.widgets_empty_title}</Heading>
          <Text variant="caption" color="textSecondary">
            {t.widgets_empty_body}
          </Text>
        </View>
      </Card>
      <PlaceholderTile number="01" />
      <PlaceholderTile number="02" />
      <PlaceholderTile number="03" wide />
    </View>
  );
}

function PlaceholderTile({ number, wide = false }: { number: string; wide?: boolean }) {
  return (
    <View style={[styles.placeholder, wide ? styles.placeholderWide : styles.placeholderSquare]}>
      <Text variant="label" color="textMuted">
        {number}
      </Text>
    </View>
  );
}

const GAP = spacing[6];

const styles = StyleSheet.create({
  place: { gap: spacing[2] },
  nameRow: { flexDirection: "row", alignItems: "center", gap: spacing[6] },
  chevron: {
    width: spacing[8] * 2,
    height: spacing[8] * 2,
    borderRadius: radii.xl,
    backgroundColor: colors.primaryTint,
    alignItems: "center",
    justifyContent: "center",
  },
  section: { gap: spacing[6] },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GAP },
  emptyCard: { width: "100%", flexDirection: "row", alignItems: "center", gap: spacing[8] },
  emptyIcon: {
    width: sizes.iconBoxLg,
    height: sizes.iconBoxLg,
    borderRadius: radii.lg,
    backgroundColor: colors.primaryTint,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: { flex: 1, gap: spacing[1] },
  placeholder: {
    height: sizes.placeholderTile,
    borderWidth: borders.row,
    borderStyle: "dashed",
    borderColor: colors.dashed,
    borderRadius: radii["3xl"],
    padding: spacing[7],
    justifyContent: "flex-end",
  },
  placeholderSquare: { flexBasis: "47%", flexGrow: 1 },
  placeholderWide: { width: "100%", height: sizes.placeholderTileWide },
  feature: { flexDirection: "row", alignItems: "center" },
  sheetList: { gap: spacing[4] },
});
