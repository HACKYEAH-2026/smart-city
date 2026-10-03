import type { GoogleClientIds } from "@app/shared";
import { useRouter } from "expo-router";
import Head from "expo-router/head";
import { useState } from "react";
import { Keyboard, StyleSheet, View } from "react-native";
import { Brand, Button, GoogleLogo, Heading, Link, MapDecoration, Screen, Text, TextField } from "../components";
import { type GoogleSignInResult, useAuthActions, useGoogleClientIds } from "../data/session";
import { devLoginAccount } from "../lib/config";
import { t } from "../texts";
import { layout, spacing } from "../theme";

/** Google sign-in outcomes the screen explains (a closed account picker needs no message). */
const GOOGLE_ERROR: Record<Exclude<GoogleSignInResult, "ok" | "cancelled">, string> = {
  exists: t.auth_google_exists,
  error: t.auth_google_error,
};

/**
 * Login (design E-Logowanie): map illustration, brand, welcome copy, email and password, Google, sign-up link.
 * Google signs in and signs up in one step (the account is created at the first sign-in); the button shows only
 * where the native account picker exists (not in Expo Go) and the API has a Google client.
 * With the dev login flag (src/lib/config.ts), a button at the very bottom signs in as the demo admin.
 */
export default function LoginScreen() {
  const router = useRouter();
  const auth = useAuthActions();
  const googleIds = useGoogleClientIds().data;
  const devAccount = devLoginAccount();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const signIn = async (account: { email: string; password: string }) => {
    // The error shows under the button, where an open keyboard would cover it.
    Keyboard.dismiss();
    setPending(true);
    setError(null);
    const ok = await auth.signIn(account.email, account.password);
    setPending(false);
    // Message from our translations, not from Better Auth (which is always in English).
    if (!ok) return setError(t.auth_login_error);
    router.replace("/app");
  };
  const submit = () => signIn({ email, password });

  const continueWithGoogle = async (ids: GoogleClientIds) => {
    setPending(true);
    setError(null);
    const result = await auth.signInWithGoogle(ids);
    setPending(false);
    if (result === "ok") return router.replace("/app");
    if (result !== "cancelled") setError(GOOGLE_ERROR[result]);
  };

  return (
    <Screen chrome={false} backdrop={<MapDecoration />}>
      <Head>
        <title>{t.meta_login_title}</title>
      </Head>
      <View style={styles.spacer} />
      <Brand />
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
        {googleIds ? (
          <View style={styles.social}>
            <Button
              variant="secondary"
              size="md"
              label={t.auth_google}
              leftIcon={<GoogleLogo />}
              onPress={() => continueWithGoogle(googleIds)}
              disabled={pending}
            />
            <Text variant="small" color="textSecondary" style={styles.center}>
              {t.auth_google_consent}
            </Text>
          </View>
        ) : null}
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
      {devAccount ? (
        <Button
          variant="ghost"
          size="sm"
          label={`${t.auth_dev_login} ${devAccount.email}`}
          onPress={() => signIn(devAccount)}
          disabled={pending}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Design: content starts at y = 200; the frame's own top offset and section gap are already applied.
  spacer: { height: layout.loginContentTop - layout.screenTopOffset - layout.sectionGap },
  intro: { gap: spacing[4] },
  form: { gap: spacing[7] },
  // Design: social sign-in buttons sit in a grid with gap 10 under the main button.
  social: { gap: spacing[5] },
  grow: { flex: 1 },
  center: { textAlign: "center" },
});
