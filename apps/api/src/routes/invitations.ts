import { type Invitation, inviteSchema, type PlaceKind } from "@app/shared";
import { zValidator } from "@hono/zod-validator";
import { type Context, Hono } from "hono";
import { type RecordId, surql } from "surrealdb";
import type { AppEnv } from "../context";
import { type CommunityRow, communityBySlug, type Db, first, keyOf, memberRole, ref, rows, toCommunity } from "../db";
import { requireUser } from "../middleware";
import { joinAsMember } from "./communities";

/**
 * Invitations to places. An admin invites a user by the email they signed up with; the invitee sees the invitation
 * and accepts it (joining the place) or declines it (the invitation is removed). Each user sees only their own.
 */
export const invitationsRoutes = new Hono<AppEnv>()
  .use(requireUser)
  .get("/", async (c) => {
    const mine = await rows<{
      id: RecordId;
      name: string;
      kind: PlaceKind | null;
      inviter: string | null;
      created: Date;
    }>(
      c.var.db,
      surql`SELECT id, community.name AS name, community.kind AS kind, invited_by.name AS inviter, created_at AS created
         FROM invitation WHERE user = ${ref("user", c.var.user.id)} ORDER BY created DESC;`,
    );
    const invitations: Invitation[] = mine.map((i) => ({
      id: keyOf(i.id),
      placeName: i.name,
      placeKind: i.kind ?? "other",
      inviterName: i.inviter ?? "",
      createdAt: i.created.toISOString(),
    }));
    return c.json(invitations);
  })
  .post("/", zValidator("json", inviteSchema), async (c) => {
    const { slug, email } = c.req.valid("json");
    const place = await communityBySlug(c.var.db, slug);
    // Not a member: the place does not exist for them, as on every route of a place.
    const role = place ? await memberRole(c.var.db, keyOf(place.id), c.var.user.id) : null;
    if (!place || !role) return c.json({ error: "not_found" }, 404);
    if (role !== "admin") return c.json({ error: "forbidden", message: "only admins invite" }, 403);
    const invitee = await first<{ id: RecordId }>(c.var.db, surql`SELECT id FROM user WHERE email = ${email};`);
    if (!invitee) return c.json({ error: "not_found", message: "no account with this email" }, 404);
    const inviteeId = keyOf(invitee.id);
    if (await memberRole(c.var.db, keyOf(place.id), inviteeId)) {
      return c.json({ error: "conflict", message: "already a member" }, 409);
    }
    const u = ref("user", inviteeId);
    const c2 = ref("community", keyOf(place.id));
    if (await first(c.var.db, surql`SELECT id FROM invitation WHERE community = ${c2} AND user = ${u} LIMIT 1;`)) {
      return c.json({ error: "conflict", message: "already invited" }, 409);
    }
    await first(
      c.var.db,
      surql`CREATE invitation CONTENT { community: ${c2}, user: ${u}, invited_by: ${ref("user", c.var.user.id)} };`,
    );
    return c.json({ ok: true }, 201);
  })
  .post("/:id/accept", async (c) => {
    const invitation = await ownInvitation(c);
    if (!invitation) return c.json({ error: "not_found" }, 404);
    const place = await first<CommunityRow>(c.var.db, surql`SELECT id, slug, name FROM ${invitation.community};`);
    if (!place) throw new Error("invitation points to a missing place");
    await joinAsMember(c.var.db, place, c.var.user.id, false);
    await removeInvitation(c.var.db, invitation.id);
    return c.json(toCommunity(place));
  })
  .delete("/:id", async (c) => {
    const invitation = await ownInvitation(c);
    if (!invitation) return c.json({ error: "not_found" }, 404);
    await removeInvitation(c.var.db, invitation.id);
    return c.json({ ok: true });
  });

/** The invitation with this id if it is the signed-in user's, else undefined (→ 404). */
async function ownInvitation(c: Context<AppEnv>) {
  return first<{ id: RecordId; community: RecordId }>(
    c.var.db,
    surql`SELECT id, community FROM invitation
            WHERE id = ${ref("invitation", c.req.param("id") ?? "")} AND user = ${ref("user", c.var.user.id)} LIMIT 1;`,
  );
}

function removeInvitation(db: Db, id: RecordId) {
  return first(db, surql`DELETE ${id};`);
}
