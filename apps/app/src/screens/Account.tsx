import { useRouter } from "expo-router";
import Head from "expo-router/head";
import { Button, Heading, Screen, Text } from "../components";
import { useAuthActions } from "../data/session";
import { t } from "../texts";

/** Account tab: placeholder for the account settings; sign out stays reachable here. */
export default function Account() {
  const router = useRouter();
  const auth = useAuthActions();
  return (
    <Screen chrome={false} tabBar>
      <Head>
        <title>{t.account_title}</title>
      </Head>
      <Heading level={1} variant="heading">
        {t.account_title}
      </Heading>
      <Text variant="bodyL" color="textSecondary">
        {t.account_body}
      </Text>
      <Button
        label={t.sign_out}
        variant="secondary"
        onPress={async () => {
          await auth.signOut();
          router.replace("/login");
        }}
      />
    </Screen>
  );
}
