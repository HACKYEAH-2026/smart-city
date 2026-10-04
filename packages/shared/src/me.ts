import { geoPointSchema, type NavigateAction, type NotificationTone } from "@app/plugin-sdk";
import { z } from "zod";

/** Contracts of the signed-in user's own data (/api/me): notification inbox, saved places, shared location. */

/** A notification in the inbox (sent by a plugin with ctx.notify). `open` = plugin view to open on tap. */
export type NotificationItem = {
  id: string;
  community: { slug: string; name: string };
  pluginId: string;
  title: string;
  body: string;
  tone: NotificationTone;
  open: NavigateAction | null;
  /** ISO 8601. */
  createdAt: string;
  read: boolean;
};
/** The newest notifications (at most NOTIFICATIONS_PAGE) and how many of all are unread. */
export type NotificationInbox = { items: NotificationItem[]; unread: number };
export const NOTIFICATIONS_PAGE = 50;

/** Marks the given notifications as read; without `ids` — all of them. */
export const notificationsReadSchema = z.object({ ids: z.array(z.string().min(1)).max(100).optional() });

/**
 * A saved place ("Moje miejsca"; in the account: addresses for nearby notifications); "near" notifications reach the
 * user there. `address` = the postal address picked on the map ("" = none).
 */
export const PLACES_MAX = 10;
export const placeCreateSchema = geoPointSchema.extend({
  label: z.string().trim().min(1).max(40),
  address: z.string().trim().max(200).default(""),
});
export type PlaceCreate = z.input<typeof placeCreateSchema>;
export type Place = { id: string; label: string; address: string; lat: number; lng: number };

/** The current position, shared while the app is open; counts for "near" for LOCATION_FRESH_MINUTES. */
export const locationSchema = geoPointSchema;
export const LOCATION_FRESH_MINUTES = 30;

/** The device's Expo push token (expo-notifications `getExpoPushTokenAsync`); registered after sign-in. */
export const pushTokenSchema = z.object({ token: z.string().regex(/^Expo(nent)?PushToken\[[^\]\s]{1,200}\]$/) });

/** `data` of a push notification: what the app opens (and marks as read) when the user taps it. */
export type PushData = {
  notificationId: string;
  /** Community slug. */
  community: string;
  pluginId: string;
  open: NavigateAction | null;
};
