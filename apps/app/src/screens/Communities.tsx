import { useRouter } from "expo-router";
import Head from "expo-router/head";
import { StyleSheet, View } from "react-native";
import { Button, Card, Heading, Link, Screen, Text } from "../components";
import { useCommunities } from "../data/communities";
import { useAuthActions } from "../data/session";
import { useI18n } from "../lib/i18n";
import { spacing } from "../theme";

/** List of communities the user has access to. */
export default function Communities() {
  const { t } = useI18n();
  const router = useRouter();
  const communities = useCommunities();
  const auth = useAuthActions();
  return (
    <Screen>
      <Head>
        <title>{t.meta_communities_title()}</title>
      </Head>
      <View style={styles.head}>
        <View style={styles.titleRow}>
          <Heading level={1}>{t.communities_title()}</Heading>
          <Button
            label={t.sign_out()}
            variant="secondary"
            size="sm"
            fullWidth={false}
            onPress={async () => {
              await auth.signOut();
              router.replace("/login");
            }}
          />
        </View>
        <Text variant="bodyL" color="textSecondary">
          {t.communities_lead()}
        </Text>
      </View>
      {communities.isPending ? (
        <Text variant="bodyL" color="textSecondary">
          {t.loading()}
        </Text>
      ) : (
        <View role="list" aria-label={t.communities_list_label()} style={styles.list}>
          {communities.data?.length ? (
            communities.data.map((c) => (
              <View key={c.id} role="listitem">
                <Card>
                  <Link href={`/app/c/${c.slug}`}>{c.name}</Link>
                </Card>
              </View>
            ))
          ) : (
            <View role="listitem">
              <Text variant="bodyL" color="textSecondary">
                {t.communities_empty()}
              </Text>
            </View>
          )}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing[4] },
  titleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing[8],
  },
  list: { gap: spacing[6] },
});
