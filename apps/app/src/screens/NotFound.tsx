import Head from "expo-router/head";
import { View } from "react-native";
import { AppLink, Body, Heading, Page } from "../components/ui";
import { useI18n } from "../lib/i18n";
import { space } from "../theme";

export default function NotFound() {
  const { t } = useI18n();
  return (
    <Page narrow>
      <Head>
        <title>{t.meta_notfound_title()}</title>
      </Head>
      <View style={{ gap: space.l }}>
        <Heading level={1} size="section">
          {t.notfound_title()}
        </Heading>
        <Body tone="soft">{t.notfound_body()}</Body>
        <AppLink href="/" variant="button">
          {t.notfound_home()}
        </AppLink>
      </View>
    </Page>
  );
}
