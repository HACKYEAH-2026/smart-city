import {
  DASHBOARD_COLUMNS,
  type DashboardWidgetSize,
  type PluginCommunity,
  type Context as PluginContext,
  type PluginUser,
  type Role,
  sameSize,
  type UINode,
  viewParamsSchema,
} from "@app/plugin-sdk";
import {
  type CommunityNavItem,
  type CreatedPlace,
  type DashboardLayout,
  dashboardLayoutSchema,
  dashboardOrderSchema,
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
  type JoinRule,
  joinPlaceSchema,
  type LayoutWidget,
  type MyPlace,
  newPlaceSchema,
  type PlaceDetails,
  type PlaceKind,
  type PlacePreview,
  parseInviteCode,
  toolCallSchema,
} from "@app/shared";
import { zValidator } from "@hono/zod-validator";
import { type Context, Hono } from "hono";
import { type GeometryPoint, type RecordId, surql } from "surrealdb";
import type { AppEnv } from "../context";
import {
  type CommunityRow,
  communityBySlug,
  type Db,
  first,
  fromGeoPoint,
  geoPoint,
  keyOf,
  memberRole,
  membershipRef,
  polishOrder,
  ref,
  rows,
  toCommunity,
  toPluginCommunity,
} from "../db";
import { logger } from "../log";
import { requirePlaceAdmin, requireUser } from "../middleware";
import { ForbiddenError, type LoadedPlugin, PluginError, type PluginHost, PluginInputError } from "../plugins/host";
import { FileInputError } from "../services/files/service";

type DashboardWidgetItem = {
  key: string;
  pluginId: string;
  widget: string;
  size: DashboardWidgetSize;
  node: UINode;
};

const log = logger("communities");

/**
 * Places (communities) and their plugins, for the app. A user sees only the places they are a member of;
 * everything else in a place answers 404 (the place may exist, the user does not learn it).
 * Creating a place makes its creator an admin and gives the place an invite code (shown to its admins only).
 * The creator picks which built-in plugins the place starts with.
 * Joining a place is not part of the API yet.
 */
export const communitiesRoutes = new Hono<AppEnv>()
  .use(requireUser)
  .use(async (c, next) => {
    await c.var.plugins.ready();
    await next();
  })
  .get("/", async (c) => {
    const mine = await rows<{
      id: RecordId;
      slug: string;
      name: string;
      kind: PlaceKind | null;
      role: Role;
      is_default: boolean;
      last_visit: Date | null;
    }>(
      c.var.db,
      surql`SELECT community.id AS id, community.slug AS slug, community.name AS name, community.kind AS kind, role,
              is_default, last_visit
         FROM membership WHERE user = ${ref("user", c.var.user.id)};`,
    );
    const places: MyPlace[] = mine
      .sort((a, b) => polishOrder(a.name, b.name))
      .map((m) => ({
        id: keyOf(m.id),
        slug: m.slug,
        name: m.name,
        kind: m.kind ?? "other",
        role: m.role,
        isDefault: m.is_default,
        lastVisitAt: m.last_visit ? m.last_visit.toISOString() : null,
      }));
    return c.json(places);
  })
  .post("/", zValidator("json", newPlaceSchema), async (c) => {
    const { name, kind, address, description, joinRule, location, onMap, makeDefault, plugins } = c.req.valid("json");
    const chosen = builtinPlugins(c.var.plugins, plugins);
    if (!chosen) return c.json({ error: "unknown_plugin", message: "plugins must be ids of built-in plugins" }, 400);
    const slug = await freeSlug(c.var.db, name);
    if (!slug) return c.json({ error: "conflict", message: "could not derive a free slug" }, 409);
    const inviteCode = await freeInviteCode(c.var.db);
    const created = await first<CommunityRow>(
      c.var.db,
      surql`CREATE community CONTENT ${{
        slug,
        name,
        kind,
        address,
        description,
        join_rule: joinRule,
        invite_code: inviteCode,
        on_map: onMap,
        ...(location ? { location: geoPoint(location) } : {}),
      }};`,
    );
    if (!created) throw new Error("community create returned no row");
    const communityId = keyOf(created.id);
    const u = ref("user", c.var.user.id);
    // The first place of a user becomes their default place; a later one only when asked (makeDefault).
    const hasDefault = await first<{ id: RecordId }>(
      c.var.db,
      surql`SELECT id FROM membership WHERE user = ${u} AND is_default LIMIT 1;`,
    );
    if (makeDefault && hasDefault) {
      await first(c.var.db, surql`UPDATE membership SET is_default = false WHERE user = ${u} AND is_default = true;`);
    }
    await first(
      c.var.db,
      surql`CREATE ${membershipRef(communityId, c.var.user.id)} CONTENT
              { community: ${ref("community", communityId)}, user: ${u}, role: 'admin', is_default: ${makeDefault || !hasDefault} };`,
    );
    const community = toCommunity(created);
    // One after another: the place's navigation lists plugins in the order they were enabled.
    for (const plugin of chosen) await c.var.plugins.enable(plugin, community);
    const place: CreatedPlace = { ...community, inviteCode };
    return c.json(place, 201);
  })
  /** The place behind an invite code, before joining (the scanned QR code's screen). */
  .get("/invite/:code", async (c) => {
    const code = parseInviteCode(c.req.param("code"));
    const place = code ? await placeByInviteCode(c.var.db, code) : null;
    if (!place) return c.json({ error: "not_found", message: "no place has this invite code" }, 404);
    const preview: PlacePreview = {
      name: place.name,
      kind: place.kind ?? "other",
      address: place.address ?? "",
      description: place.description ?? "",
      joinRule: place.join_rule ?? "approval",
    };
    return c.json(preview);
  })
  /**
   * Joining by invite code. Only places that open to anyone with the code (join rule "open") can be joined here;
   * the others wait for an admin, which is not built yet.
   */
  .post("/join", zValidator("json", joinPlaceSchema), async (c) => {
    const { code: raw, makeDefault } = c.req.valid("json");
    const code = parseInviteCode(raw);
    const place = code ? await placeByInviteCode(c.var.db, code) : null;
    if (!place) return c.json({ error: "not_found", message: "no place has this invite code" }, 404);
    if ((place.join_rule ?? "approval") !== "open") {
      return c.json({ error: "approval_required", message: "this place admits members only after approval" }, 403);
    }
    await joinAsMember(c.var.db, place, c.var.user.id, makeDefault);
    return c.json(toCommunity(place));
  })
  .get("/:slug", async (c) => {
    const member = await memberOf(c, c.req.param("slug"));
    if (!member) return c.json({ error: "not_found" }, 404);
    const details = await first<{
      kind: PlaceKind | null;
      address: string | null;
      description: string | null;
      join_rule: JoinRule | null;
      invite_code: string | null;
      location: GeometryPoint | null;
      on_map: boolean | null;
    }>(
      c.var.db,
      surql`SELECT kind, address, description, join_rule, invite_code, location, on_map FROM ${member.row.id};`,
    );
    // Places created before the wizard have no answers stored: the schema defaults stand in.
    const place: PlaceDetails = {
      ...toCommunity(member.row),
      role: member.role,
      kind: details?.kind ?? "other",
      address: details?.address ?? "",
      description: details?.description ?? "",
      joinRule: details?.join_rule ?? "approval",
      location: details?.location ? fromGeoPoint(details.location) : null,
      onMap: details?.on_map ?? false,
      inviteCode: member.role === "admin" ? (details?.invite_code ?? null) : null,
    };
    return c.json(place, 200);
  })
  /** Opening a place: remembers it as the user's last visited place (shown on the dashboard). */
  .post("/:slug/visit", async (c) => {
    const member = await memberOf(c, c.req.param("slug"));
    if (!member) return c.json({ error: "not_found" }, 404);
    await first(
      c.var.db,
      surql`UPDATE ${membershipRef(keyOf(member.row.id), c.var.user.id)} SET last_visit = time::now();`,
    );
    return c.json({ ok: true }, 200);
  })
  /** Makes this place the user's default place; the previous default is cleared. */
  .put("/:slug/default", async (c) => {
    const member = await memberOf(c, c.req.param("slug"));
    if (!member) return c.json({ error: "not_found" }, 404);
    await first(
      c.var.db,
      surql`UPDATE membership SET is_default = false WHERE user = ${ref("user", c.var.user.id)} AND is_default = true;
            UPDATE ${membershipRef(keyOf(member.row.id), c.var.user.id)} SET is_default = true;`,
    );
    return c.json({ ok: true }, 200);
  })
  .get("/:slug/nav", async (c) => {
    if (!(await memberOf(c, c.req.param("slug")))) return c.json({ error: "not_found" }, 404);
    const installed = await rows<{ plugin: string }>(
      c.var.db,
      surql`SELECT plugin, created_at FROM plugin_installation
            WHERE community.slug = ${c.req.param("slug")} AND enabled ORDER BY created_at;`,
    );
    const nav: CommunityNavItem[] = installed.flatMap(({ plugin: pluginId }) => {
      const plugin = c.var.plugins.get(pluginId);
      if (!plugin) return [];
      return plugin.manifest.nav.map((n) => ({ pluginId, icon: plugin.manifest.icon, view: n.view, label: n.label }));
    });
    return c.json(nav);
  })
  /**
   * Dashboard: the widgets on the community's layout (communityLayout), rendered for this user, in its order and
   * sizes. Every plugin has one widget and it always renders; one that fails (throws, null or invalid UI) is left
   * out and logged, so a broken plugin never breaks the dashboard. `canEdit` = the user may rearrange it.
   */
  .get("/:slug/dashboard", async (c) => {
    const member = await memberOf(c, c.req.param("slug"));
    if (!member) return c.json({ error: "not_found" }, 404);
    const community = toPluginCommunity(member.row);
    const user = { id: c.var.user.id, name: c.var.user.name, role: member.role };
    const layout = await communityLayout(c.var.db, c.var.plugins, community.id);
    const widgets = await renderWidgets(c.var.plugins, layout.widgets, community, user);
    return c.json({ canEdit: member.role === "admin", widgets }, 200);
  })
  /** The dashboard layout for its admins: widgets on it (in order, with sizes) and the removed ones. */
  .get("/:slug/dashboard/layout", requirePlaceAdmin("only admins arrange the dashboard"), async (c) => {
    const layout = await communityLayout(c.var.db, c.var.plugins, keyOf(c.var.place.id));
    return c.json(toDashboardLayout(layout), 200);
  })
  /**
   * Community admins save the dashboard layout: the widgets on it in order, each with a size its plugin allows.
   * Declared widgets left out are hidden. 400 when a key is not a widget of an enabled plugin or a size is not allowed.
   */
  .put(
    "/:slug/dashboard/layout",
    requirePlaceAdmin("only admins arrange the dashboard"),
    zValidator("json", dashboardLayoutSchema),
    async (c) => {
      const communityId = keyOf(c.var.place.id);
      const { widgets } = c.req.valid("json");
      const current = await communityLayout(c.var.db, c.var.plugins, communityId);
      const declared = [...current.widgets, ...current.available];
      const invalid = widgets.find(({ key, size }) => !declared.find((d) => d.key === key)?.sizes.some(sameAs(size)));
      if (invalid) {
        return c.json(
          { error: "invalid_layout", message: `"${invalid.key}" is not a widget here or cannot have this size` },
          400,
        );
      }
      const listed = new Set(widgets.map((w) => w.key));
      const saved = {
        order: widgets.map((w) => w.key),
        sizes: widgets.map(({ key, size }) => ({ key, w: size.w, h: size.h })),
        hidden: declared.filter((d) => !listed.has(d.key)).map((d) => d.key),
      };
      await c.var.db.query(
        surql`UPSERT ${ref("dashboard", communityId)}
              SET order = ${saved.order}, sizes = ${saved.sizes}, hidden = ${saved.hidden}, updated_at = time::now();`,
      );
      const layout = await communityLayout(c.var.db, c.var.plugins, communityId);
      return c.json(toDashboardLayout(layout), 200);
    },
  )
  /** Community admins reorder the dashboard in place (keys "<pluginId>/<widget>"); sizes and hidden widgets stay. */
  .patch(
    "/:slug/dashboard",
    requirePlaceAdmin("only admins arrange the dashboard"),
    zValidator("json", dashboardOrderSchema),
    async (c) => {
      const community = toCommunity(c.var.place);
      const { order } = c.req.valid("json");
      await c.var.db.query(
        surql`UPSERT ${ref("dashboard", community.id)} SET order = ${order}, updated_at = time::now();`,
      );
      return c.json({ order }, 200);
    },
  )
  .get("/:slug/plugins/:pluginId/views/:view", zValidator("query", viewParamsSchema), async (c) => {
    const target = await resolve(c, c.req.param("slug"), c.req.param("pluginId"));
    if (!target) return c.json({ error: "not_found" }, 404);
    const view = c.req.param("view");
    if (typeof target.plugin.definition.views[view] !== "function") return c.json({ error: "not_found" }, 404);
    // The plugin's page in "Zarządzaj miejscem" is for the place's admins; other admin views check the role themselves.
    if (view === target.plugin.manifest.adminView && target.ctx.user.role !== "admin") {
      return c.json({ error: "forbidden" }, 403);
    }
    try {
      const node = await c.var.plugins.renderView(
        target.plugin,
        target.installationId,
        view,
        target.ctx,
        c.req.valid("query"),
      );
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

/** The place and the signed-in user's role in it, or null when the place is unknown or the user is not a member. */
async function memberOf(c: Context<AppEnv>, slug: string) {
  const row = await communityBySlug(c.var.db, slug);
  if (!row) return null;
  const role = await memberRole(c.var.db, keyOf(row.id), c.var.user.id);
  return role ? { row, role } : null;
}

type PlaceByCode = CommunityRow & {
  kind: PlaceKind | null;
  address: string | null;
  description: string | null;
  join_rule: JoinRule | null;
};

/** The place with this invite code, if any. */
function placeByInviteCode(db: Db, code: string): Promise<PlaceByCode | undefined> {
  return first<PlaceByCode>(
    db,
    surql`SELECT id, slug, name, kind, address, description, join_rule FROM community WHERE invite_code = ${code} LIMIT 1;`,
  );
}

/**
 * Makes the user a member of an open place (as a plain member, unless already a member), remembers it as the last
 * visited place, and makes it the default one when asked.
 */
export async function joinAsMember(db: Db, place: CommunityRow, userId: string, makeDefault: boolean): Promise<void> {
  const communityId = keyOf(place.id);
  const u = ref("user", userId);
  const c = ref("community", communityId);
  const existing = await first<{ id: RecordId }>(
    db,
    surql`SELECT id FROM membership WHERE user = ${u} AND community = ${c} LIMIT 1;`,
  );
  if (!existing) {
    await first(
      db,
      surql`CREATE ${membershipRef(communityId, userId)} CONTENT { community: ${c}, user: ${u}, role: 'user', is_default: false };`,
    );
  }
  if (makeDefault) {
    await first(db, surql`UPDATE membership SET is_default = false WHERE user = ${u} AND is_default = true;`);
  }
  await first(
    db,
    surql`UPDATE ${membershipRef(communityId, userId)} SET last_visit = time::now(), is_default = ${makeDefault} OR is_default;`,
  );
}

/** Slug from the place name (ASCII, lowercase, hyphens), with a numeric suffix when taken. Null after 50 tries. */
async function freeSlug(db: Db, name: string): Promise<string | null> {
  const base =
    name
      .toLowerCase()
      .replaceAll("ł", "l") // not a decomposable letter, so NFKD leaves it alone
      .normalize("NFKD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 36) || "miejsce";
  for (let i = 1; i <= 50; i++) {
    const candidate = i === 1 ? base : `${base}-${i}`;
    if (!(await communityBySlug(db, candidate))) return candidate;
  }
  return null;
}

/** The built-in plugins with these ids (repeats dropped), or null when an id is not a built-in plugin. */
function builtinPlugins(host: PluginHost, ids: string[]): LoadedPlugin[] | null {
  const found = [...new Set(ids)].map((id) => host.get(id));
  return found.every((plugin): plugin is LoadedPlugin => plugin?.origin === "builtin") ? found : null;
}

/** A random invite code no other place has (INVITE_CODE_LENGTH characters of INVITE_CODE_ALPHABET). */
async function freeInviteCode(db: Db): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const code = randomInviteCode();
    const taken = await first<{ id: RecordId }>(
      db,
      surql`SELECT id FROM community WHERE invite_code = ${code} LIMIT 1;`,
    );
    if (!taken) return code;
  }
  throw new Error("no free invite code after 20 tries");
}

// The alphabet has 32 characters, so `byte % 32` picks every character equally often.
const randomInviteCode = (): string =>
  Array.from(
    crypto.getRandomValues(new Uint8Array(INVITE_CODE_LENGTH)),
    (byte) => INVITE_CODE_ALPHABET[byte % INVITE_CODE_ALPHABET.length],
  ).join("");

/** Community + enabled installation + loaded plugin + context with the user's role, or null (→ 404). */
async function resolve(c: Context<AppEnv>, slug: string, pluginId: string) {
  const row = await first<{ id: RecordId; community: CommunityRow }>(
    c.var.db,
    surql`SELECT id, community FROM plugin_installation
            WHERE community.slug = ${slug} AND plugin = ${pluginId} AND enabled FETCH community;`,
  );
  const plugin = row ? c.var.plugins.get(pluginId) : undefined;
  if (!row || !plugin) return null;
  const community = toPluginCommunity(row.community);
  const role = await memberRole(c.var.db, community.id, c.var.user.id);
  if (!role) return null;
  const installationId = keyOf(row.id);
  const lastVisit = await c.var.plugins.lastVisit(installationId, c.var.user.id);
  const ctx = c.var.plugins.context(plugin, {
    installationId,
    community,
    user: { id: c.var.user.id, name: c.var.user.name, role },
    lastVisit,
  });
  return { plugin, ctx, installationId };
}

/** A declared widget of an enabled plugin, with the size it has on this community's dashboard. */
type ResolvedWidget = LayoutWidget & { widget: string; installationId: string; plugin: LoadedPlugin };
type ResolvedLayout = { widgets: ResolvedWidget[]; available: ResolvedWidget[] };

type SavedDashboard = { order: string[]; sizes: { key: string; w: number; h: number }[]; hidden: string[] };

/**
 * The community's dashboard layout, the one code path for the dashboard and its editor: the declared widgets of the
 * enabled plugins (default order: installation, then declaration) resolved against what the admins saved.
 * `widgets` = not hidden, in the saved order (widgets missing from it follow in the default order), each with its
 * saved size when the plugin still allows it, else the plugin's default; `available` = the hidden ones.
 */
async function communityLayout(db: Db, host: PluginHost, communityId: string): Promise<ResolvedLayout> {
  const declared = await declaredWidgets(db, host, communityId);
  const saved = await savedDashboard(db, communityId);
  const sized = declared.map((w) => ({ ...w, size: savedSize(w, saved) }));
  const hidden = new Set(saved.hidden);
  return {
    widgets: sortByOrder(
      sized.filter((w) => !hidden.has(w.key)),
      saved.order,
    ),
    available: sized.filter((w) => hidden.has(w.key)),
  };
}

async function declaredWidgets(db: Db, host: PluginHost, communityId: string): Promise<ResolvedWidget[]> {
  const installed = await rows<{ id: RecordId; plugin: string }>(
    db,
    surql`SELECT id, plugin, created_at FROM plugin_installation
          WHERE community = ${ref("community", communityId)} AND enabled ORDER BY created_at;`,
  );
  return installed.flatMap(({ id, plugin: pluginId }) => {
    const plugin = host.get(pluginId);
    if (!plugin) return [];
    return host.dashboardWidgets(plugin).map(({ name, title, size, sizes }) => ({
      key: `${pluginId}/${name}`,
      pluginId,
      pluginName: plugin.manifest.name,
      pluginIcon: plugin.manifest.icon,
      title,
      size,
      sizes,
      widget: name,
      installationId: keyOf(id),
      plugin,
    }));
  });
}

/** What the admins saved; a place whose admins never arranged it (or saved before sizes existed) gets empty lists. */
async function savedDashboard(db: Db, communityId: string): Promise<SavedDashboard> {
  const row = await first<Partial<SavedDashboard>>(
    db,
    surql`SELECT order, sizes, hidden FROM ${ref("dashboard", communityId)};`,
  );
  return { order: row?.order ?? [], sizes: row?.sizes ?? [], hidden: row?.hidden ?? [] };
}

/** The saved size of a widget when its plugin still allows it, else the plugin's default. */
function savedSize(widget: ResolvedWidget, saved: SavedDashboard): DashboardWidgetSize {
  const chosen = saved.sizes.find((s) => s.key === widget.key);
  return (chosen && widget.sizes.find((s) => s.w === chosen.w && s.h === chosen.h)) ?? widget.size;
}

const sameAs = (size: DashboardWidgetSize) => (other: DashboardWidgetSize) => sameSize(size, other);

const toLayoutWidget = ({
  key,
  pluginId,
  pluginName,
  pluginIcon,
  title,
  size,
  sizes,
}: ResolvedWidget): LayoutWidget => ({
  key,
  pluginId,
  pluginName,
  pluginIcon,
  title,
  size,
  sizes,
});

const toDashboardLayout = (layout: ResolvedLayout): DashboardLayout => ({
  columns: DASHBOARD_COLUMNS,
  widgets: layout.widgets.map(toLayoutWidget),
  available: layout.available.map(toLayoutWidget),
});

/**
 * Renders the widgets for this user, in their order; one context per installation (its `lastVisit` read once).
 * A widget that fails (throws, null or invalid UI) is left out and logged.
 */
async function renderWidgets(
  host: PluginHost,
  widgets: ResolvedWidget[],
  community: PluginCommunity,
  user: PluginUser,
): Promise<DashboardWidgetItem[]> {
  const installations = widgets.filter((w, i) => widgets.findIndex((o) => o.installationId === w.installationId) === i);
  const contexts = new Map(
    installations.map(({ installationId, plugin }): [string, Promise<PluginContext>] => [
      installationId,
      host
        .lastVisit(installationId, user.id)
        .then((lastVisit) => host.context(plugin, { installationId, community, user, lastVisit })),
    ]),
  );
  const rendered = await Promise.all(
    widgets.map(async ({ key, pluginId, widget, size, installationId, plugin }) => {
      const ctx = await contexts.get(installationId);
      const node = ctx
        ? await host.renderDashboardWidget(plugin, installationId, widget, ctx, { size }).catch(logWidgetFailure)
        : null;
      return node ? [{ key, pluginId, widget, size, node }] : [];
    }),
  );
  return rendered.flat();
}

/** Saved order first; widgets missing from it keep their default order after those (stable sort). */
function sortByOrder<T extends { key: string }>(items: T[], order: string[]): T[] {
  const rank = (key: string) => {
    const i = order.indexOf(key);
    return i === -1 ? order.length : i;
  };
  return items.toSorted((a, b) => rank(a.key) - rank(b.key));
}

/** A widget that fails is left out of the dashboard; why is only in the log. */
function logWidgetFailure(err: unknown): null {
  log.error("dashboard widget left out", { err });
  return null;
}

function pluginFailure(c: Context<AppEnv>, err: unknown) {
  if (err instanceof PluginInputError) return c.json({ error: "invalid_input", issues: err.issues }, 400);
  if (err instanceof ForbiddenError) return c.json({ error: "forbidden" }, 403);
  if (err instanceof PluginError) {
    log.error("plugin failed", { err });
    return c.json({ error: "plugin_error" }, 500);
  }
  throw err;
}
