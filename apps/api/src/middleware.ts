import { createMiddleware } from "hono/factory";
import type { AppEnv } from "./context";

/** Requires a signed-in user; sets c.var.user. */
export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  const session = await c.var.auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "unauthorized" }, 401);
  c.set("user", session.user);
  await next();
});
