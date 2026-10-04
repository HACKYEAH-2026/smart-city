import type { PlaceDetails, PlaceMember } from "@app/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import Head from "expo-router/head";
import { DetailedError } from "hono/client";
import { type LucideIcon, MoreHorizontal, Plus, ShieldCheck, UserMinus } from "lucide-react-native";
import { type ReactNode, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import {
  Avatar,
  Badge,
  BottomSheet,
  Button,
  Chip,
  Feedback,
  Icon,
  IconButton,
  InviteCodeCard,
  NoticeScreen,
  Screen,
  SearchField,
  Text,
  TitleHeader,
} from "../components";
import { useCommunity, usePlaceMembers, useRemoveMember, useSetMemberRole } from "../data/communities";
import { confirmDestructive } from "../lib/confirm";
import { tapFeedback } from "../lib/haptics";
import { inviteLink, shareInvite } from "../lib/invite";
import { filterMembers, joinedDate, type MemberFilter, memberCounts, memberName, orderMembers } from "../lib/members";
import { goBack } from "../lib/navigation";
import { t } from "../texts";
import { borders, colors, opacity, radii, shadows, sizes, spacing } from "../theme";

/**
 * All members of a place (design E-Czlonkowie; Zarządzaj miejscem → Członkowie → "Zobacz wszystkich członków"), for
 * its admins: search by name, filter by role, and per member (never the admin's own row) grant or revoke admin rights
 * or remove them from the place. "Zaproś" shows the place's invite code. Members who are not admins get a message.
 */
export default function Members() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const place = useCommunity(slug);
  const back = () => goBack(router, `/app/c/${slug}/manage`);
  const header = <TitleHeader eyebrow={place.data?.name ?? ""} title={t.manage_members_title} onBack={back} />;

  if (place.isPending) return <NoticeScreen header={header} text={t.loading} />;
  if (!place.data) return <NoticeScreen header={header} text={t.manage_load_error} alert />;
  if (place.data.role !== "admin") return <NoticeScreen header={header} text={t.manage_admins_only} />;
  return <LoadMembers place={place.data} header={header} />;
}

type ListProps = { place: PlaceDetails; header: ReactNode };

function LoadMembers(props: ListProps) {
  const members = usePlaceMembers(props.place.slug);
  if (members.isPending) return <NoticeScreen header={props.header} text={t.loading} />;
  // 403: the admin's rights were revoked after the place was loaded.
  if (members.error instanceof DetailedError && members.error.statusCode === 403) {
    return <NoticeScreen header={props.header} text={t.manage_admins_only} />;
  }
  if (!members.data) return <NoticeScreen header={props.header} text={t.manage_load_error} alert />;
  return <MemberList {...props} members={members.data} />;
}

/** The line under a member's name: since when they are in the place, or their email when that is not known. */
const memberSubtitle = (member: PlaceMember) =>
  member.joinedAt ? `${t.members_since} ${joinedDate(member.joinedAt)}` : member.email;

function MemberList({ place, header, members }: ListProps & { members: PlaceMember[] }) {
  const remove = useRemoveMember(place.slug);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MemberFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const counts = memberCounts(members);
  const shown = filterMembers(orderMembers(members), filter, query);
  const selected = members.find((member) => member.id === selectedId);
  const code = place.inviteCode;
  const chips: [MemberFilter, string][] = [
    ["all", t.members_filter_all],
    ["admins", t.members_filter_admins],
    ["members", t.members_filter_members],
  ];

  const askRemove = async (member: PlaceMember) => {
    setSelectedId(null);
    const confirmed = await confirmDestructive({
      title: t.members_remove_title,
      message: `${memberName(member)} ${t.members_remove_body}`,
      confirm: t.manage_delete_confirm,
      cancel: t.create_cancel,
    });
    if (confirmed) remove.mutate(member.id);
  };

  return (
    <Screen
      chrome={false}
      overlay={
        <>
          {selected ? (
            <MemberSheet
              slug={place.slug}
              member={selected}
              onClose={() => setSelectedId(null)}
              onRemove={() => askRemove(selected)}
            />
          ) : null}
          {code ? (
            <BottomSheet visible={inviting} title={t.members_invite_title} onClose={() => setInviting(false)}>
              <InviteCodeCard code={code} link={inviteLink(code)} onShare={() => shareInvite(place, code)} />
            </BottomSheet>
          ) : null}
        </>
      }
    >
      <Head>
        <title>{t.manage_members_title}</title>
      </Head>
      <View style={styles.body}>
        <View style={styles.headerRow}>
          <View style={styles.grow}>{header}</View>
          {code ? (
            <Button
              label={t.manage_invite_send}
              size="xs"
              fullWidth={false}
              style={styles.invite}
              leftIcon={<Icon icon={Plus} size={sizes.iconS} color="onPrimary" strokeWidth={2.2} />}
              onPress={() => setInviting(true)}
            />
          ) : null}
        </View>
        <SearchField variant="outlined" label={t.members_search} value={query} onChangeText={setQuery} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          role="radiogroup"
          aria-label={t.members_filter_label}
          contentContainerStyle={styles.chips}
        >
          {chips.map(([value, label]) => (
            <Chip
              key={value}
              label={`${label} ${counts[value]}`}
              selected={filter === value}
              onPress={() => setFilter(value)}
            />
          ))}
        </ScrollView>
        <Feedback error={remove.isError ? t.members_remove_error : null} />
        {shown.length ? (
          <View role="list" aria-label={t.manage_members_title} style={styles.list}>
            {shown.map((member, index) => (
              <MemberRow
                key={member.id}
                member={member}
                last={index === shown.length - 1}
                onOptions={() => setSelectedId(member.id)}
              />
            ))}
          </View>
        ) : (
          <Text variant="bodyL" color="textSecondary">
            {t.members_empty_search}
          </Text>
        )}
      </View>
    </Screen>
  );
}

function MemberRow({ member, last, onOptions }: { member: PlaceMember; last: boolean; onOptions: () => void }) {
  const name = memberName(member);
  const admin = member.role === "admin";
  return (
    <View role="listitem" style={[styles.row, !last && styles.rowDivider]}>
      <Avatar name={name} tone={admin ? "accent" : "neutral"} />
      <View style={styles.rowText}>
        <View style={styles.nameLine}>
          <Text variant="rowTitle" numberOfLines={1} style={styles.name}>
            {member.you ? `${name} ${t.members_you}` : name}
          </Text>
          {admin ? <Badge text={t.members_admin_badge} tone="accent" /> : null}
        </View>
        <Text variant="small" color="textSecondary" numberOfLines={1}>
          {memberSubtitle(member)}
        </Text>
      </View>
      {member.you ? null : (
        <IconButton
          variant="plain"
          icon={MoreHorizontal}
          color="textSecondary"
          label={`${t.members_options}: ${name}`}
          onPress={onOptions}
        />
      )}
    </View>
  );
}

type MemberSheetProps = { slug: string; member: PlaceMember; onClose: () => void; onRemove: () => void };

/** A member's options (design "Opcje członka"): grant or revoke admin rights, remove from the place. */
function MemberSheet({ slug, member, onClose, onRemove }: MemberSheetProps) {
  const setRole = useSetMemberRole(slug);
  const admin = member.role === "admin";
  const toggleRole = () =>
    setRole.mutate({ userId: member.id, role: admin ? "user" : "admin" }, { onSuccess: onClose });
  return (
    <BottomSheet visible title={memberName(member)} onClose={onClose}>
      <Text variant="small" color="textSecondary">
        {memberSubtitle(member)}
      </Text>
      <View style={styles.actions}>
        <SheetAction
          icon={ShieldCheck}
          label={admin ? t.members_revoke_admin : t.members_make_admin}
          disabled={setRole.isPending}
          onPress={toggleRole}
          divider
        />
        <SheetAction icon={UserMinus} label={t.members_remove} destructive onPress={onRemove} />
      </View>
      <Feedback error={setRole.isError ? t.members_role_error : null} />
      <Button label={t.create_cancel} variant="secondary" onPress={onClose} />
    </BottomSheet>
  );
}

type SheetActionProps = {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Red, for an action that takes something away (removing a member). */
  destructive?: boolean;
  /** A line under the row, when another row follows. */
  divider?: boolean;
};

function SheetAction({ icon, label, onPress, disabled, destructive, divider }: SheetActionProps) {
  const color = destructive ? "primaryPressed" : "text";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPressIn={tapFeedback}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        divider && styles.rowDivider,
        (pressed || disabled) && { opacity: disabled ? opacity.disabled : opacity.pressed },
      ]}
    >
      <Icon icon={icon} size={sizes.iconM} color={color} />
      <Text variant="buttonM" color={color}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing[9] },
  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing[7] },
  grow: { flex: 1 },
  invite: { height: sizes.iconButton, borderRadius: radii.pill, paddingHorizontal: spacing[7] },
  chips: { gap: spacing[4] },
  list: { backgroundColor: colors.surface, borderRadius: radii["2xl"], ...shadows.card },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[6],
    paddingVertical: spacing[5],
    paddingLeft: spacing[7],
    paddingRight: spacing[8],
  },
  rowDivider: { borderBottomWidth: borders.hairline, borderBottomColor: colors.divider },
  rowText: { flex: 1, gap: spacing[1] },
  nameLine: { flexDirection: "row", alignItems: "center", gap: spacing[3] },
  name: { flexShrink: 1 },
  actions: { backgroundColor: colors.surface, borderRadius: radii["2xl"], ...shadows.card },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[6],
    minHeight: sizes.sheetAction,
    paddingHorizontal: spacing[8],
  },
});
