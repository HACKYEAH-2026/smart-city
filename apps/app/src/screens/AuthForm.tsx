import { useRouter } from "expo-router";
import Head from "expo-router/head";
import { useState } from "react";
import { View } from "react-native";
import { AppLink, Body, Button, Heading, Page, TextField } from "../components/ui";
import { useAuthActions } from "../data/session";
import { useI18n } from "../lib/i18n";
import { space } from "../theme";

type Mode = "login" | "register";

export function AuthForm(props: { mode: Mode }) {
  const { t } = useI18n();
  const router = useRouter();
  const auth = useAuthActions();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const isRegister = props.mode === "register";

  const submit = async () => {
    setPending(true);
    setError(null);
    const ok = isRegister ? await auth.signUp(email, password, name) : await auth.signIn(email, password);
    setPending(false);
    // Komunikat z naszych tłumaczeń, nie z Better Auth (ten jest zawsze po angielsku).
    if (!ok) return setError(isRegister ? t.auth_register_error() : t.auth_login_error());
    router.replace("/app");
  };

  return (
    <Page narrow>
      <Head>
        <title>{isRegister ? t.meta_register_title() : t.meta_login_title()}</title>
      </Head>
      <View style={{ gap: space.l }}>
        <Heading level={1} size="section">
          {isRegister ? t.auth_register_title() : t.auth_login_title()}
        </Heading>
        {isRegister ? (
          <TextField label={t.auth_name()} value={name} onChangeText={setName} autoComplete="name" />
        ) : null}
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
          autoComplete={isRegister ? "new-password" : "current-password"}
          onSubmitEditing={submit}
        />
        {error ? (
          <Body tone="error" role="alert">
            {error}
          </Body>
        ) : null}
        <Button
          label={isRegister ? t.auth_submit_register() : t.auth_submit_login()}
          onPress={submit}
          disabled={pending}
        />
        <Body>
          {isRegister ? t.auth_have_account() : t.auth_no_account()}{" "}
          <AppLink href={isRegister ? "/login" : "/register"}>
            {isRegister ? t.auth_goto_login() : t.auth_goto_register()}
          </AppLink>
        </Body>
      </View>
    </Page>
  );
}
