import { createMiddleware } from "hono/factory";
import type { SessionUser } from "./auth";
import type { AppEnv } from "./context";
import { type CommunityRow, communityBySlug, keyOf, memberRole } from "./db";
import { logger, withLogFields } from "./log";

const http = logger("http");

/**
 * One line per request: method, path (no query: signed file URLs carry their signature there), status, time and the
 * signed-in user; warn for 5xx, debug for /health (probes). Every line logged while the request is handled, and by
 * work it starts in the background, carries its id `req`, also sent back as X-Request-Id.
 */
export const requestLog = createMiddleware<AppEnv>(async (c, next) => {
  const req = crypto.randomUUID().slice(0, 8);
  const started = performance.now();
  await withLogFields({ req }, next);
  c.header("X-Request-Id", req);
  const { status } = c.res;
  const user = c.get("user") as SessionUser | undefined;
  const level = c.req.path === "/health" ? "debug" : status >= 500 ? "warn" : "info";
  http[level](`${c.req.method} ${c.req.path} ${status}`, {
    ms: Math.round(performance.now() - started),
    ...(user ? { user: user.id } : {}),
  });
});

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
