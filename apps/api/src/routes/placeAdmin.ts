import {
  type PlaceMember,
  type PlacePlugin,
  type PlaceUpdate,
  placeUpdateSchema,
  pluginSwitchSchema,
} from "@app/shared";
import { zValidator } from "@hono/zod-validator";
import { type Context, Hono } from "hono";
import { type RecordId, surql } from "surrealdb";
import type { AppEnv } from "../context";
import { type CommunityRow, communityBySlug, first, keyOf, memberRole, ref, rows, toCommunity } from "../db";
import { requireUser } from "../middleware";

/**
 * Managing a place, for its admins (the app's "Zarządzaj miejscem"): its settings, members, built-in plugins on and
 * off, and deleting it. Mounted next to the communities router on /api/communities: a non-member gets 404 as on
 * every route of a place, a member who is not an admin 403. (Invitations: routes/invitations.ts; the dashboard
 * order: PATCH /:slug/dashboard in routes/communities.ts.)
 */
export const placeAdminRoutes = new Hono<AppEnv>()
  .patch("/:slug", requireUser, zValidator("json", placeUpdateSchema), async (c) => {
    const place = await adminPlace(c);
    if (place === "not_found") return c.json({ error: "not_found" }, 404);
    if (place === "forbidden") return c.json({ error: "forbidden", message: "only admins manage a place" }, 403);
    await first(c.var.db, surql`UPDATE ${place.id} MERGE ${toColumns(c.req.valid("json"))};`);
    return c.json({ ok: true }, 200);
  })
  /** Deletes the place: memberships, invitations, plugin installations (with their data) and inbox entries cascade. */
  .delete("/:slug", requireUser, async (c) => {
    const place = await adminPlace(c);
    if (place === "not_found") return c.json({ error: "not_found" }, 404);
    if (place === "forbidden") return c.json({ error: "forbidden", message: "only admins manage a place" }, 403);
    await c.var.db.query(surql`DELETE ${ref("dashboard", keyOf(place.id))}; DELETE ${place.id};`);
    return c.json({ ok: true }, 200);
  })
  .get("/:slug/members", requireUser, async (c) => {
    const place = await adminPlace(c);
    if (place === "not_found") return c.json({ error: "not_found" }, 404);
    if (place === "forbidden") return c.json({ error: "forbidden", message: "only admins manage a place" }, 403);
    const found = await rows<{ id: RecordId; name: string | null; email: string; role: PlaceMember["role"] }>(
      c.var.db,
      surql`SELECT user.id AS id, user.name AS name, user.email AS email, role
         FROM membership WHERE community = ${place.id} ORDER BY role, name, email;`,
    );
    const members: PlaceMember[] = found.map((m) => ({
      id: keyOf(m.id),
      name: m.name ?? "",
      email: m.email,
      role: m.role,
    }));
    return c.json(members, 200);
  })
  /** The built-in plugins (as in GET /api/plugins) with whether each is on in this place. */
  .get("/:slug/plugins", requireUser, async (c) => {
    const place = await adminPlace(c);
    if (place === "not_found") return c.json({ error: "not_found" }, 404);
    if (place === "forbidden") return c.json({ error: "forbidden", message: "only admins manage a place" }, 403);
    const enabled = new Set(
      (
        await rows<{ plugin: string }>(
          c.var.db,
          surql`SELECT plugin FROM plugin_installation WHERE community = ${place.id} AND enabled;`,
        )
      ).map((installation) => installation.plugin),
    );
    const plugins: PlacePlugin[] = c.var.plugins
      .list()
      .filter((plugin) => plugin.origin === "builtin")
      .map(({ manifest: { id, name, icon, description } }) => ({
        id,
        name,
        icon,
        description,
        enabled: enabled.has(id),
      }));
    return c.json(plugins, 200);
  })
  /** Switches a built-in plugin on (its data from before comes back) or off (the data stays, hidden). */
  .put("/:slug/plugins/:pluginId", requireUser, zValidator("json", pluginSwitchSchema), async (c) => {
    const place = await adminPlace(c);
    if (place === "not_found") return c.json({ error: "not_found" }, 404);
    if (place === "forbidden") return c.json({ error: "forbidden", message: "only admins manage a place" }, 403);
    const plugin = c.var.plugins.get(c.req.param("pluginId"));
    if (plugin?.origin !== "builtin") {
      return c.json({ error: "not_found", message: "not a built-in plugin" }, 404);
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

/** The place if the signed-in user is its admin; "not_found" for a non-member (or no such place), else "forbidden". */
async function adminPlace(c: Context<AppEnv>): Promise<CommunityRow | "not_found" | "forbidden"> {
  const place = await communityBySlug(c.var.db, c.req.param("slug") ?? "");
  const role = place ? await memberRole(c.var.db, keyOf(place.id), c.var.user.id) : null;
  if (!place || !role) return "not_found";
  return role === "admin" ? place : "forbidden";
}

/** The settings as database columns, leaving out the ones not sent. */
const toColumns = ({ joinRule, ...rest }: PlaceUpdate) =>
  Object.fromEntries(Object.entries({ ...rest, join_rule: joinRule }).filter(([, value]) => value !== undefined));
