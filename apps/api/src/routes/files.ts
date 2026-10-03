import { Hono } from "hono";
import type { AppEnv } from "../context";

/**
 * Serves plugin files via a signed URL (exp + sig) that the host attaches to Image nodes.
 * No Authorization header, so it works in <Image> on native and web; the URL expires after an hour.
 */
export const filesRoutes = new Hono<AppEnv>().get("/:id", async (c) => {
  const file = await c.var.files.serve(c.req.param("id"), c.req.query("exp") ?? "", c.req.query("sig") ?? "");
  if (!file) return c.json({ error: "not_found" }, 404);
  return c.body(file.data.buffer as ArrayBuffer, 200, {
    "content-type": file.mime,
    "cache-control": "private, max-age=3600",
  });
});
