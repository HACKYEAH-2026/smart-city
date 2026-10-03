import { useRouter } from "expo-router";
import Head from "expo-router/head";
import { StyleSheet, View } from "react-native";
import { Button, Heading, PlaceRow, Screen, Text } from "../components";
import { useCommunities, useVisitPlace } from "../data/communities";
import { currentPlace } from "../lib/places";
import { t } from "../texts";
import { spacing } from "../theme";

/** Places tab: every place the user belongs to; choosing one makes it the current place. */
export default function Places() {
  const router = useRouter();
  const places = useCommunities();
  const visit = useVisitPlace();
  const current = currentPlace(places.data ?? []);
  return (
    <Screen chrome={false} tabBar>
      <Head>
        <title>{t.places_title}</title>
      </Head>
      <Heading level={1} variant="heading">
        {t.places_title}
      </Heading>
      <Text variant="bodyL" color="textSecondary">
        {t.places_lead}
      </Text>
      <View style={styles.list}>
        {places.data?.map((p) => (
          <PlaceRow
            key={p.id}
            place={p}
            active={p.id === current?.id}
            onPress={() => visit.mutate(p.slug, { onSuccess: () => router.replace("/app") })}
          />
        ))}
      </View>
      <Button label={t.place_create} onPress={() => router.push("/app/create")} />
      <Button label={t.place_join} variant="secondary" onPress={() => router.push("/app/join")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing[4] },
});
