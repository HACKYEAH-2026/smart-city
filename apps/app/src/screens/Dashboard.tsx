import type { MyPlace } from "@app/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import Head from "expo-router/head";
import {
  ChevronDown,
  Keyboard,
  LayoutDashboard,
  Link as LinkIcon,
  LogIn,
  Plus,
  QrCode,
  User,
  UserPlus,
} from "lucide-react-native";
import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import {
  ActionRow,
  BottomSheet,
  Brand,
  Button,
  Card,
  CreateRow,
  DashboardMap,
  Heading,
  HeroBanner,
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
import { currentPlace, initials } from "../lib/places";
import { widgetsCount } from "../lib/plural";
import { Dashboard as DashboardWidgets } from "../plugins/Dashboard";
import { pluginHref } from "../plugins/href";
import { t } from "../texts";
import { colors, radii, sizes, spacing } from "../theme";

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
  return current ? <PlaceDashboard place={current} places={list} /> : <NoPlaces />;
}

/** A user without places (design E-BrakMiejsc): the ways to join a place, or creating their own. No bottom bar. */
function NoPlaces() {
  return (
    <Screen chrome={false}>
      <Head>
        <title>{t.app_name}</title>
      </Head>
      <View style={styles.topBar}>
        <Brand />
        <AccountButton />
      </View>
      <HeroBanner label={t.dashboard_empty_label} title={t.dashboard_empty_title} />
      <View style={styles.methods}>
        <Heading level={2} variant="label" color="textSecondary">
          {t.join_methods_title}
        </Heading>
        <ActionRow icon={QrCode} title={t.join_qr} subtitle={t.join_qr_hint} href="/app/join" />
        <ActionRow icon={Keyboard} title={t.join_code} subtitle={t.join_code_hint} href="/app/join" />
        <ActionRow icon={LinkIcon} title={t.join_link} subtitle={t.join_link_hint} href="/app/join" />
        <ActionRow icon={UserPlus} title={t.join_invites} subtitle={t.join_invites_hint} href="/app/join" />
      </View>
      <View style={styles.grow} />
      <CreateRow label={t.place_create_own} href="/app/create" />
    </Screen>
  );
}

/** Round account button: the user's initials (or a person icon without a name); opens the account. */
function AccountButton() {
  const router = useRouter();
  const session = useSession();
  const name = session.data?.name?.trim() ?? "";
  const open = () => router.push("/app/account");
  return name ? (
    <IconButton variant="round" text={initials(name)} label={t.account_title} onPress={open} />
  ) : (
    <IconButton variant="round" icon={User} label={t.account_title} onPress={open} />
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
              onPress={() => router.push("/app/join")}
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
      <Greeting />

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
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  methods: { gap: spacing[5] },
  grow: { flex: 1 },
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
