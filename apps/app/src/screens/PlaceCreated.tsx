import { formatInviteCode } from "@app/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import Head from "expo-router/head";
import { Share, StyleSheet, View } from "react-native";
import { Button, Heading, InviteCodeCard, Screen, StatusPill, SuccessMark, Text } from "../components";
import { useCommunity } from "../data/communities";
import { inviteLink } from "../lib/invite";
import { t } from "../texts";
import { spacing } from "../theme";

/**
 * A new place is ready (design E-NoweMiejsceGotowe): its creator is the admin; the invite code and its QR are here
 * to share or print. ("Zaproś osoby" from the design comes with the invite screen.)
 */
export default function PlaceCreated() {
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const place = useCommunity(slug ?? "");
  if (!place.data) {
    return (
      <Screen chrome={false}>
        <Text variant="bodyL" color="textSecondary">
          {t.loading}
        </Text>
      </Screen>
    );
  }
  const { name, inviteCode } = place.data;
  const share = (code: string) =>
    Share.share({
      message: `${t.invite_share_message_before}${name}${t.invite_share_message_after} ${formatInviteCode(code)}\n${inviteLink(code)}`,
    }).catch(() => undefined);
  return (
    <Screen chrome={false}>
      <Head>
        <title>{name}</title>
      </Head>
      <View style={styles.top}>
        <SuccessMark />
        <Heading level={1} variant="heading" style={styles.title}>
          {`${t.created_title_before}${name}${t.created_title_after}`}
        </Heading>
        <StatusPill text={t.created_admin} />
      </View>
      {inviteCode ? (
        <InviteCodeCard code={inviteCode} link={inviteLink(inviteCode)} onShare={() => share(inviteCode)} />
      ) : null}
      <View style={styles.grow} />
      <Button label={t.created_go_dashboard} onPress={() => router.replace("/app")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { alignItems: "center", gap: spacing[7], paddingTop: spacing[6] },
  title: { textAlign: "center" },
  grow: { flex: 1 },
});
