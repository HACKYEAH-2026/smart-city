import { useLocalSearchParams } from "expo-router";
import Head from "expo-router/head";
import { StyleSheet, Text, View } from "react-native";
import { AppLink, Body, Heading, Page } from "../components/ui";
import { useCommunity, useCommunityNav } from "../data/communities";
import { useI18n } from "../lib/i18n";
import { pluginHref } from "../plugins/href";
import { color, font, radius, shadow, space } from "../theme";

/** Strona społeczności: funkcje = wpisy nawigacji zainstalowanych wtyczek (odświeżane na bieżąco). */
export default function Community() {
  const { t } = useI18n();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const community = useCommunity(slug);
  const nav = useCommunityNav(slug);
  return (
    <Page narrow>
      <Head>
        <title>{community.data?.name ?? t.communities_title()}</title>
      </Head>
      <View style={styles.head}>
        <AppLink href="/app/c">{t.community_back()}</AppLink>
        <Heading level={1} size="section">
          {community.data?.name ?? t.loading()}
        </Heading>
      </View>
      {nav.isPending ? (
        <Body tone="soft">{t.loading()}</Body>
      ) : (
        <View role="list" aria-label={t.community_features_label()} style={styles.grid}>
          {nav.data?.length ? (
            nav.data.map((n) => (
              <View key={`${n.pluginId}/${n.view}`} role="listitem" style={styles.tile}>
                <Text style={styles.icon} aria-hidden>
                  {n.icon}
                </Text>
                <AppLink href={pluginHref(slug, n.pluginId, n.view)}>{n.label}</AppLink>
              </View>
            ))
          ) : (
            <View role="listitem">
              <Body tone="soft">{t.community_features_empty()}</Body>
            </View>
          )}
        </View>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  head: { gap: space.m, marginBottom: space.xl },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.m },
  tile: {
    flexGrow: 1,
    flexBasis: 200,
    flexDirection: "row",
    alignItems: "center",
    gap: space.m,
    backgroundColor: color.sheet,
    borderRadius: radius.card,
    padding: space.xl,
    ...shadow.sheet,
  },
  icon: { fontFamily: font.text, fontSize: 28 },
});
