import { PluginCheckError } from "@app/plugin-sdk";
import { draftRequestSchema } from "@app/shared";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { AppEnv } from "../context";
import { requirePlaceAdmin, requireUser } from "../middleware";

/**
 * The plugin builder (Zarządzaj miejscem → "Stwórz plugin z AI"), for a place's admins: describe a feature, the AI
 * writes it as a plugin in the background (poll the draft), give feedback (a new revision), publish a ready revision
 * into the place. Mounted on /api/communities like placeAdmin: a non-member 404, a member who is not an admin 403.
 * Without a model on the server, new requests get 503 `ai_unavailable`. See plugins/drafts.ts.
 */
const admin = requirePlaceAdmin("only admins build plugins");

export const draftsRoutes = new Hono<AppEnv>()
  .get("/:slug/drafts", requireUser, admin, async (c) => {
    const { place } = c.var;
    return c.json(await c.var.drafts.list(place), 200);
  })
  .post("/:slug/drafts", requireUser, admin, zValidator("json", draftRequestSchema), async (c) => {
    const { place } = c.var;
    if (!c.var.drafts.available) return c.json({ error: "ai_unavailable" }, 503);
    return c.json(await c.var.drafts.create(place, c.var.user.id, c.req.valid("json").request), 201);
  })
  .get("/:slug/drafts/:draftId", requireUser, admin, async (c) => {
    const { place } = c.var;
    const draft = await c.var.drafts.get(place, c.req.param("draftId"));
    if (!draft) return c.json({ error: "not_found" }, 404);
    return c.json(draft, 200);
  })
  /** Feedback on the plugin: the AI changes the latest ready source. 409 while a revision is being written. */
  .post("/:slug/drafts/:draftId/revisions", requireUser, admin, zValidator("json", draftRequestSchema), async (c) => {
    const { place } = c.var;
    if (!c.var.drafts.available) return c.json({ error: "ai_unavailable" }, 503);
    const draft = await c.var.drafts.revise(place, c.req.param("draftId"), c.req.valid("json").request);
    if (!draft) return c.json({ error: "not_found" }, 404);
    if (draft === "busy") return c.json({ error: "busy", message: "a revision is being written" }, 409);
    return c.json(draft, 201);
  })
  /**
   * Installs the latest ready revision in the place and switches it on (again after feedback: the new version
   * replaces the old one, the data stays). 409 without a ready revision; 400 when the source fails a check now.
   */
  .post("/:slug/drafts/:draftId/publish", requireUser, admin, async (c) => {
    const { place } = c.var;
    try {
      const draft = await c.var.drafts.publish(place, c.req.param("draftId"));
      if (!draft) return c.json({ error: "not_found" }, 404);
      if (draft === "not_ready") return c.json({ error: "not_ready", message: "no ready revision" }, 409);
      return c.json(draft, 200);
    } catch (err) {
      if (!(err instanceof PluginCheckError)) throw err;
      return c.json({ error: "invalid_plugin", message: err.message, stage: err.stage, errors: err.errors }, 400);
    }
  });
