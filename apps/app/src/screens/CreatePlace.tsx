import { useRouter } from "expo-router";
import Head from "expo-router/head";
import { Keyboard, Link as LinkIcon, MapPin, QrCode, UserPlus } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { ActionRow, CreateRow, HeroBanner, Icon, Screen, Text } from "../components";
import { useSession } from "../data/session";
import { placeAbbr } from "../lib/places";
import { t } from "../texts";
import { borders, colors, shadows, sizes, spacing } from "../theme";

/**
 * Account without places (design E-BrakMiejsc): join a place by QR code, invite code, link or invitation,
 * or create a new one. Reached from the dashboard empty state.
 */
export default function CreatePlace() {
  const router = useRouter();
  const session = useSession();
  const joinVia = () => router.push("/app/join");

  return (
    <Screen chrome={false}>
      <Head>
        <title>{t.first_place_title}</title>
      </Head>
      <View style={styles.header}>
        <View style={styles.brand}>
          <Icon icon={MapPin} size={sizes.iconButton / 2} color="primary" strokeWidth={2.2} />
          <Text variant="brand">{t.app_name}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.account_button}
          onPress={() => router.push("/app/account")}
          style={styles.avatar}
        >
          <Text variant="buttonS">{placeAbbr(session.data?.name ?? "")}</Text>
        </Pressable>
      </View>

      <HeroBanner label={t.first_place_eyebrow} title={t.first_place_title} />

      <View style={styles.options}>
        <Text variant="label" color="textSecondary">
          {t.first_place_how}
        </Text>
        <ActionRow icon={QrCode} title={t.first_place_qr} hint={t.first_place_qr_hint} onPress={joinVia} />
        <ActionRow icon={Keyboard} title={t.first_place_code} hint={t.first_place_code_hint} onPress={joinVia} />
        <ActionRow icon={LinkIcon} title={t.first_place_link} hint={t.first_place_link_hint} onPress={joinVia} />
        <ActionRow icon={UserPlus} title={t.first_place_invites} hint={t.first_place_invites_hint} onPress={joinVia} />
      </View>

      <View style={styles.spacer} />
      <CreateRow label={t.first_place_create_own} onPress={() => router.push("/app/create")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { flexDirection: "row", alignItems: "center", gap: spacing[4] },
  avatar: {
    width: sizes.iconButton,
    height: sizes.iconButton,
    borderRadius: sizes.iconButton / 2,
    borderWidth: borders.hairline,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.card,
  },
  options: { gap: spacing[6] },
  spacer: { flex: 1 },
});
