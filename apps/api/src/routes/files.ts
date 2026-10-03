import { Hono } from "hono";
import type { AppEnv } from "../context";

/**
 * Pobieranie plików wtyczek przez podpisany URL (exp + sig), który host dokleja do węzłów Image.
 * Bez nagłówka Authorization, żeby działało w <Image> natywnie i na webie; URL wygasa po godzinie.
 */
export const filesRoutes = new Hono<AppEnv>().get("/:id", async (c) => {
  const file = await c.var.files.serve(c.req.param("id"), c.req.query("exp") ?? "", c.req.query("sig") ?? "");
  if (!file) return c.json({ error: "not_found" }, 404);
  return c.body(file.data.buffer as ArrayBuffer, 200, {
    "content-type": file.mime,
    "cache-control": "private, max-age=3600",
  });
});
