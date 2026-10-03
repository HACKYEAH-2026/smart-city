import { Redirect, Stack } from "expo-router";
import { Screen, Text } from "../../src/components";
import { usePushNotifications } from "../../src/data/push";
import { useSession } from "../../src/data/session";
import { t } from "../../src/texts";
import { colors } from "../../src/theme";

/**
 * Everything under /app requires a session; signed in, the phone registers for pushes. Screens slide in from the
 * right, the bottom bar's sections fade, and the QR scanner rises from the bottom.
 */
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
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        // iOS only (Android keeps the system duration): a quicker slide than the 500 ms default.
        animationDuration: 250,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ animation: "fade" }} />
      <Stack.Screen name="account" options={{ animation: "fade" }} />
      <Stack.Screen name="scan" options={{ animation: "slide_from_bottom" }} />
    </Stack>
  );
}
