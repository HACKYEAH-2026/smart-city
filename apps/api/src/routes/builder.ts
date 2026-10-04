import { PluginCheckError } from "@app/plugin-sdk";
import { pluginRequestSchema } from "@app/shared";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { AppEnv } from "../context";
import { requirePlaceAdmin, requireUser } from "../middleware";

/**
 * The plugin builder (Zarządzaj miejscem → Rozszerzenia → "Dodaj rozszerzenie" → "Stwórz rozszerzenie z AI"), for a
 * place's admins: describe a plugin and the AI writes it in the background (a draft: poll the plugin), ask for
 * changes (new versions), publish the latest ready version into the place — again after changes. The place's plugin list and switching are in placeAdmin.ts.
 * Without a model on the server, requests to the AI get 503 `ai_unavailable`; a place gets REQUESTS_PER_DAY of them
 * a day (429 `rate_limited`). See plugins/builder.ts.
 */
const admin = requirePlaceAdmin("only admins build plugins");

export const builderRoutes = new Hono<AppEnv>()
  /** A new plugin from the admin's description; 201 with the draft, its first version is being written. */
  .post("/:slug/plugins", requireUser, admin, zValidator("json", pluginRequestSchema), async (c) => {
    if (!c.var.builder.available) return c.json({ error: "ai_unavailable" }, 503);
    const plugin = await c.var.builder.create(c.var.place, c.var.user.id, c.req.valid("json").request);
    if (plugin === "limit") return c.json({ error: "rate_limited", message: "too many AI requests today" }, 429);
    return c.json(plugin, 201);
  })
  /** An AI plugin of the place with its versions (404 for built-in plugins and other places' plugins). */
  .get("/:slug/plugins/:pluginId", requireUser, admin, async (c) => {
    const plugin = await c.var.builder.get(c.var.place, c.req.param("pluginId"));
    if (!plugin) return c.json({ error: "not_found" }, 404);
    return c.json(plugin, 200);
  })
  /** A change to the plugin: the AI writes a new version from the latest ready one. 409 while one is being written. */
  .post("/:slug/plugins/:pluginId/versions", requireUser, admin, zValidator("json", pluginRequestSchema), async (c) => {
    if (!c.var.builder.available) return c.json({ error: "ai_unavailable" }, 503);
    const plugin = await c.var.builder.change(c.var.place, c.req.param("pluginId"), c.req.valid("json").request);
    if (!plugin) return c.json({ error: "not_found" }, 404);
    if (plugin === "busy") return c.json({ error: "busy", message: "a version is being written" }, 409);
    if (plugin === "limit") return c.json({ error: "rate_limited", message: "too many AI requests today" }, 429);
    return c.json(plugin, 201);
  })
  /**
   * Installs the latest ready version in the place and switches it on (after changes: the new version replaces the
   * running one, the data stays). 409 without a ready version; 400 when the source fails a check now.
   */
  .post("/:slug/plugins/:pluginId/publish", requireUser, admin, async (c) => {
    try {
      const plugin = await c.var.builder.publish(c.var.place, c.req.param("pluginId"));
      if (!plugin) return c.json({ error: "not_found" }, 404);
      if (plugin === "not_ready") return c.json({ error: "not_ready", message: "no ready version" }, 409);
      return c.json(plugin, 200);
    } catch (err) {
      if (!(err instanceof PluginCheckError)) throw err;
      return c.json({ error: "invalid_plugin", message: err.message, stage: err.stage, errors: err.errors }, 400);
    }
  });
