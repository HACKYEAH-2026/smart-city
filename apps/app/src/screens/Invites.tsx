import type { Invitation } from "@app/shared";
import { useRouter } from "expo-router";
import Head from "expo-router/head";
import { StyleSheet, View } from "react-native";
import { BackButton, Button, Card, Heading, Screen, Text } from "../components";
import { useAcceptInvitation, useDeclineInvitation, useInvitations } from "../data/communities";
import { goBack } from "../lib/navigation";
import { placeKindLabel } from "../lib/placeKinds";
import { initials } from "../lib/places";
import { relativeTime } from "../lib/relativeTime";
import { t } from "../texts";
import { borders, colors, radii, sizes, spacing } from "../theme";

/**
 * Invitations to places (design E-Zaproszenia): the place, its kind, who invited the user and when. Accepting joins
 * the place and opens its dashboard; declining removes the invitation.
 */
export default function Invites() {
  const router = useRouter();
  const list = useInvitations();
  const accept = useAcceptInvitation();
  const decline = useDeclineInvitation();
  const failed = accept.isError || decline.isError;
  const busy = accept.isPending || decline.isPending;

  return (
    <Screen chrome={false}>
      <Head>
        <title>{t.invites_title}</title>
      </Head>
      <BackButton onPress={() => goBack(router, "/app/join-place")} />
      <View style={styles.intro}>
        <Heading level={1} variant="titleXL">
          {t.invites_title}
        </Heading>
        {list.data?.length ? (
          <Text variant="bodyL" color="textSecondary">
            {t.invites_lead}
          </Text>
        ) : null}
      </View>

      {list.data?.length === 0 ? (
        <Text variant="bodyL" color="textSecondary">
          {t.invites_empty}
        </Text>
      ) : null}
      {list.data?.map((invitation) => (
        <InviteCard
          key={invitation.id}
          invitation={invitation}
          busy={busy}
          onAccept={() => accept.mutate(invitation.id, { onSuccess: () => router.replace("/app") })}
          onDecline={() => decline.mutate(invitation.id)}
        />
      ))}
      {failed ? (
        <Text variant="bodyL" color="primaryPressed" role="alert">
          {t.invite_error}
        </Text>
      ) : null}
    </Screen>
  );
}

function InviteCard({
  invitation,
  busy,
  onAccept,
  onDecline,
}: {
  invitation: Invitation;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <Card style={styles.card}>
      <View style={styles.place}>
        <View style={styles.placeAvatar}>
          <Text variant="abbr" color="primary">
            {initials(invitation.placeName)}
          </Text>
        </View>
        <View style={styles.placeText}>
          <Text variant="headingS">{invitation.placeName}</Text>
          <Text variant="label" color="textSecondary">
            {placeKindLabel(invitation.placeKind)}
          </Text>
        </View>
      </View>
      <View style={styles.from}>
        <View style={styles.personAvatar}>
          <Text variant="chip" color="primary">
            {initials(invitation.inviterName)}
          </Text>
        </View>
        <Text variant="caption" color="textSecondary">
          <Text variant="button">{invitation.inviterName}</Text>
          {` · ${relativeTime(invitation.createdAt)}`}
        </Text>
      </View>
      <View style={styles.actions}>
        <Button
          label={t.invite_decline}
          variant="secondary"
          size="sm"
          fullWidth={false}
          style={styles.action}
          disabled={busy}
          onPress={onDecline}
        />
        <Button
          label={t.invite_accept}
          size="sm"
          fullWidth={false}
          style={styles.action}
          disabled={busy}
          onPress={onAccept}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  intro: { gap: spacing[2] },
  card: { gap: spacing[6] },
  place: { flexDirection: "row", alignItems: "center", gap: spacing[6] },
  placeAvatar: {
    width: sizes.avatarLg + spacing[4],
    height: sizes.avatarLg + spacing[4],
    borderRadius: radii.md,
    backgroundColor: colors.primaryTint,
    alignItems: "center",
    justifyContent: "center",
  },
  placeText: { flex: 1, gap: spacing[1] },
  from: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[5],
    paddingTop: spacing[7],
    borderTopWidth: borders.hairline,
    borderTopColor: colors.divider,
  },
  personAvatar: {
    width: sizes.avatarSm,
    height: sizes.avatarSm,
    borderRadius: radii.pill,
    backgroundColor: colors.primaryTint,
    alignItems: "center",
    justifyContent: "center",
  },
  actions: { flexDirection: "row", gap: spacing[5] },
  action: { flex: 1 },
});
