import { useRouter } from "expo-router";
import Head from "expo-router/head";
import { Button, Heading, Screen, Text } from "../components";
import { useI18n } from "../lib/i18n";

export default function NotFound() {
  const { t } = useI18n();
  const router = useRouter();
  return (
    <Screen>
      <Head>
        <title>{t.meta_notfound_title()}</title>
      </Head>
      <Heading level={1}>{t.notfound_title()}</Heading>
      <Text variant="bodyL" color="textSecondary">
        {t.notfound_body()}
      </Text>
      <Button label={t.notfound_home()} fullWidth={false} onPress={() => router.replace("/")} />
    </Screen>
  );
}
