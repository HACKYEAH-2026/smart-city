import Head from "expo-router/head";
import { Body, Heading, Page } from "../components/ui";
import { useI18n } from "../lib/i18n";
import { space } from "../theme";

export default function About() {
  const { t } = useI18n();
  return (
    <Page narrow>
      <Head>
        <title>{t.meta_about_title()}</title>
        <meta name="description" content={t.site_description()} />
      </Head>
      <Heading level={1} style={{ marginBottom: space.l }}>
        {t.about_title()}
      </Heading>
      <Body size="lead" style={{ marginBottom: space.l }}>
        {t.site_description()}
      </Body>
      <Body>{t.about_body()}</Body>
    </Page>
  );
}
