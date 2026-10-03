import { useLocalSearchParams } from "expo-router";
import Head from "expo-router/head";
import { StyleSheet, View } from "react-native";
import { Card, Heading, Link, Screen, Text } from "../components";
import { useCommunity, useCommunityNav } from "../data/communities";
import { useI18n } from "../lib/i18n";
import { pluginHref } from "../plugins/href";
import { spacing } from "../theme";

/** Community page: features = nav entries of installed plugins (refreshed live). */
export default function Community() {
  const { t } = useI18n();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const community = useCommunity(slug);
  const nav = useCommunityNav(slug);
  return (
    <Screen>
      <Head>
        <title>{community.data?.name ?? t.communities_title()}</title>
      </Head>
      <View style={styles.head}>
        <Link href="/app">{t.community_back()}</Link>
        <Heading level={1}>{community.data?.name ?? t.loading()}</Heading>
      </View>
      {nav.isPending ? (
        <Text variant="bodyL" color="textSecondary">
          {t.loading()}
        </Text>
      ) : (
        <View role="list" aria-label={t.community_features_label()} style={styles.grid}>
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
                {t.community_features_empty()}
              </Text>
            </View>
          )}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing[6] },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing[6] },
  tile: { flexGrow: 1, flexBasis: 200 },
  card: { flexDirection: "row", alignItems: "center" },
});
