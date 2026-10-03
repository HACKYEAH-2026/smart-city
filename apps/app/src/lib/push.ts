import { isRunningInExpoGo } from "expo";
import Constants from "expo-constants";
import type { NotificationResponse } from "expo-notifications";
import { Platform } from "react-native";
import { t } from "../texts";

/**
 * Push notifications on the phone (expo-notifications). The Expo push token identifies this device; the API sends
 * pushes to it through the Expo Push Service. The web build uses push.web.ts (no pushes).
 */

type Notifications = typeof import("expo-notifications");

/**
 * expo-notifications, or null in Expo Go on Android: there it throws on import (no remote pushes since SDK 53), so it
 * is loaded lazily and the app still runs in Expo Go, without pushes. Pushes on Android: the dev build (android:debug).
 */
const notifications = (): Promise<Notifications | null> =>
  Platform.OS === "android" && isRunningInExpoGo() ? Promise.resolve(null) : import("expo-notifications");

/** The Expo project pushes belong to (EXPO_PROJECT_ID → app.config.ts `extra.eas.projectId`). */
const projectId = (): string | undefined => Constants.expoConfig?.extra?.eas?.projectId;

/** Pushes show while the app is open too; Android channels: "alerts" (warnings, alarms) and "default". */
export async function setupPush(): Promise<void> {
  const n = await notifications();
  if (!n) return;
  n.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  // No-ops on iOS.
  await n.setNotificationChannelAsync("alerts", {
    name: t.push_channel_alerts,
    importance: n.AndroidImportance.MAX,
    vibrationPattern: [0, 400, 200, 400],
  });
  await n.setNotificationChannelAsync("default", {
    name: t.push_channel_default,
    importance: n.AndroidImportance.DEFAULT,
  });
}

async function permitted(n: Notifications, ask: boolean): Promise<boolean> {
  const current = await n.getPermissionsAsync();
  if (current.granted || !ask || !current.canAskAgain) return current.granted;
  return (await n.requestPermissionsAsync()).granted;
}

/**
 * This device's Expo push token; `ask` shows the system permission prompt if needed. null = no permission, no Expo
 * project configured or Expo Go on Android. Throws when the platform cannot issue a token (e.g. Android without
 * Firebase).
 */
export async function pushToken({ ask }: { ask: boolean }): Promise<string | null> {
  const id = projectId();
  const n = await notifications();
  if (!n || !id || !(await permitted(n, ask))) return null;
  return (await n.getExpoPushTokenAsync({ projectId: id })).data;
}

function listenForTaps(n: Notifications, open: (data: unknown) => void): { remove(): void } {
  const handle = (response: NotificationResponse) => {
    n.clearLastNotificationResponse();
    open(response.notification.request.content.data);
  };
  const launched = n.getLastNotificationResponse();
  if (launched) handle(launched);
  return n.addNotificationResponseReceivedListener(handle);
}

/** Calls `open` with the `data` of each tapped push, including the one that launched the app. Returns unsubscribe. */
export function onPushTap(open: (data: unknown) => void): () => void {
  const subscription = notifications().then((n) => n && listenForTaps(n, open));
  return () => {
    subscription.then((s) => s?.remove());
  };
}
