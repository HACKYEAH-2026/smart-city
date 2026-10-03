import type { Action, WidgetSize } from "@app/plugin-sdk";
import { useLocalSearchParams, useRouter } from "expo-router";
import Head from "expo-router/head";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Card, Heading, Link, Screen, Text } from "../components";
import { useCommunity, useCommunityNav, useCommunityWidgets } from "../data/communities";
import { pluginHref } from "../plugins/href";
import { PluginRenderer } from "../plugins/Renderer";
import { t } from "../texts";
import { sizes, spacing } from "../theme";

/** Community page: the dashboard (plugin widgets) and features = nav entries of installed plugins (refreshed live). */
export default function Community() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const community = useCommunity(slug);
  const nav = useCommunityNav(slug);
  return (
    <Screen>
      <Head>
        <title>{community.data?.name ?? t.communities_title}</title>
      </Head>
      <View style={styles.head}>
        <Link href="/app">{t.community_back}</Link>
        <Heading level={1}>{community.data?.name ?? t.loading}</Heading>
      </View>
      <Dashboard slug={slug} />
      {nav.isPending ? (
        <Text variant="bodyL" color="textSecondary">
          {t.loading}
        </Text>
      ) : (
        <View role="list" aria-label={t.community_features_label} style={styles.grid}>
          {nav.data?.length ? (
            nav.data.map((n) => (
              <View key={`${n.pluginId}/${n.view}`} role="listitem" style={styles.tile}>
                <Card style={styles.card}>
                  <Text variant="headingS" aria-hidden>
                    {n.icon}
                  </Text>
                  <Link href={pluginHref(slug, n.pluginId, n.view)}>{n.label}</Link>
                </Card>
              </View>
            ))
          ) : (
            <View role="listitem">
              <Text variant="bodyL" color="textSecondary">
                {t.community_features_empty}
              </Text>
            </View>
          )}
        </View>
      )}
    </Screen>
  );
}

const GAP = spacing[6];

/** Pixel size of a widget tile in a 2-column grid of `width`; rows are `sizes.widgetRow` high. */
const tileSize = (size: WidgetSize, width: number) => ({
  width: size.w === 2 ? width : (width - GAP) / 2,
  height: size.h * sizes.widgetRow + (size.h - 1) * GAP,
});

/** Widgets of the installed plugins in a 2-column grid; each tile has the size its plugin declares. */
function Dashboard({ slug }: { slug: string }) {
  const router = useRouter();
  const widgets = useCommunityWidgets(slug);
  const [width, setWidth] = useState(0);
  if (!widgets.data?.length) return null;
  const open = (pluginId: string) => (action: Action) => {
    if (action.type === "navigate") router.push(pluginHref(slug, pluginId, action.view, action.params) as never);
  };
  return (
    <View
      role="list"
      aria-label={t.community_dashboard_label}
      style={styles.dashboard}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {width
        ? widgets.data.map((w) => (
            <View key={`${w.pluginId}/${w.widget}`} role="listitem" style={tileSize(w.size, width)}>
              <PluginRenderer node={w.node} onAction={open(w.pluginId)} busy={false} upload={noUpload} />
            </View>
          ))
        : null}
    </View>
  );
}

/** Widgets are read-only (no forms), so they never upload files. */
const noUpload = () => Promise.reject(new Error("Widgets cannot upload files"));

const styles = StyleSheet.create({
  dashboard: { flexDirection: "row", flexWrap: "wrap", gap: GAP },
  head: { gap: spacing[6] },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing[6] },
  tile: { flexGrow: 1, flexBasis: 200 },
  card: { flexDirection: "row", alignItems: "center" },
});
