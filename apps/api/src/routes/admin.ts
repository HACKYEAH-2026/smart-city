import { timingSafeEqual } from "node:crypto";
import { PluginCheckError } from "@app/plugin-sdk";
import { adminGrantSchema, communityCreateSchema, pluginInstallSchema, pluginUploadSchema } from "@app/shared";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import type { RecordId } from "surrealdb";
import type { AppEnv } from "../context";
import { type CommunityRow, communityBySlug, first, keyOf, membershipRef, ref, toCommunity } from "../db";

/**
 * Admin API (plugin uploads, communities, installations). Protected by the PLUGIN_ADMIN_TOKEN
 * token (Authorization: Bearer ... header). Without the token in env — everything returns 404.
 * An uploaded plugin runs in the API process, so token = full trust (docs/plugins.md).
 */
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
          if (!(err instanceof PluginCheckError)) throw err;
          return c.json({ error: "invalid_plugin", message: err.message, stage: err.stage, errors: err.errors }, 400);
        }
      })
      /** Checks source like an upload, storing nothing: always 200 with { status: "ok" | "error", ... }. */
      .post("/plugins/check", zValidator("json", pluginUploadSchema), async (c) => {
        return c.json(await c.var.plugins.check(c.req.valid("json").source));
      })
      .post("/communities", zValidator("json", communityCreateSchema), async (c) => {
        const row = await first<CommunityRow>(c.var.db, "INSERT IGNORE INTO community $data RETURN id, slug, name;", {
          data: c.req.valid("json"),
        });
        if (!row) return c.json({ error: "slug_taken" }, 409);
        return c.json(toCommunity(row), 201);
      })
      .post("/communities/:slug/plugins", zValidator("json", pluginInstallSchema), async (c) => {
        await c.var.plugins.ready();
        const plugin = c.var.plugins.get(c.req.valid("json").pluginId);
        if (!plugin) return c.json({ error: "unknown_plugin" }, 400);
        const community = await communityBySlug(c.var.db, c.req.param("slug"));
        if (!community) return c.json({ error: "not_found" }, 404);
        await c.var.plugins.enable(plugin, toCommunity(community));
        return c.json({ ok: true }, 201);
      })
      /** Grants the community admin role to the user with the given email (must have an account). */
      .post("/communities/:slug/admins", zValidator("json", adminGrantSchema), async (c) => {
        const community = await communityBySlug(c.var.db, c.req.param("slug"));
        if (!community) return c.json({ error: "not_found" }, 404);
        const account = await first<{ id: RecordId }>(c.var.db, "SELECT id FROM user WHERE email = $email;", {
          email: c.req.valid("json").email,
        });
        if (!account) return c.json({ error: "unknown_user" }, 400);
        const [communityId, userId] = [keyOf(community.id), keyOf(account.id)];
        await c.var.db.query('UPSERT $m MERGE { community: $c, user: $u, role: "admin" };', {
          m: membershipRef(communityId, userId),
          c: ref("community", communityId),
          u: ref("user", userId),
        });
        return c.json({ ok: true }, 201);
      })
  );
}
