import type { UINode } from "@app/plugin-sdk";
import { formatInviteCode, type JoinRule, type PlaceDetails, type PlaceKind } from "@app/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import Head from "expo-router/head";
import {
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  LayoutDashboard,
  Link2,
  Puzzle,
  Settings,
  Sparkles,
  Users,
} from "lucide-react-native";
import { type ReactNode, useState } from "react";
import { Share, StyleSheet, View } from "react-native";
import {
  ActionRow,
  Badge,
  Button,
  CheckCard,
  DisclosureCard,
  Heading,
  IconButton,
  InviteCodeCard,
  RadioCard,
  Screen,
  SelectableCard,
  Text,
  TextField,
} from "../components";
import {
  useCommunity,
  useDashboard,
  useDeletePlace,
  useInvite,
  usePlaceMembers,
  usePlacePlugins,
  useSaveDashboardOrder,
  useSwitchPlugin,
  useUpdatePlace,
} from "../data/communities";
import { confirmDestructive } from "../lib/confirm";
import { inviteLink } from "../lib/invite";
import { JOIN_RULE_OPTIONS } from "../lib/joinRules";
import { moveTo } from "../lib/order";
import { PLACE_KIND_OPTIONS } from "../lib/placeKinds";
import { initials } from "../lib/places";
import { countOf, widgetsCount } from "../lib/plural";
import { t } from "../texts";
import { colors, radii, sizes, spacing } from "../theme";

type Section = "invites" | "plugins" | "layout" | "members" | "settings";

/** HTTP status of a failed API call (hono's DetailedError), to tell the user what went wrong. */
const statusOf = (err: unknown): number | undefined => (err as { statusCode?: number } | null)?.statusCode;
const titleOf = (node: UINode) => ("title" in node ? node.title : "");

/**
 * Managing a place, for its admins (design E-ZarzadzanieMiejscem): sections that open in place, one at a time —
 * invitations (the code with its QR, inviting by email), plugins on and off, the dashboard order, the members, the
 * place's settings — and deleting the place. Members who are not admins get a message instead.
 */
export default function ManagePlace() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const place = useCommunity(slug);
  const back = () => (router.canGoBack() ? router.back() : router.replace("/app"));
  const header = <Header eyebrow={place.data?.name ?? ""} onBack={back} />;

  if (place.isPending) return <Notice header={header} text={t.loading} />;
  if (!place.data) return <Notice header={header} text={t.manage_load_error} alert />;
  if (place.data.role !== "admin") return <Notice header={header} text={t.manage_admins_only} />;
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

/** Back button, the place's name above "Zarządzaj miejscem". */
function Header({ eyebrow, onBack }: { eyebrow: string; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <IconButton icon={ChevronLeft} label={t.back} onPress={onBack} />
      <View style={styles.headerText}>
        <Text variant="label" color="textSecondary" numberOfLines={1}>
          {eyebrow}
        </Text>
        <Heading level={1} variant="headingS">
          {t.manage_title}
        </Heading>
      </View>
    </View>
  );
}

function Notice({ header, text, alert = false }: { header: ReactNode; text: string; alert?: boolean }) {
  return (
    <Screen chrome={false}>
      {header}
      <Text variant="bodyL" color="textSecondary" role={alert ? "alert" : undefined}>
        {text}
      </Text>
    </Screen>
  );
}

type SectionProps = { open: boolean; onToggle: () => void };

/** Feedback under a form: what happened (status) or what went wrong (alert). */
function Feedback({ ok, error }: { ok?: string | null; error?: string | null }) {
  if (error) {
    return (
      <Text variant="bodyL" color="primaryPressed" role="alert">
        {error}
      </Text>
    );
  }
  return ok ? (
    <Text variant="bodyL" color="textSecondary" role="status">
      {ok}
    </Text>
  ) : null;
}

function InvitesSection({ place, open, onToggle }: SectionProps & { place: PlaceDetails }) {
  const invite = useInvite(place.slug);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const code = place.inviteCode;
  const summary = code
    ? `${t.manage_invites_code} ${formatInviteCode(code)} · ${t.manage_invites_rest}`
    : t.manage_invites_rest;
  const share = (bare: string) =>
    Share.share({
      message: `${t.invite_share_message_before}${place.name}${t.invite_share_message_after} ${formatInviteCode(bare)}\n${inviteLink(bare)}`,
    });
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
      {code ? <InviteCodeCard code={code} link={inviteLink(code)} onShare={() => share(code)} /> : null}
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

function PluginsSection({ slug, open, onToggle }: SectionProps & { slug: string }) {
  const plugins = usePlacePlugins(slug);
  const sw = useSwitchPlugin(slug);
  // Drafts of AI plugins are switched on by publishing them (the plugin builder), not here.
  const list = (plugins.data ?? []).filter((plugin) => !plugin.draft);
  const on = list.filter((plugin) => plugin.enabled);
  const summary = on.length
    ? `${countOf(on.length, t.count_plugins)} · ${on.map((plugin) => plugin.name).join(", ")}`
    : t.manage_plugins_none;
  return (
    <DisclosureCard icon={Puzzle} title={t.manage_plugins_title} summary={summary} open={open} onToggle={onToggle}>
      <Text variant="bodyL" color="textSecondary">
        {t.manage_plugins_lead}
      </Text>
      <View role="group" aria-label={t.manage_plugins_title} style={styles.options}>
        {list.map((plugin) => (
          <CheckCard
            key={plugin.id}
            label={plugin.name}
            description={plugin.madeByAi ? `${t.build_made_by_ai} · ${plugin.description}` : plugin.description}
            emoji={plugin.icon}
            checked={plugin.enabled}
            onChange={(enabled) => sw.mutate({ pluginId: plugin.id, enabled })}
          />
        ))}
      </View>
      <Feedback error={sw.isError ? t.manage_plugins_error : null} />
      <ActionRow
        icon={Sparkles}
        title={t.build_entry_title}
        subtitle={t.build_entry_subtitle}
        href={`/app/c/${slug}/build`}
      />
    </DisclosureCard>
  );
}

function LayoutSection({ slug, open, onToggle }: SectionProps & { slug: string }) {
  const dashboard = useDashboard(slug);
  const save = useSaveDashboardOrder(slug);
  const widgets = (dashboard.data?.widgets ?? []).map((w) => ({ key: w.key, title: titleOf(w.node as UINode) }));
  const keys = widgets.map((w) => w.key);
  const move = (key: string, index: number) => save.mutate(moveTo(keys, key, index));
  return (
    <DisclosureCard
      icon={LayoutDashboard}
      title={t.manage_layout_title}
      summary={widgetsCount(widgets.length)}
      open={open}
      onToggle={onToggle}
    >
      <Text variant="bodyL" color="textSecondary">
        {widgets.length ? t.manage_layout_lead : t.manage_layout_empty}
      </Text>
      <View role="list" aria-label={t.manage_layout_title} style={styles.rows}>
        {widgets.map((w, index) => (
          <View key={w.key} role="listitem" style={styles.row}>
            <Text variant="cardTitle" color="textSecondary">
              {index + 1}
            </Text>
            <Text variant="cardTitle" style={styles.rowText}>
              {w.title}
            </Text>
            {index > 0 ? (
              <IconButton
                icon={ChevronUp}
                variant="roundSunken"
                label={`${t.dashboard_move_earlier}: ${w.title}`}
                onPress={() => move(w.key, index - 1)}
              />
            ) : null}
            {index < widgets.length - 1 ? (
              <IconButton
                icon={ChevronDown}
                variant="roundSunken"
                label={`${t.dashboard_move_later}: ${w.title}`}
                onPress={() => move(w.key, index + 1)}
              />
            ) : null}
          </View>
        ))}
      </View>
      <Feedback error={save.isError ? t.dashboard_save_error : null} />
    </DisclosureCard>
  );
}

function MembersSection({ slug, open, onToggle }: SectionProps & { slug: string }) {
  const members = usePlaceMembers(slug);
  const list = members.data ?? [];
  const admins = list.filter((m) => m.role === "admin").length;
  const summary = `${countOf(list.length, t.count_people)} · ${countOf(admins, t.count_admins)}`;
  return (
    <DisclosureCard icon={Users} title={t.manage_members_title} summary={summary} open={open} onToggle={onToggle}>
      <View role="list" aria-label={t.manage_members_title} style={styles.rows}>
        {list.map((member) => (
          <View key={member.id} role="listitem" style={styles.row}>
            <View style={styles.avatar}>
              <Text variant="buttonS" color="primary">
                {initials(member.name || member.email)}
              </Text>
            </View>
            <View style={styles.rowText}>
              <Text variant="cardTitle">{member.name || member.email}</Text>
              <Text variant="small" color="textSecondary">
                {member.email}
              </Text>
            </View>
            {member.role === "admin" ? <Badge text={t.role_admin} tone="accent" /> : null}
          </View>
        ))}
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
  header: { flexDirection: "row", alignItems: "center", gap: spacing[7] },
  headerText: { flex: 1, gap: spacing[1] },
  sections: { gap: spacing[7] },
  options: { gap: spacing[5] },
  kinds: { flexDirection: "row", flexWrap: "wrap", gap: spacing[5] },
  rows: { gap: spacing[5] },
  row: { flexDirection: "row", alignItems: "center", gap: spacing[6] },
  rowText: { flex: 1, gap: spacing[1] },
  avatar: {
    width: sizes.iconBox,
    height: sizes.iconBox,
    borderRadius: radii.pill,
    backgroundColor: colors.primaryTint,
    alignItems: "center",
    justifyContent: "center",
  },
  grow: { flex: 1 },
  delete: { alignItems: "center", gap: spacing[4] },
});
