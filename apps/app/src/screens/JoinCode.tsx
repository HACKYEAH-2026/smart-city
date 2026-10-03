import { parseInviteCode } from "@app/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import Head from "expo-router/head";
import { ChevronLeft } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { Button, IconButton, OtpInput, Screen, SegmentedControl, Text, TextField } from "../components";
import { useFindPlace } from "../data/communities";
import { inviteCodeFromScan } from "../lib/inviteScan";
import { sectionEntering } from "../lib/motion";
import { goBack } from "../lib/navigation";
import { t } from "../texts";
import { spacing } from "../theme";

type Tab = "code" | "link";

/**
 * Joining by typing an invite code or pasting its link (design E-DolaczKod). A code that finds a place opens the
 * place's preview, where it is joined.
 */
export default function JoinCode() {
  const router = useRouter();
  const find = useFindPlace();
  // The link row opens this screen on the link tab (?tab=link); everything else starts on the code.
  const { tab: initialTab } = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(initialTab === "link" ? "link" : "code");
  const [code, setCode] = useState("");
  const [link, setLink] = useState("");
  const [invalid, setInvalid] = useState(false);

  const submit = () => {
    const typed = tab === "code" ? parseInviteCode(code) : inviteCodeFromScan(link);
    setInvalid(!typed);
    if (!typed) return;
    find.mutate(typed, {
      onSuccess: () =>
        router.push({
          pathname: "/app/preview",
          params: { code: typed },
        } as never),
    });
  };

  return (
    <Screen chrome={false}>
      <Head>
        <title>{t.join_code_title}</title>
      </Head>
      <IconButton icon={ChevronLeft} label={t.back} onPress={() => goBack(router, "/app/join-place")} />
      <View style={styles.intro}>
        <Text role="heading" aria-level={1} variant="titleXL">
          {t.join_code_title}
        </Text>
        <Text variant="bodyL" color="textSecondary">
          {t.join_code_lead}
        </Text>
      </View>

      <SegmentedControl<Tab>
        options={[
          { value: "code", label: t.join_tab_code },
          { value: "link", label: t.join_tab_link },
        ]}
        value={tab}
        onChange={setTab}
      />

      {/* The section slides in from the side of its tab: the link tab comes from the left, the code tab from the right. */}
      <Animated.View
        key={tab}
        entering={sectionEntering(tab !== "link" ? "fromLeft" : "fromRight")}
        style={styles.section}
      >
        {tab === "code" ? (
          <View style={styles.field}>
            <Text variant="label" color="textSecondary">
              {t.join_code_label}
            </Text>
            <OtpInput value={code} onChange={setCode} label={t.join_code_char} />
            <Text variant="small" color="textSecondary">
              {t.join_code_case_hint}
            </Text>
          </View>
        ) : (
          <TextField
            label={t.join_link_label}
            placeholder={t.join_link_placeholder}
            value={link}
            onChangeText={setLink}
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
          />
        )}
      </Animated.View>

      <View style={styles.grow} />
      {invalid ? (
        <Text variant="bodyL" color="primaryPressed" role="alert">
          {t.join_invalid}
        </Text>
      ) : null}
      {find.isError ? (
        <Text variant="bodyL" color="primaryPressed" role="alert">
          {t.join_not_found}
        </Text>
      ) : null}
      <Button label={t.join_submit} disabled={find.isPending} onPress={submit} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: spacing[2] },
  field: { gap: spacing[4] },
  section: { gap: spacing[6] },
  grow: { flex: 1 },
});
