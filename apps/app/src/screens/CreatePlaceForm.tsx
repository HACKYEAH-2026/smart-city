import type { JoinRule, PlaceKind } from "@app/shared";
import { useRouter } from "expo-router";
import Head from "expo-router/head";
import { ChevronLeft, ShieldCheck, X } from "lucide-react-native";
import { type ReactNode, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  Button,
  Heading,
  Icon,
  RadioCard,
  Screen,
  SelectableCard,
  StepHeader,
  SwitchRow,
  Text,
  TextField,
} from "../components";
import { useCreatePlace, useVisitPlace } from "../data/communities";
import { PLACE_KIND_OPTIONS } from "../lib/placeKinds";
import { t } from "../texts";
import { fontFamily, sizes, spacing } from "../theme";

const JOIN_RULE_OPTIONS: { rule: JoinRule; label: string; hint: string; recommended?: boolean }[] = [
  { rule: "open", label: t.join_rule_open, hint: t.join_rule_open_hint },
  { rule: "approval", label: t.join_rule_approval, hint: t.join_rule_approval_hint, recommended: true },
  { rule: "invite", label: t.join_rule_invite, hint: t.join_rule_invite_hint },
];

/**
 * New place in three steps (designs E-NoweMiejsceTyp, E-NoweMiejsceDane, E-NoweMiejsceDostep): the kind, the name
 * with address and description, then who may join. Back keeps the answers; the place opens on "place created".
 */
export default function CreatePlaceForm() {
  const router = useRouter();
  const create = useCreatePlace();
  const visit = useVisitPlace();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [kind, setKind] = useState<PlaceKind | null>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [joinRule, setJoinRule] = useState<JoinRule>("approval");
  const [makeDefault, setMakeDefault] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    create.mutate(
      { name, kind: kind ?? "other", address, description, joinRule, makeDefault },
      {
        onSuccess: (place) =>
          visit.mutate(place.slug, {
            onSuccess: () => router.replace({ pathname: "/app/created", params: { slug: place.slug } }),
          }),
        onError: () => setError(t.create_error),
      },
    );
  };

  return (
    <Screen chrome={false}>
      <Head>
        <title>{t.create_title}</title>
      </Head>
      {step === 1 ? (
        <Step
          header={
            <StepHeader
              step={1}
              total={3}
              label={t.create_step_1}
              backIcon={X}
              backLabel={t.create_cancel}
              onBack={() => router.replace("/app")}
            />
          }
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
          header={<BackHeader step={2} label={t.create_step_2} onBack={() => setStep(1)} />}
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
          <TextField
            label={t.create_description}
            value={description}
            onChangeText={setDescription}
            placeholder={t.create_description_placeholder}
            multiline
          />
        </Step>
      ) : (
        <Step
          header={<BackHeader step={3} label={t.create_step_3} onBack={() => setStep(2)} />}
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
          <View role="radiogroup" aria-label={t.join_rules_label} style={styles.rules}>
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
          <SwitchRow label={t.create_make_default} value={makeDefault} onChange={setMakeDefault} />
        </Step>
      )}
    </Screen>
  );
}

/** One step: header, title with lead, the step's fields, then the bottom action after a spacer. */
function Step({
  header,
  title,
  lead,
  children,
  action,
}: {
  header: ReactNode;
  title: string;
  lead: string;
  children: ReactNode;
  action: ReactNode;
}) {
  return (
    <>
      {header}
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

function BackHeader({ step, label, onBack }: { step: 2 | 3; label: string; onBack: () => void }) {
  return <StepHeader step={step} total={3} label={label} backIcon={ChevronLeft} backLabel={t.back} onBack={onBack} />;
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
  rules: { gap: spacing[5] },
  grow: { flex: 1 },
  action: { gap: spacing[8] },
  note: { flexDirection: "row", alignItems: "flex-start", gap: spacing[5] },
  noteText: { flex: 1 },
  noteRole: { fontFamily: fontFamily.semibold },
});
