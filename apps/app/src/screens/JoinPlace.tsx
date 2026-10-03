import { useRouter } from "expo-router";
import Head from "expo-router/head";
import { Keyboard, Link as LinkIcon, QrCode, User, UserPlus } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { ActionRow, Brand, CreateRow, Heading, HeroBanner, IconButton, Screen } from "../components";
import { useCommunities } from "../data/communities";
import { useSession } from "../data/session";
import { initials } from "../lib/places";
import { t } from "../texts";
import { spacing } from "../theme";

/** A user without places (design E-BrakMiejsc): the ways to join a place, or creating their own. No bottom bar. */
export default function JoinPlace() {
  // Opened from the places sheet by someone who already has places: the title then does not say "first".
  const hasPlaces = (useCommunities().data?.length ?? 0) > 0;
  return (
    <Screen chrome={false}>
      <Head>
        <title>{t.app_name}</title>
      </Head>
      <View style={styles.topBar}>
        <Brand />
        <AccountButton />
      </View>
      <HeroBanner
        label={hasPlaces ? t.join_hero_label : t.dashboard_empty_label}
        title={hasPlaces ? t.join_hero_title : t.dashboard_empty_title}
      />
      <View style={styles.methods}>
        <Heading level={2} variant="label" color="textSecondary">
          {t.join_methods_title}
        </Heading>
        <ActionRow icon={QrCode} title={t.join_qr} subtitle={t.join_qr_hint} href="/app/scan" />
        <ActionRow icon={Keyboard} title={t.join_code} subtitle={t.join_code_hint} href="/app/join-code" />
        <ActionRow icon={LinkIcon} title={t.join_link} subtitle={t.join_link_hint} href="/app/join-code?tab=link" />
        <ActionRow icon={UserPlus} title={t.join_invites} subtitle={t.join_invites_hint} href="/app/invites" />
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

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  methods: { gap: spacing[5] },
  grow: { flex: 1 },
});
