import {
  locationSchema,
  notificationsReadSchema,
  PLACES_MAX,
  type Place,
  placeCreateSchema,
  pushTokenSchema,
} from "@app/shared";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { type GeometryPoint, type RecordId, surql } from "surrealdb";
import type { AppEnv } from "../context";
import { first, geoPoint, keyOf, ref, rows } from "../db";
import { requireUser } from "../middleware";

type PlaceRow = { id: RecordId; label: string; address?: string; point: GeometryPoint };

const toPlace = (row: PlaceRow): Place => {
  const [lng, lat] = row.point.coordinates;
  return { id: keyOf(row.id), label: row.label, address: row.address ?? "", lat, lng };
};

/**
 * The signed-in user's own data: the notification inbox (ctx.notify), phones that get pushes, saved places and
 * the shared current position. Places and the position are private: nothing here is visible to plugins or to other users;
 * the host only matches them against "near" notifications.
 */
export const meRoutes = new Hono<AppEnv>()
  .use(requireUser)
  .get("/notifications", async (c) => c.json(await c.var.notifications.inbox(c.var.user.id), 200))
  .post("/notifications/read", zValidator("json", notificationsReadSchema), async (c) => {
    const unread = await c.var.notifications.markRead(c.var.user.id, c.req.valid("json").ids);
    return c.json({ unread }, 200);
  })
  /** This phone gets pushes for the signed-in user (a token moves to whoever registered it last). */
  .post("/push-tokens", zValidator("json", pushTokenSchema), async (c) => {
    await c.var.db.query(
      surql`UPSERT ${ref("pushToken", c.req.valid("json").token)}
            SET user = ${ref("user", c.var.user.id)}, updated_at = time::now() RETURN NONE;`,
    );
    return c.body(null, 204);
  })
  /** Sign-out on this phone: stop pushes (only the user's own token is removed). */
  .delete("/push-tokens", zValidator("json", pushTokenSchema), async (c) => {
    await c.var.db.query(
      surql`DELETE ${ref("pushToken", c.req.valid("json").token)} WHERE user = ${ref("user", c.var.user.id)} RETURN NONE;`,
    );
    return c.body(null, 204);
  })
  .get("/places", async (c) => {
    const places = await rows<PlaceRow>(
      c.var.db,
      surql`SELECT id, label, address, point, created_at FROM place WHERE user = ${ref("user", c.var.user.id)} ORDER BY created_at;`,
    );
    return c.json(places.map(toPlace), 200);
  })
  .post("/places", zValidator("json", placeCreateSchema), async (c) => {
    const { label, address, ...point } = c.req.valid("json");
    const user = ref("user", c.var.user.id);
    const count = await first<{ count: number }>(
      c.var.db,
      surql`SELECT count() FROM place WHERE user = ${user} GROUP ALL;`,
    );
    if ((count?.count ?? 0) >= PLACES_MAX) return c.json({ error: "too_many_places" }, 400);
    const row = await first<PlaceRow>(
      c.var.db,
      surql`CREATE place CONTENT ${{ user, label, address, point: geoPoint(point) }} RETURN id, label, address, point;`,
    );
    if (!row) throw new Error("place not created");
    return c.json(toPlace(row), 201);
  })
  .delete("/places/:id", async (c) => {
    const deleted = await rows<PlaceRow>(
      c.var.db,
      surql`DELETE ${ref("place", c.req.param("id"))} WHERE user = ${ref("user", c.var.user.id)} RETURN BEFORE;`,
    );
    return deleted.length ? c.body(null, 204) : c.json({ error: "not_found" }, 404);
  })
  /** The position while the app is open (one per user); "near" uses it for LOCATION_FRESH_MINUTES. */
  .put("/location", zValidator("json", locationSchema), async (c) => {
    await c.var.db.query(
      surql`UPSERT ${ref("location", c.var.user.id)}
            SET user = ${ref("user", c.var.user.id)}, point = ${geoPoint(c.req.valid("json"))}, at = time::now()
            RETURN NONE;`,
    );
    return c.body(null, 204);
  })
  .delete("/location", async (c) => {
    await c.var.db.query(surql`DELETE ${ref("location", c.var.user.id)} RETURN NONE;`);
    return c.body(null, 204);
  });
