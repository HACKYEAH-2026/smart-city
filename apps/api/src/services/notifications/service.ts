import {
  type GeoPoint,
  type NavigateAction,
  type Notification,
  type NotificationAudience,
  type NotificationTone,
  type Notify,
  parseNotification,
} from "@app/plugin-sdk";
import { LOCATION_FRESH_MINUTES, NOTIFICATIONS_PAGE, type NotificationInbox } from "@app/shared";
import { GeometryPoint, type RecordId } from "surrealdb";
import { type Db, keyOf, ref, rows, toDate } from "../../db";

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

/**
 * Members of the community who match the audience, as a SurrealQL condition on `membership` (vars below).
 * `near` = a saved place or a fresh shared position within the radius; geo::distance is in metres.
 */
function audienceFilter(to: NotificationAudience): { where: string; vars: Record<string, unknown> } {
  if ("users" in to) return { where: "user IN $users", vars: { users: to.users.map((id) => ref("user", id)) } };
  if ("near" in to) {
    return {
      where: `user IN array::union(
        (SELECT VALUE user FROM place WHERE geo::distance(point, $point) <= $radius),
        (SELECT VALUE user FROM user_location
           WHERE at > time::now() - ${LOCATION_FRESH_MINUTES}m AND geo::distance(point, $point) <= $radius)
      )`,
      vars: { point: geoPoint(to.near), radius: to.near.radius },
    };
  }
  return { where: "true", vars: {} };
}

/**
 * Residents' notifications. Plugins send them with ctx.notify (fan-out on write: one row per recipient, all in
 * one statement); residents read them in their inbox (/api/me/notifications) across all their communities.
 */
export class NotificationService {
  constructor(private readonly db: Db) {}

  /** ctx.notify for one installation; `from` (the acting user, null = system) never notifies themselves. */
  forPlugin(args: {
    views: Record<string, unknown>;
    pluginId: string;
    installationId: string;
    communityId: string;
    from: string | null;
  }): Notify {
    return async (input) => {
      const notification = parseNotification(args.views, input);
      await this.send(args, notification);
    };
  }

  private async send(
    args: { pluginId: string; installationId: string; communityId: string; from: string | null },
    n: Notification,
  ): Promise<void> {
    const audience = audienceFilter(n.to);
    await this.db.query(
      `INSERT INTO notification (
         SELECT user, community, $installation AS installation, $plugin AS plugin, $title AS title, $body AS body,
                $tone AS tone, $open AS open
         FROM membership WHERE community = $community AND user != $from AND ${audience.where}
       ) RETURN NONE;`,
      {
        ...audience.vars,
        community: ref("community", args.communityId),
        installation: ref("installation", args.installationId),
        plugin: args.pluginId,
        from: args.from ? ref("user", args.from) : null,
        title: n.title,
        body: n.body,
        tone: n.tone,
        open: n.open,
      },
    );
  }

  /** The newest notifications of the user (enabled plugins only) and the unread count. */
  async inbox(userId: string): Promise<NotificationInbox> {
    const [items, unread] = await Promise.all([
      rows<NotificationRow>(
        this.db,
        `SELECT id, community.{ slug, name } AS community, plugin, title, body, tone, open, created_at,
                read_at IS NOT NONE AS read
           FROM notification WHERE user = $user AND installation.enabled
           ORDER BY created_at DESC LIMIT $limit;`,
        { user: ref("user", userId), limit: NOTIFICATIONS_PAGE },
      ),
      this.unread(userId),
    ]);
    return { items: items.map(toItem), unread };
  }

  /** Marks the user's notifications as read (the given ids, or all); others' ids are ignored. Returns unread. */
  async markRead(userId: string, ids?: string[]): Promise<number> {
    const only = ids ? "AND id IN $ids" : "";
    await this.db.query(
      `UPDATE notification SET read_at = time::now() WHERE user = $user AND read_at IS NONE ${only} RETURN NONE;`,
      { user: ref("user", userId), ids: ids?.map((id) => ref("notification", id)) },
    );
    return this.unread(userId);
  }

  private async unread(userId: string): Promise<number> {
    const [row] = await rows<{ count: number }>(
      this.db,
      `SELECT count() FROM notification
         WHERE user = $user AND read_at IS NONE AND installation.enabled GROUP ALL;`,
      { user: ref("user", userId) },
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
