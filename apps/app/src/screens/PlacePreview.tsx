import { formatInviteCode, parseInviteCode } from "@app/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import Head from "expo-router/head";
import { ChevronLeft } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Card, Checkbox, DashboardMap, Heading, IconButton, Screen, Text } from "../components";
import { useJoinPlace, usePlacePreview } from "../data/communities";
import { t } from "../texts";
import { radii, sizes, spacing } from "../theme";

/**
 * A place behind a scanned invite (design E-PodgladMiejsca): its name and address, its code, and joining it.
 * Only places that open to anyone with the code can be joined here.
 */
export default function PlacePreview() {
  const router = useRouter();
  const { code = "" } = useLocalSearchParams<{ code?: string }>();
  const invite = parseInviteCode(code);
  const back = () => router.replace("/app");

  return (
    <Screen chrome={false}>
      <Head>
        <title>{t.place_preview_title}</title>
      </Head>
      <IconButton icon={ChevronLeft} label={t.back} onPress={back} />
      <View style={styles.map}>
        <DashboardMap />
      </View>
      {invite ? <Preview code={invite} /> : <NotFound onBack={back} />}
    </Screen>
  );
}

function Preview({ code }: { code: string }) {
  const router = useRouter();
  const preview = usePlacePreview(code);
  const join = useJoinPlace();
  const [makeDefault, setMakeDefault] = useState(false);

  if (preview.isPending) {
    return (
      <Text variant="bodyL" color="textSecondary">
        {t.loading}
      </Text>
    );
  }
  if (preview.isError || !preview.data) return <NotFound onBack={() => router.replace("/app")} />;

  const place = preview.data;
  const open = place.joinRule === "open";
  return (
    <>
      <View style={styles.details}>
        <Heading level={1} variant="heading">
          {place.name}
        </Heading>
        {place.address ? (
          <Text variant="body" color="textSecondary">
            {place.address}
          </Text>
        ) : null}
      </View>
      <Card>
        <View style={styles.codeRow}>
          <Text variant="body" color="textSecondary">
            {t.place_preview_code}
          </Text>
          <Text variant="codeM">{formatInviteCode(code)}</Text>
        </View>
      </Card>
      <Checkbox checked={makeDefault} onChange={setMakeDefault} label={t.place_preview_default} />
      <View style={styles.grow} />
      {open ? null : (
        <Text variant="bodyL" color="textSecondary">
          {t.place_preview_approval}
        </Text>
      )}
      {join.isError ? (
        <Text variant="bodyL" color="primaryPressed" role="alert">
          {t.place_preview_error}
        </Text>
      ) : null}
      <Button
        label={t.place_preview_join}
        disabled={!open || join.isPending}
        onPress={() => join.mutate({ code, makeDefault }, { onSuccess: () => router.replace("/app") })}
      />
    </>
  );
}

function NotFound({ onBack }: { onBack: () => void }) {
  return (
    <>
      <Heading level={1} variant="heading">
        {t.place_preview_not_found}
      </Heading>
      <View style={styles.grow} />
      <Button label={t.back} variant="secondary" onPress={onBack} />
    </>
  );
}

const styles = StyleSheet.create({
  map: { height: sizes.dashboardMap, overflow: "hidden", borderRadius: radii["4xl"] },
  details: { gap: spacing[2] },
  codeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  grow: { flex: 1 },
});
