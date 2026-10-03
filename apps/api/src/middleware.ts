import { createMiddleware } from "hono/factory";
import type { AppEnv } from "./context";
import { type CommunityRow, communityBySlug, keyOf, memberRole } from "./db";

/** Requires a signed-in user; sets c.var.user. */
export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  const session = await c.var.auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "unauthorized" }, 401);
  c.set("user", session.user);
  await next();
});

/**
 * Requires the signed-in user (after requireUser) to be an admin of the place `:slug`; sets c.var.place.
 * A non-member (or no such place) gets 404 as on every route of a place, a member who is not an admin 403
 * with `message`.
 */
export const requirePlaceAdmin = (message: string) =>
  createMiddleware<AppEnv & { Variables: { place: CommunityRow } }>(async (c, next) => {
    const place = await communityBySlug(c.var.db, c.req.param("slug") ?? "");
    const role = place ? await memberRole(c.var.db, keyOf(place.id), c.var.user.id) : null;
    if (!place || !role) return c.json({ error: "not_found" }, 404);
    if (role !== "admin") return c.json({ error: "forbidden", message }, 403);
    c.set("place", place);
    await next();
  });
