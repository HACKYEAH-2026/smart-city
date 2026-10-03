import { timingSafeEqual } from "node:crypto";
import { schema } from "@app/db";
import { communityCreateSchema, pluginInstallSchema, pluginUploadSchema } from "@app/shared";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../context";
import { PluginError } from "../plugins/host";

/**
 * API administracyjne (wgrywanie wtyczek, społeczności, instalacje). Chronione tokenem
 * PLUGIN_ADMIN_TOKEN (nagłówek Authorization: Bearer ...). Bez tokenu w env — całość zwraca 404.
 * Wgrana wtyczka wykonuje się w procesie API, więc token = pełne zaufanie (docs/plugins.md).
 */
const { communities, pluginInstallations } = schema;

const sameToken = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export function createAdminRoutes(token: string | undefined) {
  const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
    if (!token) return c.json({ error: "not_found" }, 404);
    const given = c.req.header("authorization")?.replace(/^Bearer /, "") ?? "";
    if (!sameToken(given, token)) return c.json({ error: "unauthorized" }, 401);
    await next();
  });

  return new Hono<AppEnv>()
    .use(requireAdmin)
    .get("/plugins", async (c) => {
      await c.var.plugins.ready();
      return c.json(c.var.plugins.list().map((p) => ({ ...p.manifest, origin: p.origin })));
    })
    .post("/plugins", zValidator("json", pluginUploadSchema), async (c) => {
      try {
        const manifest = await c.var.plugins.upload(c.req.valid("json").source);
        return c.json(manifest, 201);
      } catch (err) {
        if (err instanceof PluginError) return c.json({ error: "invalid_plugin", message: err.message }, 400);
        throw err;
      }
    })
    .post("/communities", zValidator("json", communityCreateSchema), async (c) => {
      const [row] = await c.var.db.insert(communities).values(c.req.valid("json")).onConflictDoNothing().returning();
      if (!row) return c.json({ error: "slug_taken" }, 409);
      return c.json({ id: row.id, slug: row.slug, name: row.name }, 201);
    })
    .post("/communities/:slug/plugins", zValidator("json", pluginInstallSchema), async (c) => {
      await c.var.plugins.ready();
      const { pluginId } = c.req.valid("json");
      if (!c.var.plugins.get(pluginId)) return c.json({ error: "unknown_plugin" }, 400);
      const [community] = await c.var.db
        .select()
        .from(communities)
        .where(eq(communities.slug, c.req.param("slug")));
      if (!community) return c.json({ error: "not_found" }, 404);
      await c.var.db
        .insert(pluginInstallations)
        .values({ communityId: community.id, pluginId })
        .onConflictDoUpdate({
          target: [pluginInstallations.communityId, pluginInstallations.pluginId],
          set: { enabled: true, updatedAt: new Date() },
        });
      return c.json({ ok: true }, 201);
    });
}
