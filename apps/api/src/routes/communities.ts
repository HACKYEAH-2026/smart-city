import { type Role, type UINode, viewParamsSchema, type WidgetSize } from "@app/plugin-sdk";
import { type CommunityNavItem, toolCallSchema } from "@app/shared";
import { zValidator } from "@hono/zod-validator";
import { type Context, Hono } from "hono";
import type { RecordId } from "surrealdb";
import type { AppEnv } from "../context";
import {
  type CommunityRow,
  communityBySlug,
  type Db,
  first,
  keyOf,
  membershipRef,
  ref,
  rows,
  toCommunity,
} from "../db";
import { requireUser } from "../middleware";
import { ForbiddenError, PluginError, PluginInputError } from "../plugins/host";
import { FileInputError } from "../services/files/service";

/** A rendered dashboard widget: `size` in grid cells (2 columns wide), `node` is the plugin's UI tree. */
type CommunityWidget = { pluginId: string; widget: string; size: WidgetSize; node: UINode };

/**
 * Communities and their plugins (for the app). A plugin's views, tools and uploads are available only
 * when the plugin is installed and enabled in the given community; otherwise 404.
 * Communities are open for now: the first visit creates a membership with the "user" role.
 */
/** User's role in a community; no membership = join as "user" (the role default). */
async function roleIn(db: Db, communityId: string, userId: string): Promise<Role> {
  const row = await first<{ role: Role }>(db, "UPSERT $m MERGE { community: $c, user: $u } RETURN role;", {
    m: membershipRef(communityId, userId),
    c: ref("community", communityId),
    u: ref("user", userId),
  });
  return row?.role ?? "user";
}

/** Role without joining (read-only, safe to run next to `roleIn`): no membership = "user". */
async function currentRole(db: Db, communityId: string, userId: string): Promise<Role> {
  const row = await first<{ role: Role }>(db, "SELECT role FROM $m;", { m: membershipRef(communityId, userId) });
  return row?.role ?? "user";
}

export const communitiesRoutes = new Hono<AppEnv>()
  .use(requireUser)
  .use(async (c, next) => {
    await c.var.plugins.ready();
    await next();
  })
  .get("/", async (c) => {
    const all = await rows<CommunityRow>(c.var.db, "SELECT id, slug, name FROM community ORDER BY name;");
    return c.json(all.map(toCommunity));
  })
  .get("/:slug", async (c) => {
    const row = await communityBySlug(c.var.db, c.req.param("slug"));
    if (!row) return c.json({ error: "not_found" }, 404);
    const role = await roleIn(c.var.db, keyOf(row.id), c.var.user.id);
    return c.json({ ...toCommunity(row), role }, 200);
  })
  .get("/:slug/nav", async (c) => {
    const installed = await rows<{ plugin: string }>(
      c.var.db,
      "SELECT plugin, created_at FROM plugin_installation WHERE community.slug = $slug AND enabled ORDER BY created_at;",
      { slug: c.req.param("slug") },
    );
    const nav: CommunityNavItem[] = installed.flatMap(({ plugin: pluginId }) => {
      const plugin = c.var.plugins.get(pluginId);
      if (!plugin) return [];
      return plugin.manifest.nav.map((n) => ({ pluginId, icon: plugin.manifest.icon, view: n.view, label: n.label }));
    });
    return c.json(nav);
  })
  /**
   * Dashboard: widgets of the enabled plugins, rendered for this user. A widget that fails or returns null
   * is left out, so one broken plugin never breaks the dashboard.
   */
  .get("/:slug/widgets", async (c) => {
    const row = await communityBySlug(c.var.db, c.req.param("slug"));
    if (!row) return c.json({ error: "not_found" }, 404);
    const community = toCommunity(row);
    const role = await currentRole(c.var.db, community.id, c.var.user.id);
    const user = { id: c.var.user.id, name: c.var.user.name, role };
    const installed = await rows<{ id: RecordId; plugin: string }>(
      c.var.db,
      "SELECT id, plugin, created_at FROM plugin_installation WHERE community = $c AND enabled ORDER BY created_at;",
      { c: ref("community", community.id) },
    );
    const perPlugin = await Promise.all(
      installed.map(async ({ id, plugin: pluginId }) => {
        const plugin = c.var.plugins.get(pluginId);
        if (!plugin) return [];
        const installationId = keyOf(id);
        const lastVisit = await c.var.plugins.lastVisit(installationId, user.id);
        const ctx = c.var.plugins.context(plugin, { installationId, community, user, lastVisit });
        return Promise.all(
          c.var.plugins.widgets(plugin).map(async ({ name, size }) => {
            const node = await c.var.plugins.renderWidget(plugin, name, ctx).catch(logWidgetFailure);
            return node ? [{ pluginId, widget: name, size, node }] : [];
          }),
        );
      }),
    );
    const widgets: CommunityWidget[] = perPlugin.flat(2);
    return c.json(widgets, 200);
  })
  .get("/:slug/plugins/:pluginId/views/:view", zValidator("query", viewParamsSchema), async (c) => {
    const target = await resolve(c, c.req.param("slug"), c.req.param("pluginId"));
    if (!target) return c.json({ error: "not_found" }, 404);
    const view = c.req.param("view");
    if (typeof target.plugin.definition.views[view] !== "function") return c.json({ error: "not_found" }, 404);
    try {
      const node = await c.var.plugins.renderView(target.plugin, view, target.ctx, c.req.valid("query"));
      await c.var.plugins.recordVisit(target.installationId, c.var.user.id);
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
  const row = await first<{ id: RecordId; community: CommunityRow }>(
    c.var.db,
    `SELECT id, community FROM plugin_installation
       WHERE community.slug = $slug AND plugin = $plugin AND enabled FETCH community;`,
    { slug, plugin: pluginId },
  );
  const plugin = row ? c.var.plugins.get(pluginId) : undefined;
  if (!row || !plugin) return null;
  const community = toCommunity(row.community);
  const installationId = keyOf(row.id);
  const role = await roleIn(c.var.db, community.id, c.var.user.id);
  const lastVisit = await c.var.plugins.lastVisit(installationId, c.var.user.id);
  const ctx = c.var.plugins.context(plugin, {
    installationId,
    community,
    user: { id: c.var.user.id, name: c.var.user.name, role },
    lastVisit,
  });
  return { plugin, ctx, installationId };
}

function logWidgetFailure(err: unknown): null {
  console.error(err instanceof Error ? err.message : err);
  return null;
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
