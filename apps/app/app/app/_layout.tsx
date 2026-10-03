import { Redirect, Slot } from "expo-router";
import { Body, Page } from "../../src/components/ui";
import { useSession } from "../../src/data/session";
import { useI18n } from "../../src/lib/i18n";

/** Wszystko pod /app wymaga sesji. */
export default function Guard() {
  const { t } = useI18n();
  const session = useSession();
  if (session.isPending)
    return (
      <Page narrow>
        <Body tone="soft">{t.loading()}</Body>
      </Page>
    );
  if (!session.data) return <Redirect href="/login" />;
  return <Slot />;
}
