import {
  memberRoleSchema,
  type PlaceMember,
  type PlacePlugin,
  type PlaceUpdate,
  placeUpdateSchema,
  pluginSwitchSchema,
} from "@app/shared";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { type RecordId, surql } from "surrealdb";
import type { AppEnv } from "../context";
import { type Db, first, geoPoint, keyOf, memberRole, membershipRef, polishOrder, ref, rows, toCommunity } from "../db";
import { requirePlaceAdmin, requireUser } from "../middleware";
import type { LoadedPlugin, PluginHost } from "../plugins/host";

/**
 * Managing a place, for its admins (the app's "Zarządzaj miejscem"): its settings, members (granting and revoking
 * admin rights, removing them; never the admin's own membership), built-in plugins on and off, and deleting it. Mounted next to the communities router on /api/communities: a non-member gets 404 as on
 * every route of a place, a member who is not an admin 403. (Invitations: routes/invitations.ts; the dashboard
 * order: PATCH /:slug/dashboard in routes/communities.ts.)
 */
const admin = requirePlaceAdmin("only admins manage a place");

export const placeAdminRoutes = new Hono<AppEnv>()
  .patch("/:slug", requireUser, admin, zValidator("json", placeUpdateSchema), async (c) => {
    const { place } = c.var;
    await first(c.var.db, surql`UPDATE ${place.id} MERGE ${toColumns(c.req.valid("json"))};`);
    return c.json({ ok: true }, 200);
  })
  /** Deletes the place: memberships, invitations, plugin installations (with their data) and inbox entries cascade. */
  .delete("/:slug", requireUser, admin, async (c) => {
    const { place } = c.var;
    await c.var.db.query(surql`DELETE ${ref("dashboard", keyOf(place.id))}; DELETE ${place.id};`);
    return c.json({ ok: true }, 200);
  })
  .get("/:slug/members", requireUser, admin, async (c) => {
    const { place } = c.var;
    const found = await rows<{
      id: RecordId;
      name: string | null;
      email: string;
      role: PlaceMember["role"];
      joined_at: Date | null;
    }>(
      c.var.db,
      surql`SELECT user.id AS id, user.name AS name, user.email AS email, role, joined_at
         FROM membership WHERE community = ${place.id};`,
    );
    const adminsFirst = (m: { role: PlaceMember["role"] }) => (m.role === "admin" ? 0 : 1);
    const members: PlaceMember[] = found
      .sort(
        (a, b) =>
          adminsFirst(a) - adminsFirst(b) || polishOrder(a.name ?? "", b.name ?? "") || polishOrder(a.email, b.email),
      )
      .map((m) => ({
        id: keyOf(m.id),
        name: m.name ?? "",
        email: m.email,
        role: m.role,
        joinedAt: m.joined_at ? m.joined_at.toISOString() : null,
        you: keyOf(m.id) === c.var.user.id,
      }));
    return c.json(members, 200);
  })
  /** Makes another member an admin or a plain member again; an admin never changes their own role. */
  .patch("/:slug/members/:userId", requireUser, admin, zValidator("json", memberRoleSchema), async (c) => {
    const target = await otherMember(c.var.db, keyOf(c.var.place.id), c.var.user.id, c.req.param("userId"));
    if (target === "self") return c.json({ error: "own_membership", message: OWN_MEMBERSHIP }, 409);
    if (!target) return c.json({ error: "not_found", message: "not a member of this place" }, 404);
    await first(c.var.db, surql`UPDATE ${target} SET role = ${c.req.valid("json").role};`);
    return c.json({ ok: true }, 200);
  })
  /** Removes another member from the place; an admin never removes themselves. */
  .delete("/:slug/members/:userId", requireUser, admin, async (c) => {
    const target = await otherMember(c.var.db, keyOf(c.var.place.id), c.var.user.id, c.req.param("userId"));
    if (target === "self") return c.json({ error: "own_membership", message: OWN_MEMBERSHIP }, 409);
    if (!target) return c.json({ error: "not_found", message: "not a member of this place" }, 404);
    await first(c.var.db, surql`DELETE ${target};`);
    return c.json({ ok: true }, 200);
  })
  /**
   * The plugins of this place, with whether each is on: the built-in ones (as in GET /api/plugins), then the ones the
   * AI wrote for this place (routes/builder.ts) — published ones as they run, drafts as their latest ready version.
   */
  .get("/:slug/plugins", requireUser, admin, async (c) => {
    const { place } = c.var;
    const enabled = new Set(
      (
        await rows<{ plugin: string }>(
          c.var.db,
          surql`SELECT plugin FROM plugin_installation WHERE community = ${place.id} AND enabled;`,
        )
      ).map((installation) => installation.plugin),
    );
    const builtin: PlacePlugin[] = c.var.plugins
      .list()
      .filter((plugin) => plugin.origin === "builtin")
      .map((plugin) => ({
        id: plugin.manifest.id,
        name: plugin.manifest.name,
        icon: plugin.manifest.icon,
        description: plugin.manifest.description,
        enabled: enabled.has(plugin.manifest.id),
        madeByAi: false,
        draft: false,
        working: false,
        widgets: Object.keys(plugin.definition.dashboardWidgets ?? {}).length,
        ...pageOf(c.var.plugins, plugin),
      }));
    const ai: PlacePlugin[] = (await c.var.builder.owned(place)).map(
      ({ id, published, outline, request, working }) => ({
        id,
        name: outline?.name ?? request,
        icon: outline?.icon ?? "🧩",
        description: outline?.description ?? "",
        enabled: enabled.has(id),
        madeByAi: true,
        draft: published === null,
        working,
        widgets: outline?.dashboardWidgets.length ?? 0,
        // A published AI plugin runs in the host; a draft is not loaded, so its page has no admin part yet.
        ...pageOf(c.var.plugins, published === null ? undefined : c.var.plugins.get(id)),
      }),
    );
    return c.json([...builtin, ...ai], 200);
  })
  /**
   * Switches a plugin of the list above on (its data from before comes back) or off (the data stays, hidden). A draft
   * is switched on by publishing it (routes/builder.ts); another place's AI plugin is not found here.
   */
  .put("/:slug/plugins/:pluginId", requireUser, admin, zValidator("json", pluginSwitchSchema), async (c) => {
    const { place } = c.var;
    const plugin = c.var.plugins.get(c.req.param("pluginId"));
    const own =
      plugin?.origin === "builtin" || (await c.var.builder.publishedIds(place)).has(plugin?.manifest.id ?? "");
    if (!plugin || !own) {
      return c.json({ error: "not_found", message: "not a plugin of this place" }, 404);
    }
    if (c.req.valid("json").enabled) await c.var.plugins.enable(plugin, toCommunity(place));
    else {
      await first(
        c.var.db,
        surql`UPDATE plugin_installation SET enabled = false
              WHERE community = ${place.id} AND plugin = ${plugin.manifest.id};`,
      );
    }
    return c.json({ ok: true }, 200);
  });

/** What a plugin's page in "Zarządzaj miejscem" shows: its admin view and the sizes of its widget. */
const pageOf = (host: PluginHost, plugin: LoadedPlugin | undefined): Pick<PlacePlugin, "adminView" | "sizes"> => ({
  adminView: plugin?.manifest.adminView ?? null,
  sizes: plugin ? host.dashboardWidgets(plugin).flatMap((widget) => widget.sizes) : [],
});

// Without it an admin could demote or remove themselves and leave the place with no admin.
const OWN_MEMBERSHIP = "admins do not change their own membership";

/** The membership of another member of the place: "self" for the caller's own, undefined when not a member. */
async function otherMember(db: Db, communityId: string, callerId: string, userId: string) {
  if (userId === callerId) return "self";
  return (await memberRole(db, communityId, userId)) ? membershipRef(communityId, userId) : undefined;
}

/** The settings as database columns, leaving out the ones not sent. */
/** The given settings as columns. No pin (null) clears the location: undefined in a MERGE is stored as NONE. */
const toColumns = ({ joinRule, onMap, location, ...rest }: PlaceUpdate) => ({
  ...Object.fromEntries(
    Object.entries({ ...rest, join_rule: joinRule, on_map: onMap }).filter(([, value]) => value !== undefined),
  ),
  ...(location === undefined ? {} : { location: location ? geoPoint(location) : undefined }),
});
