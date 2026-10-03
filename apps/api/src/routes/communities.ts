import { viewParamsSchema } from "@app/plugin-sdk";
import { type Community, type CommunityNavItem, toolCallSchema } from "@app/shared";
import { zValidator } from "@hono/zod-validator";
import { and, asc, eq } from "drizzle-orm";
import { type Context, Hono } from "hono";
import type { AppEnv } from "../context";
import { schema } from "../db";
import { requireUser } from "../middleware";
import { createPluginContext } from "../plugins/context";
import { PluginError, PluginInputError } from "../plugins/host";

/**
 * Społeczności i ich wtyczki (dla aplikacji). Widok i narzędzie wtyczki są dostępne tylko,
 * gdy wtyczka jest zainstalowana i włączona w danej społeczności; inaczej 404.
 */
const { communities, pluginInstallations } = schema;

const toCommunity = (row: typeof communities.$inferSelect): Community => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
});

export const communitiesRoutes = new Hono<AppEnv>()
  .use(requireUser)
  .use(async (c, next) => {
    await c.var.plugins.ready();
    await next();
  })
  .get("/", async (c) => {
    const rows = await c.var.db.select().from(communities).orderBy(asc(communities.name));
    return c.json(rows.map(toCommunity));
  })
  .get("/:slug", async (c) => {
    const [row] = await c.var.db
      .select()
      .from(communities)
      .where(eq(communities.slug, c.req.param("slug")));
    if (!row) return c.json({ error: "not_found" }, 404);
    return c.json(toCommunity(row), 200);
  })
  .get("/:slug/nav", async (c) => {
    const rows = await c.var.db
      .select({ pluginId: pluginInstallations.pluginId })
      .from(pluginInstallations)
      .innerJoin(communities, eq(communities.id, pluginInstallations.communityId))
      .where(and(eq(communities.slug, c.req.param("slug")), eq(pluginInstallations.enabled, true)))
      .orderBy(asc(pluginInstallations.createdAt));
    const nav: CommunityNavItem[] = rows.flatMap(({ pluginId }) => {
      const plugin = c.var.plugins.get(pluginId);
      if (!plugin) return [];
      return plugin.manifest.nav.map((n) => ({ pluginId, icon: plugin.manifest.icon, view: n.view, label: n.label }));
    });
    return c.json(nav);
  })
  .get("/:slug/plugins/:pluginId/views/:view", zValidator("query", viewParamsSchema), async (c) => {
    const target = await resolve(c, c.req.param("slug"), c.req.param("pluginId"));
    if (!target) return c.json({ error: "not_found" }, 404);
    const view = c.req.param("view");
    if (typeof target.plugin.definition.views[view] !== "function") return c.json({ error: "not_found" }, 404);
    try {
      const node = await c.var.plugins.renderView(target.plugin, view, target.ctx, c.req.valid("query"));
      return c.json(node, 200);
    } catch (err) {
      return pluginFailure(c, err);
    }
  })
  .post("/:slug/plugins/:pluginId/tools/:tool", zValidator("json", toolCallSchema), async (c) => {
    const target = await resolve(c, c.req.param("slug"), c.req.param("pluginId"));
    if (!target) return c.json({ error: "not_found" }, 404);
    const tool = c.req.param("tool");
    if (!target.plugin.definition.tools?.[tool]) return c.json({ error: "not_found" }, 404);
    try {
      const result = await c.var.plugins.callTool(target.plugin, tool, target.ctx, c.req.valid("json").args);
      return c.json(result, 200);
    } catch (err) {
      return pluginFailure(c, err);
    }
  });

/** Społeczność + włączona instalacja + załadowana wtyczka, albo null (→ 404). */
async function resolve(c: Context<AppEnv>, slug: string, pluginId: string) {
  const [row] = await c.var.db
    .select({ community: communities, installationId: pluginInstallations.id })
    .from(pluginInstallations)
    .innerJoin(communities, eq(communities.id, pluginInstallations.communityId))
    .where(
      and(
        eq(communities.slug, slug),
        eq(pluginInstallations.pluginId, pluginId),
        eq(pluginInstallations.enabled, true),
      ),
    );
  const plugin = row ? c.var.plugins.get(pluginId) : undefined;
  if (!row || !plugin) return null;
  const community = toCommunity(row.community);
  const ctx = createPluginContext({
    db: c.var.db,
    plugin,
    installationId: row.installationId,
    community,
    user: c.var.user,
  });
  return { plugin, ctx };
}

function pluginFailure(c: Context<AppEnv>, err: unknown) {
  if (err instanceof PluginInputError) return c.json({ error: "invalid_input", issues: err.issues }, 400);
  if (err instanceof PluginError) {
    console.error(err.message);
    return c.json({ error: "plugin_error" }, 500);
  }
  throw err;
}
