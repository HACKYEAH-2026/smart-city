import type { NotificationTone } from "@app/plugin-sdk";
import { type MyPlace, type NotificationItem, PLACES_MAX, type Place } from "@app/shared";
import { Link as RouterLink, useRouter } from "expo-router";
import Head from "expo-router/head";
import {
  Bell,
  ChevronRight,
  CircleCheck,
  type LucideIcon,
  MapPin,
  Plus,
  Siren,
  Smartphone,
  Trash,
  TriangleAlert,
} from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import {
  ActionRow,
  Badge,
  Button,
  Card,
  Chip,
  Heading,
  Icon,
  IconBox,
  IconButton,
  Screen,
  Text,
  TextField,
} from "../components";
import { useCommunities } from "../data/communities";
import { useAddSavedPlace, useMarkRead, useNotifications, useRemoveSavedPlace, useSavedPlaces } from "../data/me";
import { useAuthActions, useSession } from "../data/session";
import { tapFeedback } from "../lib/haptics";
import { placeKindLabel } from "../lib/placeKinds";
import { initials } from "../lib/places";
import { countOf } from "../lib/plural";
import { usePressed } from "../lib/pressed";
import { relativeTime } from "../lib/relativeTime";
import { hasAppSettings, openAppSettings } from "../lib/settings";
import { notificationHref } from "../plugins/href";
import { t } from "../texts";
import { borders, colors, opacity, radii, shadows, sizes, spacing } from "../theme";
import LocationPicker, { type PickedLocation } from "./LocationPicker";

/**
 * Account tab: who is signed in, the notifications from the plugins of their places, the addresses where
 * notifications about things nearby reach them (private: plugins never see them), their places with their role,
 * the app's permissions (phones only) and signing out. A new address is picked on the map, then named here.
 */
export default function Account() {
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<PickedLocation | null>(null);
  if (picking)
    return (
      <LocationPicker
        title={t.account_nearby_picker_title}
        hint={t.account_nearby_pin_hint}
        initial={picked?.location ?? null}
        onConfirm={(location) => {
          setPicked(location);
          setPicking(false);
        }}
        onCancel={() => setPicking(false)}
      />
    );
  return (
    <Screen chrome={false} tabBar>
      <Head>
        <title>{t.account_title}</title>
      </Head>
      <Heading level={1} variant="heading">
        {t.account_title}
      </Heading>
      <Profile />
      <Notifications />
      <Nearby picked={picked} onAdd={() => setPicking(true)} onDone={() => setPicked(null)} />
      <Places />
      {hasAppSettings ? <AppSettings /> : null}
      <SignOut />
    </Screen>
  );
}

/** The user's initials, name and email (a user who signed up without a name has the email as the name). */
function Profile() {
  const session = useSession();
  const user = session.data;
  if (!user) return null;
  const named = Boolean(user.name) && user.name !== user.email;
  return (
    <Card style={styles.profile}>
      <View style={styles.profileAvatar}>
        <Text variant="headingS" color="primary">
          {initials(named ? user.name : user.email)}
        </Text>
      </View>
      <View style={styles.rowText}>
        <Heading level={2} variant={named ? "headingS" : "cardTitle"}>
          {named ? user.name : user.email}
        </Heading>
        {named ? (
          <Text variant="caption" color="textSecondary">
            {user.email}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

/** Notifications shown before "Pokaż wszystkie". */
const NOTIFICATIONS_PREVIEW = 5;

function Notifications() {
  const router = useRouter();
  const inbox = useNotifications();
  const markRead = useMarkRead();
  const [all, setAll] = useState(false);
  const items = inbox.data?.items ?? [];
  const unread = inbox.data?.unread ?? 0;
  const open = (item: NotificationItem) => {
    if (!item.read) markRead.mutate([item.id]);
    const target = notificationHref({
      notificationId: item.id,
      community: item.community.slug,
      pluginId: item.pluginId,
      open: item.open,
    });
    if (target) router.push(target.href as never);
  };
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text variant="label" color="textSecondary">
          {t.account_notifications_label}
        </Text>
        {unread ? <Badge text={countOf(unread, t.count_unread)} tone="accent" /> : null}
      </View>
      {inbox.isPending ? null : items.length ? (
        <Card style={styles.listCard}>
          <View role="list" aria-label={t.account_notifications_label}>
            {(all ? items : items.slice(0, NOTIFICATIONS_PREVIEW)).map((item, i) => (
              <NotificationRow key={item.id} item={item} divided={i > 0} onPress={() => open(item)} />
            ))}
          </View>
        </Card>
      ) : (
        <Text variant="captionRelaxed" color="textSecondary">
          {t.account_notifications_empty}
        </Text>
      )}
      {items.length > NOTIFICATIONS_PREVIEW ? (
        <Button
          label={all ? t.account_notifications_less : `${t.account_notifications_more} (${items.length})`}
          variant="ghost"
          size="sm"
          onPress={() => setAll(!all)}
        />
      ) : null}
      {unread ? (
        <Button
          label={t.account_notifications_read_all}
          variant="secondary"
          size="sm"
          disabled={markRead.isPending}
          onPress={() => markRead.mutate(undefined)}
        />
      ) : null}
    </View>
  );
}

const TONE_ICON: Record<NotificationTone, LucideIcon> = {
  info: Bell,
  success: CircleCheck,
  warning: TriangleAlert,
  danger: Siren,
};

/** A notification: what happened, where and when; an unread one has a red icon and a dot. */
function NotificationRow({
  item,
  divided,
  onPress,
}: {
  item: NotificationItem;
  divided: boolean;
  onPress: () => void;
}) {
  const meta = `${item.community.name} · ${relativeTime(item.createdAt)}`;
  return (
    <View role="listitem" style={divided ? styles.divided : null}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={[item.title, meta, item.read ? null : t.account_notification_unread]
          .filter(Boolean)
          .join(", ")}
        onPress={onPress}
        onPressIn={tapFeedback}
        style={({ pressed }) => [styles.row, styles.listRow, pressed && styles.pressed]}
      >
        <IconBox icon={TONE_ICON[item.tone]} size="sm" neutral={item.read} />
        <View style={styles.rowText}>
          <Text variant="cardTitle">{item.title}</Text>
          {item.body ? (
            <Text variant="caption" color="textBody" numberOfLines={2}>
              {item.body}
            </Text>
          ) : null}
          <Text variant="small" color="textSecondary">
            {meta}
          </Text>
        </View>
        {item.read ? null : <View style={styles.unreadDot} />}
      </Pressable>
    </View>
  );
}

/** Addresses for nearby notifications: the list, adding one (map, then a name) and the privacy note. */
function Nearby({ picked, onAdd, onDone }: { picked: PickedLocation | null; onAdd: () => void; onDone: () => void }) {
  const places = useSavedPlaces();
  const remove = useRemoveSavedPlace();
  const list = places.data ?? [];
  const add = picked ? (
    <NewAddress picked={picked} onDone={onDone} />
  ) : list.length >= PLACES_MAX ? (
    <Text variant="small" color="textSecondary">
      {`${t.account_nearby_limit} (${PLACES_MAX}).`}
    </Text>
  ) : (
    <Button
      label={t.account_nearby_add}
      variant="secondary"
      size="md"
      leftIcon={<Icon icon={Plus} size={sizes.iconS} strokeWidth={2} />}
      onPress={onAdd}
    />
  );
  return (
    <View style={styles.section}>
      <Text variant="label" color="textSecondary">
        {t.account_nearby_label}
      </Text>
      <Text variant="captionRelaxed" color="textBody">
        {t.account_nearby_body}
      </Text>
      {places.isPending ? null : list.length ? (
        <Card style={styles.listCard}>
          <View role="list" aria-label={t.account_nearby_label}>
            {list.map((place, i) => (
              <SavedPlaceRow key={place.id} place={place} divided={i > 0} onRemove={() => remove.mutate(place.id)} />
            ))}
          </View>
        </Card>
      ) : (
        <Text variant="caption" color="textSecondary">
          {t.account_nearby_empty}
        </Text>
      )}
      {places.isPending ? null : add}
      <Text variant="small" color="textSecondary">
        {t.account_nearby_private}
      </Text>
    </View>
  );
}

function SavedPlaceRow({ place, divided, onRemove }: { place: Place; divided: boolean; onRemove: () => void }) {
  return (
    <View role="listitem" style={[styles.row, styles.listRow, divided && styles.divided]}>
      <IconBox icon={MapPin} size="sm" />
      <View style={styles.rowText}>
        <Text variant="cardTitle">{place.label}</Text>
        <Text variant="small" color="textSecondary">
          {place.address || t.location_unknown}
        </Text>
      </View>
      <IconButton
        icon={Trash}
        variant="plain"
        label={`${t.account_nearby_remove}: ${place.label}`}
        onPress={onRemove}
      />
    </View>
  );
}

const NAME_SUGGESTIONS = [
  t.account_nearby_home,
  t.account_nearby_work,
  t.account_nearby_school,
  t.account_nearby_family,
];

/** The address picked on the map, named with a suggestion or own words, then saved (or dropped). */
function NewAddress({ picked, onDone }: { picked: PickedLocation; onDone: () => void }) {
  const [name, setName] = useState("");
  const add = useAddSavedPlace();
  const label = name.trim();
  // Only the point: a location picked from the search results is the whole address (with its own label).
  const { lat, lng } = picked.location;
  const save = () => add.mutate({ label, address: picked.address, lat, lng }, { onSuccess: onDone });
  return (
    <View role="region" aria-label={t.account_nearby_new}>
      <Card style={styles.form}>
        <Text variant="label" color="textSecondary">
          {t.account_nearby_new}
        </Text>
        <View style={styles.row}>
          <IconBox icon={MapPin} size="sm" />
          <Text variant="cardTitle" style={styles.rowText}>
            {picked.address || t.location_unknown}
          </Text>
        </View>
        <View role="radiogroup" aria-label={t.account_nearby_suggestions} style={styles.chips}>
          {NAME_SUGGESTIONS.map((suggestion) => (
            <Chip
              key={suggestion}
              label={suggestion}
              selected={label === suggestion}
              onPress={() => setName(suggestion)}
            />
          ))}
        </View>
        <TextField
          label={t.account_nearby_name}
          placeholder={t.account_nearby_name_placeholder}
          value={name}
          onChangeText={setName}
          maxLength={40}
          returnKeyType="done"
          onSubmitEditing={label ? save : undefined}
        />
        {add.isError ? (
          <Text variant="small" color="primaryPressed" role="alert">
            {t.account_nearby_error}
          </Text>
        ) : null}
        <View style={styles.formActions}>
          <Button label={t.create_cancel} variant="secondary" size="sm" style={styles.grow} onPress={onDone} />
          <Button
            label={t.account_nearby_save}
            size="sm"
            style={styles.grow}
            disabled={!label || add.isPending}
            onPress={save}
          />
        </View>
      </Card>
    </View>
  );
}

/** The user's places with their role; a place opens on the dashboard (/app/c/<slug>, screens/OpenPlace.tsx). */
function Places() {
  const places = useCommunities();
  const list = places.data ?? [];
  if (!list.length) return null;
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text variant="label" color="textSecondary">
          {t.account_places_label}
        </Text>
        <Text variant="small" color="textSecondary">
          {countOf(list.length, t.count_places)}
        </Text>
      </View>
      <View role="list" aria-label={t.account_places_label} style={styles.places}>
        {list.map((place) => (
          <View key={place.id} role="listitem">
            <PlaceLink place={place} />
          </View>
        ))}
      </View>
    </View>
  );
}

function PlaceLink({ place }: { place: MyPlace }) {
  const press = usePressed(tapFeedback);
  return (
    <RouterLink href={`/app/c/${encodeURIComponent(place.slug)}` as never} asChild>
      <Pressable
        accessibilityRole="link"
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={StyleSheet.flatten([styles.row, styles.placeRow, press.pressed && styles.pressed])}
      >
        <View style={styles.placeAvatar}>
          <Text variant="abbr" color="primary">
            {initials(place.name)}
          </Text>
        </View>
        <View style={styles.rowText}>
          <Text variant="cardTitle">{place.name}</Text>
          <Text variant="small" color="textSecondary">
            {placeKindLabel(place.kind)}
          </Text>
          {place.role === "admin" || place.isDefault ? (
            <View style={styles.badges}>
              {place.role === "admin" ? <Badge text={t.role_admin} tone="accent" /> : null}
              {place.isDefault ? <Badge text={t.place_default_badge} /> : null}
            </View>
          ) : null}
        </View>
        <Icon icon={ChevronRight} size={sizes.iconS} color="iconMuted" strokeWidth={2} />
      </Pressable>
    </RouterLink>
  );
}

/** Phones only: the system settings, where notifications, the camera and location are allowed or denied. */
function AppSettings() {
  return (
    <View style={styles.section}>
      <Text variant="label" color="textSecondary">
        {t.account_app_label}
      </Text>
      <ActionRow
        icon={Smartphone}
        title={t.account_permissions}
        subtitle={t.account_permissions_hint}
        onPress={() => {
          void openAppSettings();
        }}
      />
    </View>
  );
}

function SignOut() {
  const router = useRouter();
  const auth = useAuthActions();
  return (
    <Button
      label={t.sign_out}
      variant="secondary"
      onPress={async () => {
        await auth.signOut();
        router.replace("/login");
      }}
    />
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: opacity.pressed },
  section: { gap: spacing[6] },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing[6] },
  profile: { flexDirection: "row", alignItems: "center", gap: spacing[8] },
  profileAvatar: {
    width: sizes.avatarProfile,
    height: sizes.avatarProfile,
    borderRadius: radii.pill,
    backgroundColor: colors.primaryTint,
    alignItems: "center",
    justifyContent: "center",
  },
  listCard: { paddingVertical: spacing[2], paddingHorizontal: spacing[8], gap: 0 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing[6] },
  listRow: { paddingVertical: spacing[6] },
  rowText: { flex: 1, gap: spacing[1] },
  divided: { borderTopWidth: borders.hairline, borderTopColor: colors.divider },
  unreadDot: {
    width: sizes.unreadDot,
    height: sizes.unreadDot,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  form: { gap: spacing[7] },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing[4] },
  formActions: { flexDirection: "row", gap: spacing[5] },
  grow: { flex: 1 },
  places: { gap: spacing[5] },
  placeRow: {
    gap: spacing[7],
    paddingVertical: spacing[5],
    paddingLeft: spacing[5],
    paddingRight: spacing[7],
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  placeAvatar: {
    width: sizes.iconBox,
    height: sizes.iconBox,
    borderRadius: radii.md,
    backgroundColor: colors.primaryTint,
    alignItems: "center",
    justifyContent: "center",
  },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: spacing[3], paddingTop: spacing[1] },
});
