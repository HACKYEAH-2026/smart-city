import { DASHBOARD_COLUMNS } from "@app/plugin-sdk";
import { formatInviteCode, type JoinRule, type LayoutWidget, type PlaceDetails, type PlaceKind } from "@app/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import Head from "expo-router/head";
import { LayoutDashboard, Link2, Plus, Puzzle, Settings, Users } from "lucide-react-native";
import { type ReactNode, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  Avatar,
  Badge,
  Button,
  DisclosureCard,
  Feedback,
  Icon,
  IconBox,
  InviteCodeCard,
  Link,
  NoticeScreen,
  RadioCard,
  Screen,
  SelectableCard,
  Text,
  TextField,
  TitleHeader,
} from "../components";
import {
  useCommunity,
  useDashboardLayout,
  useDeletePlace,
  useInvite,
  usePlaceMembers,
  usePlacePlugins,
  useUpdatePlace,
} from "../data/communities";
import { confirmDestructive } from "../lib/confirm";
import { gridRects } from "../lib/grid";
import { inviteLink, shareInvite } from "../lib/invite";
import { JOIN_RULE_OPTIONS } from "../lib/joinRules";
import { memberCounts, memberName, orderMembers } from "../lib/members";
import { PLACE_KIND_OPTIONS } from "../lib/placeKinds";
import { enabledPlugins, pluginSubtitle } from "../lib/placePlugins";
import { countOf, widgetsCount } from "../lib/plural";
import { t } from "../texts";
import { borders, colors, radii, sizes, spacing } from "../theme";

type Section = "invites" | "plugins" | "layout" | "members" | "settings";

/** HTTP status of a failed API call (hono's DetailedError), to tell the user what went wrong. */
const statusOf = (err: unknown): number | undefined => (err as { statusCode?: number } | null)?.statusCode;

/**
 * Managing a place, for its admins (design E-ZarzadzanieMiejscem): sections that open in place, one at a time —
 * invitations (the code with its QR, inviting by email), the plugins that are on (and the way to add more), the
 * dashboard layout, the members, the place's settings — and deleting the place. Members who are not admins get a
 * message instead.
 */
export default function ManagePlace() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const place = useCommunity(slug);
  const back = () => (router.canGoBack() ? router.back() : router.replace("/app"));
  const header = <TitleHeader eyebrow={place.data?.name ?? ""} title={t.manage_title} onBack={back} />;

  if (place.isPending) return <NoticeScreen header={header} text={t.loading} />;
  if (!place.data) return <NoticeScreen header={header} text={t.manage_load_error} alert />;
  if (place.data.role !== "admin") return <NoticeScreen header={header} text={t.manage_admins_only} />;
  return <Manage header={header} place={place.data} onDeleted={() => router.replace("/app")} />;
}

function Manage({ header, place, onDeleted }: { header: ReactNode; place: PlaceDetails; onDeleted: () => void }) {
  const [open, setOpen] = useState<Section | null>(null);
  const toggle = (section: Section) => () => setOpen(open === section ? null : section);
  return (
    <Screen chrome={false}>
      <Head>
        <title>{t.manage_title}</title>
      </Head>
      {header}
      <View style={styles.sections}>
        <InvitesSection place={place} open={open === "invites"} onToggle={toggle("invites")} />
        <PluginsSection slug={place.slug} open={open === "plugins"} onToggle={toggle("plugins")} />
        <LayoutSection slug={place.slug} open={open === "layout"} onToggle={toggle("layout")} />
        <MembersSection slug={place.slug} open={open === "members"} onToggle={toggle("members")} />
        <SettingsSection place={place} open={open === "settings"} onToggle={toggle("settings")} />
      </View>
      <View style={styles.grow} />
      <DeletePlace place={place} onDeleted={onDeleted} />
    </Screen>
  );
}

type SectionProps = { open: boolean; onToggle: () => void };

function InvitesSection({ place, open, onToggle }: SectionProps & { place: PlaceDetails }) {
  const invite = useInvite(place.slug);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const code = place.inviteCode;
  const summary = code
    ? `${t.manage_invites_code} ${formatInviteCode(code)} · ${t.manage_invites_rest}`
    : t.manage_invites_rest;
  const send = () => {
    setSent(false);
    invite.mutate(email.trim(), {
      onSuccess: () => {
        setSent(true);
        setEmail("");
      },
    });
  };
  const status = statusOf(invite.error);
  const error = !invite.isError
    ? null
    : status === 404
      ? t.manage_invite_no_account
      : status === 409
        ? t.manage_invite_conflict
        : t.manage_invite_error;
  return (
    <DisclosureCard icon={Link2} title={t.manage_invites_title} summary={summary} open={open} onToggle={onToggle}>
      {code ? <InviteCodeCard code={code} link={inviteLink(code)} onShare={() => shareInvite(place, code)} /> : null}
      <Text variant="bodyL" color="textSecondary">
        {t.manage_invite_lead}
      </Text>
      <TextField
        label={t.manage_invite_email}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
      />
      <Feedback ok={sent ? t.manage_invite_sent : null} error={error} />
      <Button
        label={t.manage_invite_send}
        variant="secondary"
        disabled={!email.trim() || invite.isPending}
        onPress={send}
      />
    </DisclosureCard>
  );
}

/**
 * The plugins that are on in the place (design: rows under the header, not tappable until a plugin has its own page),
 * then "Dodaj rozszerzenie", the catalog of the rest.
 */
function PluginsSection({ slug, open, onToggle }: SectionProps & { slug: string }) {
  const plugins = usePlacePlugins(slug);
  const on = enabledPlugins(plugins.data ?? []);
  const summary = on.length
    ? `${countOf(on.length, t.count_plugins)} · ${on.map((plugin) => plugin.name).join(", ")}`
    : t.manage_plugins_none;
  return (
    <DisclosureCard
      icon={Puzzle}
      title={t.manage_plugins_title}
      summary={summary}
      open={open}
      onToggle={onToggle}
      flush
    >
      <View role="list" aria-label={t.manage_plugins_title}>
        {on.map((plugin) => (
          <View key={plugin.id} role="listitem" style={styles.pluginRow}>
            <IconBox icon={plugin.icon} size="sm" neutral />
            <View style={styles.rowText}>
              <Text variant="rowTitle" numberOfLines={1}>
                {plugin.name}
              </Text>
              <Text variant="small" color="textSecondary" numberOfLines={1}>
                {pluginSubtitle(plugin)}
              </Text>
            </View>
          </View>
        ))}
      </View>
      <View style={styles.pluginAdd}>
        <Button
          label={t.add_plugin_title}
          size="sm"
          leftIcon={<Icon icon={Plus} size={sizes.iconS} color="onPrimary" strokeWidth={2.4} />}
          href={`/app/c/${slug}/add-plugin`}
        />
      </View>
    </DisclosureCard>
  );
}

/**
 * The dashboard layout (design: card "Układ pulpitu"): how many widgets are on it and the grid's width, a preview of
 * the grid, and the way to the layout editor.
 */
function LayoutSection({ slug, open, onToggle }: SectionProps & { slug: string }) {
  const layout = useDashboardLayout(slug);
  const widgets = layout.data?.widgets ?? [];
  const columns = layout.data?.columns ?? DASHBOARD_COLUMNS;
  const summary = `${widgetsCount(widgets.length)} · ${t.manage_layout_grid} ${columns} ${t.manage_layout_columns}`;
  return (
    <DisclosureCard
      icon={LayoutDashboard}
      title={t.manage_layout_title}
      summary={summary}
      open={open}
      onToggle={onToggle}
    >
      {widgets.length ? (
        <LayoutPreview widgets={widgets} columns={columns} />
      ) : (
        <Text variant="bodyL" color="textSecondary">
          {t.manage_layout_empty}
        </Text>
      )}
      <Button label={t.manage_layout_edit} variant="dark" size="sm" href={`/app/c/${slug}/layout`} />
    </DisclosureCard>
  );
}

/** A small picture of the dashboard grid (decoration: the summary and the editor tell the same in words). */
function LayoutPreview({ widgets, columns }: { widgets: LayoutWidget[]; columns: number }) {
  const [width, setWidth] = useState(0);
  const grid = gridRects(widgets, { width, columns, rowHeight: sizes.layoutPreviewRow, gap: spacing[3] });
  return (
    <View aria-hidden style={styles.preview}>
      <View style={{ height: grid.height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width
          ? grid.tiles.map(({ item, rect }, index) => (
              <View key={item.key} style={[styles.previewTile, index === 0 && styles.previewTileFirst, rect]} />
            ))
          : null}
      </View>
    </View>
  );
}

/** How many members of the place the section shows; the members screen has them all. */
const MEMBERS_PREVIEW = 3;

/** The members (design: card "Członkowie"): the first few with their role, and the way to all of them. */
function MembersSection({ slug, open, onToggle }: SectionProps & { slug: string }) {
  const members = usePlaceMembers(slug);
  const list = members.data ?? [];
  const counts = memberCounts(list);
  const summary = `${countOf(counts.all, t.count_people)} · ${countOf(counts.admins, t.count_admins)}`;
  return (
    <DisclosureCard icon={Users} title={t.manage_members_title} summary={summary} open={open} onToggle={onToggle} flush>
      <View role="list" aria-label={t.manage_members_title}>
        {orderMembers(list)
          .slice(0, MEMBERS_PREVIEW)
          .map((member) => (
            <View key={member.id} role="listitem" style={styles.pluginRow}>
              <Avatar name={memberName(member)} />
              <Text variant="rowTitle" numberOfLines={1} style={styles.grow}>
                {member.you ? `${memberName(member)} ${t.members_you}` : memberName(member)}
              </Text>
              {/* Badge aligns itself to the start, which in a row is the top: the wrapper centres it. */}
              <View>
                <Badge
                  text={member.role === "admin" ? t.role_admin : t.role_member}
                  tone={member.role === "admin" ? "accent" : "neutral"}
                />
              </View>
            </View>
          ))}
      </View>
      <View style={styles.membersAll}>
        <Link href={`/app/c/${slug}/members`}>{t.members_see_all}</Link>
      </View>
    </DisclosureCard>
  );
}

function SettingsSection({ place, open, onToggle }: SectionProps & { place: PlaceDetails }) {
  return (
    <DisclosureCard
      icon={Settings}
      title={t.manage_settings_title}
      summary={t.manage_settings_summary}
      open={open}
      onToggle={onToggle}
    >
      {/* Mounted only while open: every opening starts from the saved settings. */}
      <SettingsForm place={place} />
    </DisclosureCard>
  );
}

function SettingsForm({ place }: { place: PlaceDetails }) {
  const update = useUpdatePlace(place.slug);
  const [name, setName] = useState(place.name);
  const [address, setAddress] = useState(place.address);
  const [description, setDescription] = useState(place.description);
  const [kind, setKind] = useState<PlaceKind>(place.kind);
  const [joinRule, setJoinRule] = useState<JoinRule>(place.joinRule);
  const save = () => update.mutate({ name, address, description, kind, joinRule });
  return (
    <>
      <TextField label={t.create_name} value={name} onChangeText={setName} />
      <TextField
        label={t.create_address}
        value={address}
        onChangeText={setAddress}
        placeholder={t.create_address_placeholder}
        autoComplete="street-address"
      />
      <TextField
        label={t.create_description}
        value={description}
        onChangeText={setDescription}
        placeholder={t.create_description_placeholder}
        multiline
      />
      <View role="radiogroup" aria-label={t.create_kinds_label} style={styles.kinds}>
        {PLACE_KIND_OPTIONS.map((option) => (
          <SelectableCard
            key={option.kind}
            icon={option.icon}
            title={option.label}
            hint={option.hint}
            selected={kind === option.kind}
            onPress={() => setKind(option.kind)}
          />
        ))}
      </View>
      <View role="radiogroup" aria-label={t.join_rules_label} style={styles.options}>
        {JOIN_RULE_OPTIONS.map((option) => (
          <RadioCard
            key={option.rule}
            label={option.label}
            description={option.hint}
            selected={joinRule === option.rule}
            onPress={() => setJoinRule(option.rule)}
          />
        ))}
      </View>
      <Feedback ok={update.isSuccess ? t.manage_saved : null} error={update.isError ? t.manage_save_error : null} />
      <Button label={t.manage_save} disabled={!name.trim() || update.isPending} onPress={save} />
    </>
  );
}

function DeletePlace({ place, onDeleted }: { place: PlaceDetails; onDeleted: () => void }) {
  const remove = useDeletePlace(place.slug);
  const ask = async () => {
    const confirmed = await confirmDestructive({
      title: t.manage_delete_title,
      message: t.manage_delete_body,
      confirm: t.manage_delete_confirm,
      cancel: t.create_cancel,
    });
    if (confirmed) remove.mutate(undefined, { onSuccess: onDeleted });
  };
  return (
    <View style={styles.delete}>
      <Feedback error={remove.isError ? t.manage_delete_error : null} />
      <Button label={t.manage_delete} variant="destructiveGhost" disabled={remove.isPending} onPress={ask} />
    </View>
  );
}

const styles = StyleSheet.create({
  sections: { gap: spacing[7] },
  options: { gap: spacing[5] },
  kinds: { flexDirection: "row", flexWrap: "wrap", gap: spacing[5] },
  rowText: { flex: 1, gap: spacing[1] },
  pluginRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[6],
    paddingVertical: spacing[6],
    paddingHorizontal: spacing[8],
    borderBottomWidth: borders.hairline,
    borderBottomColor: colors.divider,
  },
  pluginAdd: { paddingTop: spacing[6], paddingHorizontal: spacing[8], paddingBottom: spacing[8] },
  // The rows above end with a divider, so the link needs no line of its own (design: centred, 48 high).
  membersAll: { alignItems: "center", paddingVertical: spacing[7] },
  preview: { padding: spacing[5], borderRadius: radii.lg, backgroundColor: colors.background },
  previewTile: {
    position: "absolute",
    borderRadius: radii.mini,
    borderWidth: borders.hairline,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface,
  },
  previewTileFirst: { borderColor: colors.primary, backgroundColor: colors.primary },
  grow: { flex: 1 },
  delete: { alignItems: "center", gap: spacing[4] },
});
