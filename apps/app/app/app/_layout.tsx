import { Redirect, Slot } from "expo-router";
import { Screen, Text } from "../../src/components";
import { usePushNotifications } from "../../src/data/push";
import { useSession } from "../../src/data/session";
import { t } from "../../src/texts";

/** Everything under /app requires a session; signed in, the phone registers for pushes. */
export default function Guard() {
  const session = useSession();
  usePushNotifications(Boolean(session.data));
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
