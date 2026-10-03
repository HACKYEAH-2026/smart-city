import type { MyPlace } from "@app/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import Head from "expo-router/head";
import { ChevronDown, LayoutDashboard, LogIn, Plus, Settings } from "lucide-react-native";
import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import {
  BottomSheet,
  Button,
  Card,
  DashboardMap,
  Heading,
  Icon,
  IconButton,
  Link,
  PlaceRow,
  Screen,
  Text,
} from "../components";
import { useCommunities, useCommunityNav, useDashboard, useSetDefaultPlace, useVisitPlace } from "../data/communities";
import { useSession } from "../data/session";
import { tapFeedback } from "../lib/haptics";
import { currentPlace } from "../lib/places";
import { widgetsCount } from "../lib/plural";
import { Dashboard as DashboardWidgets } from "../plugins/Dashboard";
import { pluginHref } from "../plugins/href";
import { t } from "../texts";
import { colors, radii, sizes, spacing } from "../theme";
import JoinPlace from "./JoinPlace";

/**
 * Dashboard after sign-in (design E-Dashboard): greeting, the current place, its widgets, the place switcher and the
 * bottom bar. Without places: the ways to join a place and creating one (design E-BrakMiejsc).
 */
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
  return current ? <PlaceDashboard place={current} places={list} /> : <JoinPlace />;
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
  const { mutate: visitPlace } = visit;
  // The switcher is part of the URL (/app?places=1), so the "Miejsca" tab can open it from any screen.
  const { places: switcherParam } = useLocalSearchParams<{ places?: string }>();
  const switching = switcherParam === "1";
  const openSwitcher = () => router.setParams({ places: "1" });
  const closeSwitcher = () => router.setParams({ places: undefined });

  // Showing a place remembers it as the last visited one; the dashboard opens on it next time.
  useEffect(() => {
    visitPlace(place.slug);
  }, [place.slug, visitPlace]);

  const widgetList = widgets.data?.widgets ?? [];

  return (
    <Screen
      chrome={false}
      tabBar
      backdrop={<DashboardMap />}
      overlay={
        // Design E-PrzelacznikMiejsc: picking a row switches the dashboard behind the sheet; the sheet stays open.
        <BottomSheet visible={switching} title={t.places_sheet_title} onClose={closeSwitcher}>
          <View style={styles.sheetList}>
            {places.map((p) => (
              <PlaceRow key={p.id} place={p} active={p.id === place.id} onPress={() => visitPlace(p.slug)} />
            ))}
          </View>
          <Button label={t.place_set_default} variant="secondary" onPress={() => setDefault.mutate(place.slug)} />
          <View style={styles.sheetActions}>
            <Button
              label={t.place_join}
              variant="secondary"
              leftIcon={<Icon icon={LogIn} size={sizes.iconS} strokeWidth={2} />}
              style={styles.sheetAction}
              onPress={() => router.push("/app/join-place")}
            />
            <Button
              label={t.place_create}
              leftIcon={<Icon icon={Plus} size={sizes.iconS} color="onPrimary" strokeWidth={2.2} />}
              style={styles.sheetAction}
              onPress={() => router.push("/app/create")}
            />
          </View>
        </BottomSheet>
      }
    >
      <Head>
        <title>{place.name}</title>
      </Head>
      <View style={styles.top}>
        <Greeting />
        {place.role === "admin" ? (
          <IconButton icon={Settings} label={t.manage_title} variant="round" href={`/app/c/${place.slug}/manage`} />
        ) : null}
      </View>

      <View style={styles.place}>
        <Text variant="label" color="textSecondary">
          {t.place_current_label}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t.place_switch}: ${place.name}`}
          hitSlop={spacing[6]}
          onPress={openSwitcher}
          onPressIn={tapFeedback}
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
        {widgets.isPending ? null : widgetList.length ? <DashboardWidgets slug={place.slug} /> : <EmptyDashboard />}
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

/** Empty-state card while the place has no widgets yet (designs E-Dashboard, E-DashboardAdmin). */
function EmptyDashboard() {
  return (
    <Card style={styles.emptyCard}>
      <View style={styles.emptyIcon}>
        <Icon icon={LayoutDashboard} size={sizes.emptyIcon} color="primary" />
      </View>
      <View style={styles.emptyText}>
        <Heading level={2} variant="cardTitle">
          {t.widgets_empty_title}
        </Heading>
        <Text variant="captionRelaxed" color="textSecondary">
          {t.widgets_empty_body}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing[6] },
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
  emptyCard: { flexDirection: "row", alignItems: "center", gap: spacing[8] },
  emptyIcon: {
    width: sizes.iconBoxLg,
    height: sizes.iconBoxLg,
    borderRadius: radii.lg,
    backgroundColor: colors.primaryTint,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: { flex: 1, gap: spacing[2] },
  feature: { flexDirection: "row", alignItems: "center" },
  sheetList: { gap: spacing[4] },
  sheetActions: { flexDirection: "row", gap: spacing[5] },
  sheetAction: { flex: 1 },
});
