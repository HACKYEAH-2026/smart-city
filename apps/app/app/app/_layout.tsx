import { Redirect, Slot } from "expo-router";
import { Screen, Text } from "../../src/components";
import { useSession } from "../../src/data/session";
import { t } from "../../src/texts";

/** Everything under /app requires a session. */
export default function Guard() {
  const session = useSession();
  if (session.isPending)
    return (
      <Screen>
        <Text variant="bodyL" color="textSecondary">
          {t.loading}
        </Text>
      </Screen>
    );
  if (!session.data) return <Redirect href="/login" />;
  return <Slot />;
}
