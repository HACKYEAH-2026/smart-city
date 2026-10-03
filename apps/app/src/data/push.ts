import { useRouter } from "expo-router";
import { useEffect } from "react";
import { api } from "../lib/api";
import { onPushTap, pushToken, setupPush } from "../lib/push";
import { notificationHref } from "../plugins/href";

/**
 * Pushes on this phone: after sign-in the device registers its token with the API (the system asks for permission
 * once); a tapped push marks its notification as read and opens the plugin view it points to.
 */
const me = api.api.me;

async function registerDevice(): Promise<void> {
  await setupPush();
  const token = await pushToken({ ask: true });
  if (!token) return;
  const res = await me["push-tokens"].$post({ json: { token } });
  if (!res.ok) throw new Error(`push token not registered: HTTP ${res.status}`);
}

/** Mounted in the signed-in area (app/app/_layout.tsx). */
export function usePushNotifications(signedIn: boolean): void {
  const router = useRouter();
  useEffect(() => {
    if (!signedIn) return;
    registerDevice().catch((err: unknown) => console.warn("push: device not registered", err));
    return onPushTap((data) => {
      const target = notificationHref(data);
      if (!target) return;
      me.notifications.read.$post({ json: { ids: [target.notificationId] } }).catch(() => {});
      router.push(target.href as never);
    });
  }, [signedIn, router]);
}

/** On sign-out, while the session is still valid: this phone stops getting the user's pushes. */
export async function unregisterDevice(): Promise<void> {
  const token = await pushToken({ ask: false }).catch(() => null);
  if (token) await me["push-tokens"].$delete({ json: { token } });
}
