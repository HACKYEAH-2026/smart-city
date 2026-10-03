import { useRouter } from "expo-router";
import Head from "expo-router/head";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Heading, Link, Screen, Text, TextField } from "../components";
import { useAuthActions } from "../data/session";
import { useI18n } from "../lib/i18n";
import { layout } from "../theme";

/** Sign-up form. */
export default function RegisterScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const auth = useAuthActions();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async () => {
    setPending(true);
    setError(null);
    const ok = await auth.signUp(email, password, name);
    setPending(false);
    // Message from our translations, not from Better Auth (which is always in English).
    if (!ok) return setError(t.auth_register_error());
    router.replace("/app");
  };

  return (
    <Screen>
      <Head>
        <title>{t.meta_register_title()}</title>
      </Head>
      <Heading level={1}>{t.auth_register_title()}</Heading>
      <View style={styles.form}>
        <TextField label={t.auth_name()} value={name} onChangeText={setName} autoComplete="name" />
        <TextField
          label={t.auth_email()}
          value={email}
          onChangeText={setEmail}
          autoComplete="email"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextField
          label={t.auth_password()}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          onSubmitEditing={submit}
        />
      </View>
      {error ? (
        <Text variant="bodyL" color="primaryPressed" role="alert">
          {error}
        </Text>
      ) : null}
      <Button label={t.auth_submit_register()} onPress={submit} disabled={pending} />
      <Text variant="bodyL" color="textSecondary">
        {t.auth_have_account()} <Link href="/login">{t.auth_goto_login()}</Link>
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: layout.sectionGap },
});
