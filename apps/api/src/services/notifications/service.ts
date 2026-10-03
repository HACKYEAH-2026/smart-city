import {
  type GeoPoint,
  type NavigateAction,
  type Notification,
  type NotificationAudience,
  type NotificationTone,
  type Notify,
  type PluginCommunity,
  parseNotification,
} from "@app/plugin-sdk";
import { LOCATION_FRESH_MINUTES, NOTIFICATIONS_PAGE, type NotificationInbox } from "@app/shared";
import { type BoundQuery, Duration, GeometryPoint, type RecordId, surql } from "surrealdb";
import { type Db, keyOf, ref, rows, toDate } from "../../db";
import type { PushMessage, PushSender } from "../push/types";

type NotificationRow = {
  id: RecordId;
  community: { slug: string; name: string };
  plugin: string;
  title: string;
  body: string;
  tone: NotificationTone;
  open?: NavigateAction;
  created_at: Date | { toDate(): Date };
  read: boolean;
};

/** A point for SurrealDB (GeoJSON order: longitude, latitude). */
export const geoPoint = ({ lat, lng }: GeoPoint) => new GeometryPoint([lng, lat]);

/** Location updates older than this do not count as "the user is here". */
const LOCATION_FRESH = new Duration(`${LOCATION_FRESH_MINUTES}m`);

/**
 * Members of the community who match the audience, as a SurrealQL condition on `membership`.
 * `near` = a saved place or a fresh shared position within the radius; geo::distance is in metres.
 */
function audienceFilter(to: NotificationAudience): BoundQuery {
  if ("users" in to) return surql`user IN ${to.users.map((id) => ref("user", id))}`;
  if ("near" in to) {
    const [point, radius] = [geoPoint(to.near), to.near.radius];
    return surql`user IN array::union(
      (SELECT VALUE user FROM place WHERE geo::distance(point, ${point}) <= ${radius}),
      (SELECT VALUE user FROM user_location
         WHERE at > time::now() - ${LOCATION_FRESH} AND geo::distance(point, ${point}) <= ${radius})
    )`;
  }
  return surql`true`;
}

type Sender = { pluginId: string; installationId: string; community: PluginCommunity; from: string | null };
type Delivered = { id: RecordId; user: RecordId };
type Device = { token: RecordId; user: RecordId };

/** Warnings and alarms wake the phone (high priority, the "alerts" channel); the rest is a normal notification. */
const URGENT: readonly NotificationTone[] = ["warning", "danger"];

/** One push per device of each recipient; `data` lets the app open the notification on tap. */
function pushMessages(sender: Sender, n: Notification, delivered: Delivered[], devices: Device[]): PushMessage[] {
  const urgent = URGENT.includes(n.tone);
  return devices.flatMap((device) => {
    const notification = delivered.find((d) => keyOf(d.user) === keyOf(device.user));
    if (!notification) return [];
    return [
      {
        to: keyOf(device.token),
        title: n.title,
        body: n.body,
        data: {
          notificationId: keyOf(notification.id),
          community: sender.community.slug,
          pluginId: sender.pluginId,
          open: n.open ?? null,
        },
        sound: "default",
        priority: urgent ? "high" : "default",
        channelId: urgent ? "alerts" : "default",
      },
    ];
  });
}

/**
 * Residents' notifications. Plugins send them with ctx.notify (fan-out on write: one row per recipient, all in
 * one statement); residents read them in their inbox (/api/me/notifications) across all their communities, and
 * every registered phone of a recipient gets a push. Pushes go out in the background: a slow or failing push
 * service never fails the plugin call (the notification is already in the inbox).
 */
export class NotificationService {
  private readonly inFlight = new Set<Promise<void>>();

  constructor(
    private readonly db: Db,
    private readonly push: PushSender,
  ) {}

  /** ctx.notify for one installation; `from` (the acting user, null = system) never notifies themselves. */
  forPlugin(args: Sender & { views: Record<string, unknown> }): Notify {
    return async (input) => {
      const notification = parseNotification(args.views, input);
      const delivered = await this.store(args, notification);
      const devices = await this.devicesOf(delivered.map((d) => d.user));
      this.deliver(pushMessages(args, notification, delivered, devices));
    };
  }

  /** Waits for pushes still being sent (tests; graceful shutdown). */
  async drain(): Promise<void> {
    await Promise.all(this.inFlight);
  }

  private store(sender: Sender, n: Notification): Promise<Delivered[]> {
    const installation = ref("installation", sender.installationId);
    const community = ref("community", sender.community.id);
    const from = sender.from ? ref("user", sender.from) : null;
    return rows<Delivered>(
      this.db,
      surql`INSERT INTO notification (
         SELECT user, community, ${installation} AS installation, ${sender.pluginId} AS plugin, ${n.title} AS title,
                ${n.body} AS body, ${n.tone} AS tone, ${n.open} AS open
         FROM membership WHERE community = ${community} AND user != ${from} AND ${audienceFilter(n.to)}
       ) RETURN id, user;`,
    );
  }

  private devicesOf(users: RecordId[]): Promise<Device[]> {
    if (!users.length) return Promise.resolve([]);
    return rows<Device>(this.db, surql`SELECT id AS token, user FROM push_token WHERE user IN ${users};`);
  }

  private deliver(messages: PushMessage[]): void {
    if (!messages.length) return;
    const sending = this.push
      .send(messages)
      .then(({ invalidTokens }) => this.forget(invalidTokens))
      .catch((err: unknown) => console.error(`push: ${messages.length} message(s) not sent`, err))
      .finally(() => this.inFlight.delete(sending));
    this.inFlight.add(sending);
  }

  /** Devices the push service reports as gone (app uninstalled). */
  private async forget(tokens: string[]): Promise<void> {
    if (!tokens.length) return;
    await this.db.query(surql`DELETE ${tokens.map((t) => ref("pushToken", t))} RETURN NONE;`);
  }

  /** The newest notifications of the user (enabled plugins only) and the unread count. */
  async inbox(userId: string): Promise<NotificationInbox> {
    const [items, unread] = await Promise.all([
      rows<NotificationRow>(
        this.db,
        surql`SELECT id, community.{ slug, name } AS community, plugin, title, body, tone, open, created_at,
                read_at IS NOT NONE AS read
           FROM notification WHERE user = ${ref("user", userId)} AND installation.enabled
           ORDER BY created_at DESC LIMIT ${NOTIFICATIONS_PAGE};`,
      ),
      this.unread(userId),
    ]);
    return { items: items.map(toItem), unread };
  }

  /** Marks the user's notifications as read (the given ids, or all); others' ids are ignored. Returns unread. */
  async markRead(userId: string, ids?: string[]): Promise<number> {
    const only = ids ? surql`AND id IN ${ids.map((id) => ref("notification", id))}` : surql``;
    await this.db.query(
      surql`UPDATE notification SET read_at = time::now() WHERE user = ${ref("user", userId)} AND read_at IS NONE ${only} RETURN NONE;`,
    );
    return this.unread(userId);
  }

  private async unread(userId: string): Promise<number> {
    const [row] = await rows<{ count: number }>(
      this.db,
      surql`SELECT count() FROM notification
         WHERE user = ${ref("user", userId)} AND read_at IS NONE AND installation.enabled GROUP ALL;`,
    );
    return row?.count ?? 0;
  }
}

const toItem = (row: NotificationRow) => ({
  id: keyOf(row.id),
  community: { slug: row.community.slug, name: row.community.name },
  pluginId: row.plugin,
  title: row.title,
  body: row.body,
  tone: row.tone,
  open: row.open ?? null,
  createdAt: toDate(row.created_at).toISOString(),
  read: row.read,
});
