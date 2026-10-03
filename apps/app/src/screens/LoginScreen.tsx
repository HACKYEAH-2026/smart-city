import { useRouter } from "expo-router";
import Head from "expo-router/head";
import { MapPin } from "lucide-react-native";
import { useState } from "react";
import { Keyboard, StyleSheet, View } from "react-native";
import { Button, Heading, Icon, Link, MapDecoration, Screen, Text, TextField } from "../components";
import { useAuthActions } from "../data/session";
import { t } from "../texts";
import { layout, spacing } from "../theme";

/** Login (design E-Logowanie): map illustration, brand, welcome copy, email and password, sign-up link. */
export default function LoginScreen() {
  const router = useRouter();
  const auth = useAuthActions();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async () => {
    // The error shows under the button, where an open keyboard would cover it.
    Keyboard.dismiss();
    setPending(true);
    setError(null);
    const ok = await auth.signIn(email, password);
    setPending(false);
    // Message from our translations, not from Better Auth (which is always in English).
    if (!ok) return setError(t.auth_login_error);
    router.replace("/app");
  };

  return (
    <Screen chrome={false} backdrop={<MapDecoration />}>
      <Head>
        <title>{t.meta_login_title}</title>
      </Head>
      <View style={styles.spacer} />
      <View style={styles.brand}>
        <View aria-hidden>
          <Icon icon={MapPin} color="primary" strokeWidth={2.2} />
        </View>
        <Text variant="brand">{t.app_name}</Text>
      </View>
      <View style={styles.intro}>
        <Heading level={1} variant="titleXL">
          {t.auth_login_title}
        </Heading>
        <Text variant="bodyL" color="textSecondary">
          {t.auth_login_lead}
        </Text>
      </View>
      <View style={styles.form}>
        <TextField
          label={t.auth_email}
          value={email}
          onChangeText={setEmail}
          autoComplete="email"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextField
          label={t.auth_password}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          onSubmitEditing={submit}
        />
        <Button label={t.auth_submit_login} onPress={submit} disabled={pending} />
        {/* Under the buttons, so nothing above it moves; the spacer below takes the extra height. */}
        {error ? (
          <Text variant="bodyL" color="primaryPressed" role="alert">
            {error}
          </Text>
        ) : null}
      </View>
      <View style={styles.grow} />
      <Text variant="body" color="textSecondary" style={styles.center}>
        {t.auth_no_account} <Link href="/register">{t.auth_goto_register}</Link>
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Design: content starts at y = 200; the frame's own top offset and section gap are already applied.
  spacer: { height: layout.loginContentTop - layout.screenTopOffset - layout.sectionGap },
  brand: { flexDirection: "row", alignItems: "center", gap: spacing[4] },
  intro: { gap: spacing[4] },
  form: { gap: spacing[7] },
  grow: { flex: 1 },
  center: { textAlign: "center" },
});
