import { timingSafeEqual } from "node:crypto";
import { adminGrantSchema, communityCreateSchema, pluginInstallSchema, pluginUploadSchema } from "@app/shared";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../context";
import { schema } from "../db";
import { PluginError } from "../plugins/host";

/**
 * Admin API (plugin uploads, communities, installations). Protected by the PLUGIN_ADMIN_TOKEN
 * token (Authorization: Bearer ... header). Without the token in env — everything returns 404.
 * An uploaded plugin runs in the API process, so token = full trust (docs/plugins.md).
 */
const { communities, memberships, pluginInstallations, user } = schema;

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

  return (
    new Hono<AppEnv>()
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
        const [created] = await c.var.db
          .insert(pluginInstallations)
          .values({ communityId: community.id, pluginId })
          .onConflictDoNothing()
          .returning();
        if (created) {
          const plugin = c.var.plugins.get(pluginId);
          if (plugin) {
            await c.var.plugins.install(plugin, created.id, {
              id: community.id,
              slug: community.slug,
              name: community.name,
            });
          }
        } else {
          await c.var.db
            .update(pluginInstallations)
            .set({ enabled: true })
            .where(and(eq(pluginInstallations.communityId, community.id), eq(pluginInstallations.pluginId, pluginId)));
        }
        return c.json({ ok: true }, 201);
      })
      /** Grants the community admin role to the user with the given email (must have an account). */
      .post("/communities/:slug/admins", zValidator("json", adminGrantSchema), async (c) => {
        const [community] = await c.var.db
          .select()
          .from(communities)
          .where(eq(communities.slug, c.req.param("slug")));
        if (!community) return c.json({ error: "not_found" }, 404);
        const [account] = await c.var.db
          .select({ id: user.id })
          .from(user)
          .where(eq(user.email, c.req.valid("json").email));
        if (!account) return c.json({ error: "unknown_user" }, 400);
        await c.var.db
          .insert(memberships)
          .values({ communityId: community.id, userId: account.id, role: "admin" })
          .onConflictDoUpdate({
            target: [memberships.communityId, memberships.userId],
            set: { role: "admin", updatedAt: new Date() },
          });
        return c.json({ ok: true }, 201);
      })
  );
}
