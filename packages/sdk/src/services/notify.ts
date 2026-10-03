import { z } from "zod";
import { geoPointSchema } from "../geo";
import { navigateActionSchema } from "../ui";

/** Largest radius of a "near" notification, in metres (a whole city fits; a whole region does not). */
export const NOTIFY_RADIUS_MAX = 50_000;

export const NOTIFICATION_TONES = ["info", "success", "warning", "danger"] as const;
export type NotificationTone = (typeof NOTIFICATION_TONES)[number];

/**
 * Who gets a notification. Recipients are always members of the current community, and never the user who
 * triggered it. `near` matches residents' saved places and recently shared positions: the host does the
 * matching, so the plugin never learns where anyone lives or is.
 */
export const notificationAudienceSchema = z.union([
  z.strictObject({ users: z.array(z.string().min(1)).min(1).max(1000) }),
  z.strictObject({ near: geoPointSchema.extend({ radius: z.number().positive().max(NOTIFY_RADIUS_MAX) }) }),
  z.strictObject({ everyone: z.literal(true) }),
]);
export type NotificationAudience = z.infer<typeof notificationAudienceSchema>;

export const notificationSchema = z.object({
  to: notificationAudienceSchema,
  /** Polish, shown to residents. */
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().max(500).default(""),
  tone: z.enum(NOTIFICATION_TONES).default("info"),
  /** View of this plugin the app opens when the resident taps the notification (`ui.navigate(view, params)`). */
  open: navigateActionSchema.optional(),
});
export type NotificationInput = z.input<typeof notificationSchema>;
export type Notification = z.output<typeof notificationSchema>;

/**
 * `ctx.notify` ("notify" permission): sends a notification to residents' inboxes. Resolves once it is stored;
 * returns nothing about the recipients (not even how many), so it cannot be used to locate residents.
 */
export type Notify = (notification: NotificationInput) => Promise<void>;

/**
 * Validates a `ctx.notify` call like the host does (used by the host and the test harness). Invalid input is a
 * plugin bug: it throws, and the tool fails.
 */
export function parseNotification(views: Record<string, unknown>, input: unknown): Notification {
  const notification = notificationSchema.parse(input);
  const view = notification.open?.view;
  if (view !== undefined && typeof views[view] !== "function") throw new Error(`ctx.notify: unknown view "${view}"`);
  return notification;
}
