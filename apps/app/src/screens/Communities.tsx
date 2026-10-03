import { useRouter } from "expo-router";
import Head from "expo-router/head";
import { StyleSheet, View } from "react-native";
import { AppLink, Body, Button, Heading, Page } from "../components/ui";
import { useCommunities } from "../data/communities";
import { useAuthActions } from "../data/session";
import { useI18n } from "../lib/i18n";
import { color, radius, shadow, space } from "../theme";

/** Lista społeczności, do których użytkownik ma dostęp. */
export default function Communities() {
  const { t } = useI18n();
  const router = useRouter();
  const communities = useCommunities();
  const auth = useAuthActions();
  return (
    <Page narrow>
      <Head>
        <title>{t.meta_communities_title()}</title>
      </Head>
      <View style={styles.head}>
        <View style={styles.titleRow}>
          <Heading level={1} size="section">
            {t.communities_title()}
          </Heading>
          <Button
            label={t.sign_out()}
            variant="quiet"
            onPress={async () => {
              await auth.signOut();
              router.replace("/login");
            }}
          />
        </View>
        <Body tone="soft">{t.communities_lead()}</Body>
      </View>
      {communities.isPending ? (
        <Body tone="soft">{t.loading()}</Body>
      ) : (
        <View role="list" aria-label={t.communities_list_label()} style={styles.list}>
          {communities.data?.length ? (
            communities.data.map((c) => (
              <View key={c.id} role="listitem" style={styles.item}>
                <AppLink href={`/app/c/${c.slug}`}>{c.name}</AppLink>
              </View>
            ))
          ) : (
            <View role="listitem">
              <Body tone="soft">{t.communities_empty()}</Body>
            </View>
          )}
        </View>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  head: { gap: space.s, marginBottom: space.xl },
  titleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: space.l,
  },
  list: { gap: space.m },
  item: { backgroundColor: color.sheet, borderRadius: radius.card, padding: space.xl, ...shadow.sheet },
});
