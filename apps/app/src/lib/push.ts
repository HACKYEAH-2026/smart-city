import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { t } from "../texts";

/**
 * Push notifications on the phone (expo-notifications). The Expo push token identifies this device; the API sends
 * pushes to it through the Expo Push Service. The web build uses push.web.ts (no pushes).
 */

/** The Expo project pushes belong to (EXPO_PROJECT_ID → app.config.ts `extra.eas.projectId`). */
const projectId = (): string | undefined => Constants.expoConfig?.extra?.eas?.projectId;

/** Pushes show while the app is open too; Android channels: "alerts" (warnings, alarms) and "default". */
export async function setupPush(): Promise<void> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  // No-ops on iOS.
  await Notifications.setNotificationChannelAsync("alerts", {
    name: t.push_channel_alerts,
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 400, 200, 400],
  });
  await Notifications.setNotificationChannelAsync("default", {
    name: t.push_channel_default,
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

async function permitted(ask: boolean): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || !ask || !current.canAskAgain) return current.granted;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/**
 * This device's Expo push token; `ask` shows the system permission prompt if needed. null = no permission or
 * no Expo project configured. Throws when the platform cannot issue a token (e.g. Android without Firebase).
 */
export async function pushToken({ ask }: { ask: boolean }): Promise<string | null> {
  const id = projectId();
  if (!id || !(await permitted(ask))) return null;
  return (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
}

/** Calls `open` with the `data` of each tapped push, including the one that launched the app. Returns unsubscribe. */
export function onPushTap(open: (data: unknown) => void): () => void {
  const handle = (response: Notifications.NotificationResponse) => {
    Notifications.clearLastNotificationResponse();
    open(response.notification.request.content.data);
  };
  const launched = Notifications.getLastNotificationResponse();
  if (launched) handle(launched);
  const subscription = Notifications.addNotificationResponseReceivedListener(handle);
  return () => subscription.remove();
}
