import type { GeoPoint } from "@app/plugin-sdk";
import type { JoinRule, PlaceKind } from "@app/shared";
import { useRouter } from "expo-router";
import Head from "expo-router/head";
import { ChevronLeft, MapPin, ShieldCheck, X } from "lucide-react-native";
import { type ReactNode, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  Button,
  CheckCard,
  Heading,
  Icon,
  MapView,
  RadioCard,
  Screen,
  SelectableCard,
  StepHeader,
  SwitchRow,
  Text,
  TextField,
} from "../components";
import { useCreatePlace, useVisitPlace } from "../data/communities";
import { usePluginCatalog } from "../data/plugins";
import { JOIN_RULE_OPTIONS } from "../lib/joinRules";
import { STREET_ZOOM } from "../lib/map/spec";
import { goBack } from "../lib/navigation";
import { PLACE_KIND_OPTIONS, placeKindIcon } from "../lib/placeKinds";
import { t } from "../texts";
import { borders, colors, fontFamily, radii, sizes, spacing } from "../theme";
import LocationPicker from "./LocationPicker";

type WizardStep = 1 | 2 | 3 | 4;

const STEP_LABELS: Record<WizardStep, string> = {
  1: t.create_step_1,
  2: t.create_step_2,
  3: t.create_step_3,
  4: t.create_step_4,
};

const PREVIOUS_STEP = { 2: 1, 3: 2, 4: 3 } as const;

/**
 * New place in four steps (designs E-NoweMiejsceTyp, E-NoweMiejsceDane, E-NoweMiejsceDostep): the kind, the name
 * with address, pin and description, the features (built-in plugins, all on by default), then who may join and
 * whether the place is on the map of places (only with a pin). The pin is set on the location picker, shown over the
 * second step; it fills in the address. Back keeps the answers; the place opens on "place created".
 */
export default function CreatePlaceForm() {
  const router = useRouter();
  const create = useCreatePlace();
  const visit = useVisitPlace();
  const catalog = usePluginCatalog();
  const [step, setStep] = useState<WizardStep>(1);
  const [kind, setKind] = useState<PlaceKind | null>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState<GeoPoint | null>(null);
  const [picking, setPicking] = useState(false);
  const [onMap, setOnMap] = useState(false);
  const [joinRule, setJoinRule] = useState<JoinRule>("approval");
  const [makeDefault, setMakeDefault] = useState(true);
  // Features the creator switched off; every other built-in plugin is on, so the default needs no loaded catalog.
  const [skipped, setSkipped] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const plugins = (catalog.data ?? []).filter((plugin) => !skipped.includes(plugin.id)).map((plugin) => plugin.id);
  const toggle = (id: string, on: boolean) =>
    setSkipped((off) => (on ? off.filter((other) => other !== id) : [...off, id]));

  const submit = () => {
    setError(null);
    create.mutate(
      {
        name,
        kind: kind ?? "other",
        address,
        description,
        joinRule,
        location,
        onMap: Boolean(location) && onMap,
        makeDefault,
        plugins,
      },
      {
        onSuccess: (place) =>
          visit.mutate(place.slug, {
            onSuccess: () => router.replace({ pathname: "/app/created", params: { slug: place.slug } }),
          }),
        onError: () => setError(t.create_error),
      },
    );
  };

  if (picking)
    return (
      <LocationPicker
        hint={`${name} · ${t.location_pin_hint}`}
        icon={placeKindIcon(kind ?? "other")}
        initial={location}
        onCancel={() => setPicking(false)}
        onConfirm={(picked) => {
          setLocation(picked.location);
          if (picked.address) setAddress(picked.address);
          setPicking(false);
        }}
      />
    );

  return (
    <Screen chrome={false}>
      <Head>
        <title>{t.create_title}</title>
      </Head>
      <StepHeader
        step={step}
        total={4}
        label={STEP_LABELS[step]}
        backIcon={step === 1 ? X : ChevronLeft}
        backLabel={step === 1 ? t.create_cancel : t.back}
        onBack={() => (step === 1 ? goBack(router, "/app") : setStep(PREVIOUS_STEP[step]))}
      />
      {step === 1 ? (
        <Step
          title={t.create_kind_title}
          lead={t.create_kind_lead}
          action={<Button label={t.create_next} disabled={!kind} onPress={() => setStep(2)} />}
        >
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
        </Step>
      ) : step === 2 ? (
        <Step
          title={t.create_details_title}
          lead={t.create_details_lead}
          action={<Button label={t.create_next} disabled={!name.trim()} onPress={() => setStep(3)} />}
        >
          <TextField label={t.create_name} value={name} onChangeText={setName} />
          <TextField
            label={t.create_address}
            value={address}
            onChangeText={setAddress}
            placeholder={t.create_address_placeholder}
            autoComplete="street-address"
          />
          <LocationField
            name={name}
            location={location}
            onPick={() => setPicking(true)}
            onRemove={() => {
              setLocation(null);
              setOnMap(false);
            }}
          />
          <TextField
            label={t.create_description}
            value={description}
            onChangeText={setDescription}
            placeholder={t.create_description_placeholder}
            multiline
          />
        </Step>
      ) : step === 3 ? (
        <Step
          title={t.create_features_title}
          lead={t.create_features_lead}
          action={<Button label={t.create_next} disabled={!plugins.length} onPress={() => setStep(4)} />}
        >
          {catalog.isError ? (
            <Text variant="bodyL" color="primaryPressed" role="alert">
              {t.create_features_error}
            </Text>
          ) : null}
          <View role="group" aria-label={t.create_features_label} style={styles.options}>
            {(catalog.data ?? []).map((plugin) => (
              <CheckCard
                key={plugin.id}
                label={plugin.name}
                description={plugin.description}
                emoji={plugin.icon}
                checked={!skipped.includes(plugin.id)}
                onChange={(on) => toggle(plugin.id, on)}
              />
            ))}
          </View>
        </Step>
      ) : (
        <Step
          title={t.create_access_title}
          lead={t.create_access_lead}
          action={
            <>
              <AdminNote />
              {error ? (
                <Text variant="bodyL" color="primaryPressed" role="alert">
                  {error}
                </Text>
              ) : null}
              <Button label={t.create_submit} disabled={create.isPending || visit.isPending} onPress={submit} />
            </>
          }
        >
          <View role="radiogroup" aria-label={t.join_rules_label} style={styles.options}>
            {JOIN_RULE_OPTIONS.map((option) => (
              <RadioCard
                key={option.rule}
                label={option.label}
                description={option.hint}
                badge={option.recommended ? t.badge_recommended : undefined}
                selected={joinRule === option.rule}
                onPress={() => setJoinRule(option.rule)}
              />
            ))}
          </View>
          {location ? (
            <View style={styles.onMap}>
              <SwitchRow label={t.create_on_map} value={onMap} onChange={setOnMap} />
              <Text variant="caption" color="textSecondary">
                {t.create_on_map_hint}
              </Text>
            </View>
          ) : null}
          <SwitchRow label={t.create_make_default} value={makeDefault} onChange={setMakeDefault} />
        </Step>
      )}
    </Screen>
  );
}

/** One step under the shared header: title with lead, the step's fields, then the bottom action after a spacer. */
function Step({
  title,
  lead,
  children,
  action,
}: {
  title: string;
  lead: string;
  children: ReactNode;
  action: ReactNode;
}) {
  return (
    <>
      <View style={styles.intro}>
        <Heading level={1}>{title}</Heading>
        <Text variant="bodyL" color="textSecondary">
          {lead}
        </Text>
      </View>
      <View style={styles.fields}>{children}</View>
      <View style={styles.grow} />
      <View style={styles.action}>{action}</View>
    </>
  );
}

/** The place's pin on the second step: a button to set it, or a still map with the pin and buttons to change it. */
function LocationField({
  name,
  location,
  onPick,
  onRemove,
}: {
  name: string;
  location: GeoPoint | null;
  onPick: () => void;
  onRemove: () => void;
}) {
  return (
    <View style={styles.location}>
      <Text variant="label" color="textSecondary">
        {t.create_location_label}
      </Text>
      {location ? (
        <>
          <MapView
            // A new pin starts a new preview: the map's first view is its only one.
            key={`${location.lat},${location.lng}`}
            label={t.create_location_preview}
            center={location}
            zoom={STREET_ZOOM}
            pins={[{ id: "new", title: name, ...location }]}
            interactive={false}
            style={styles.preview}
          />
          <View style={styles.locationActions}>
            <Button
              label={t.create_location_change}
              variant="secondary"
              size="sm"
              onPress={onPick}
              style={styles.grow}
            />
            <Button label={t.create_location_remove} variant="ghost" size="sm" onPress={onRemove} style={styles.grow} />
          </View>
        </>
      ) : (
        <>
          <Button
            label={t.create_location_pick}
            variant="secondary"
            leftIcon={<Icon icon={MapPin} size={sizes.iconS} color="primary" />}
            onPress={onPick}
          />
          <Text variant="caption" color="textSecondary">
            {t.create_location_hint}
          </Text>
        </>
      )}
    </View>
  );
}

/** "Zostaniesz administratorem tego miejsca…" with a shield (design E-NoweMiejsceDostep). */
function AdminNote() {
  return (
    <View style={styles.note}>
      <Icon icon={ShieldCheck} size={sizes.iconS} strokeWidth={2} />
      <Text variant="captionRelaxed" color="textSecondary" style={styles.noteText}>
        {t.create_admin_note_before}
        <Text variant="captionRelaxed" style={styles.noteRole}>
          {t.create_admin_note_role}
        </Text>
        {t.create_admin_note_after}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  intro: { gap: spacing[4] },
  fields: { gap: spacing[8] },
  kinds: { flexDirection: "row", flexWrap: "wrap", gap: spacing[5] },
  options: { gap: spacing[5] },
  grow: { flex: 1 },
  action: { gap: spacing[8] },
  note: { flexDirection: "row", alignItems: "flex-start", gap: spacing[5] },
  noteText: { flex: 1 },
  noteRole: { fontFamily: fontFamily.semibold },
  location: { gap: spacing[3] },
  preview: {
    height: sizes.locationPreview,
    borderRadius: radii.xl,
    borderWidth: borders.hairline,
    borderColor: colors.border,
  },
  locationActions: { flexDirection: "row", gap: spacing[5] },
  onMap: { gap: spacing[3] },
});
