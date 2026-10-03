import { useRouter } from "expo-router";
import Head from "expo-router/head";
import { ChevronLeft } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Checkbox, Heading, IconButton, Link, PasswordStrength, Screen, Text, TextField } from "../components";
import { useAuthActions } from "../data/session";
import { goBack } from "../lib/navigation";
import { MIN_PASSWORD_LENGTH } from "../lib/passwordStrength";
import { t } from "../texts";
import { spacing } from "../theme";

/** Sign-up (design E-Rejestracja): back button, step label, name, email, password with strength meter, consent. */
export default function RegisterScreen() {
  const router = useRouter();
  const auth = useAuthActions();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async () => {
    setError(null);
    // Checked here too: the API would reject it, and its error would read like a taken email.
    if (password.length < MIN_PASSWORD_LENGTH) return setError(t.auth_password_too_short);
    if (!consent) return setError(t.auth_consent_required);
    setPending(true);
    const ok = await auth.signUp(email, password, name);
    setPending(false);
    // Message from our translations, not from Better Auth (which is always in English).
    if (!ok) return setError(t.auth_register_error);
    router.replace("/app");
  };

  return (
    <Screen chrome={false}>
      <Head>
        <title>{t.meta_register_title}</title>
      </Head>
      <View style={styles.topRow}>
        <IconButton icon={ChevronLeft} label={t.auth_back} onPress={() => goBack(router, "/login")} />
        <Text variant="label" color="textSecondary">
          {t.auth_step}
        </Text>
      </View>
      <View style={styles.intro}>
        <Heading level={1}>{t.auth_register_title}</Heading>
        <Text variant="bodyL" color="textSecondary">
          {t.auth_register_lead}
        </Text>
      </View>
      <View style={styles.form}>
        <TextField
          label={t.auth_name}
          placeholder={t.auth_name_placeholder}
          value={name}
          onChangeText={setName}
          autoComplete="name"
        />
        <TextField
          label={t.auth_email}
          placeholder={t.auth_email_placeholder}
          value={email}
          onChangeText={setEmail}
          autoComplete="email"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <View style={styles.password}>
          <TextField
            label={t.auth_password}
            placeholder={t.auth_password_placeholder}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
          />
          <PasswordStrength password={password} />
        </View>
        <Checkbox checked={consent} onChange={setConsent} label={t.auth_consent} />
        {error ? (
          <Text variant="bodyL" color="primaryPressed" role="alert">
            {error}
          </Text>
        ) : null}
      </View>
      <View style={styles.grow} />
      <View style={styles.bottom}>
        <Button label={t.auth_submit_register} onPress={submit} disabled={pending} />
        <Text variant="body" color="textSecondary" style={styles.center}>
          {t.auth_have_account} <Link href="/login">{t.auth_goto_login}</Link>
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  intro: { gap: spacing[4] },
  form: { gap: spacing[7] },
  password: { gap: spacing[4] },
  grow: { flex: 1 },
  bottom: { gap: spacing[8] },
  center: { textAlign: "center" },
});
