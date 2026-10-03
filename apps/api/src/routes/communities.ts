import { type Role, viewParamsSchema } from "@app/plugin-sdk";
import { type Community, type CommunityNavItem, toolCallSchema } from "@app/shared";
import { zValidator } from "@hono/zod-validator";
import { and, asc, eq } from "drizzle-orm";
import { type Context, Hono } from "hono";
import type { AppEnv } from "../context";
import { type Db, schema } from "../db";
import { requireUser } from "../middleware";
import { ForbiddenError, PluginError, PluginInputError } from "../plugins/host";
import { FileInputError } from "../services/files/service";

/**
 * Communities and their plugins (for the app). A plugin's views, tools and uploads are available only
 * when the plugin is installed and enabled in the given community; otherwise 404.
 * Communities are open for now: the first visit creates a membership with the "user" role.
 */
const { communities, memberships, pluginInstallations } = schema;

const toCommunity = (row: typeof communities.$inferSelect): Community => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
});

/** User's role in a community; no membership = join as "user". */
async function roleIn(db: Db, communityId: string, userId: string): Promise<Role> {
  await db.insert(memberships).values({ communityId, userId }).onConflictDoNothing();
  const [row] = await db
    .select({ role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.communityId, communityId), eq(memberships.userId, userId)));
  return row?.role ?? "user";
}

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
    const role = await roleIn(c.var.db, row.id, c.var.user.id);
    return c.json({ ...toCommunity(row), role }, 200);
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
  })
  /** File upload for a plugin with the "files" permission (multipart, "file" field). Returns a FileId (pending). */
  .post("/:slug/plugins/:pluginId/files", async (c) => {
    const target = await resolve(c, c.req.param("slug"), c.req.param("pluginId"));
    if (!target?.plugin.manifest.permissions.includes("files")) return c.json({ error: "not_found" }, 404);
    const body = await c.req.parseBody();
    const file = body.file;
    if (!(file instanceof File)) return c.json({ error: "invalid_input", message: "missing file" }, 400);
    try {
      const fileId = await c.var.files.upload({
        installationId: target.installationId,
        userId: c.var.user.id,
        mime: file.type,
        data: new Uint8Array(await file.arrayBuffer()),
      });
      return c.json({ fileId }, 201);
    } catch (err) {
      if (err instanceof FileInputError) return c.json({ error: "invalid_input", message: err.message }, 400);
      throw err;
    }
  });

/** Community + enabled installation + loaded plugin + context with the user's role, or null (→ 404). */
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
  const role = await roleIn(c.var.db, row.community.id, c.var.user.id);
  const ctx = c.var.plugins.context(plugin, {
    installationId: row.installationId,
    community: toCommunity(row.community),
    user: { id: c.var.user.id, name: c.var.user.name, role },
  });
  return { plugin, ctx, installationId: row.installationId };
}

function pluginFailure(c: Context<AppEnv>, err: unknown) {
  if (err instanceof PluginInputError) return c.json({ error: "invalid_input", issues: err.issues }, 400);
  if (err instanceof ForbiddenError) return c.json({ error: "forbidden" }, 403);
  if (err instanceof PluginError) {
    console.error(err.message);
    return c.json({ error: "plugin_error" }, 500);
  }
  throw err;
}
