import { afterEach, describe, expect, test } from "bun:test";
import { type Ctx, setup, type TestUser } from "./helpers";

/**
 * Invitations: an admin invites a user by email; the invitee sees only their own invitations, accepts (joins the
 * place) or declines (removed). Only the place's admins invite.
 */
let t: Ctx;
afterEach(async () => {
  await t.close();
});

type Invitation = { id: string; placeName: string; placeKind: string; inviterName: string; createdAt: string };

const invitations = async (u: TestUser) =>
  (await (await t.request("/api/invitations", { headers: u.headers })).json()) as Invitation[];
const invite = (admin: TestUser, slug: string, email: string) =>
  t.request("/api/invitations", { method: "POST", headers: admin.headers, json: { slug, email } });
/** An admin's own place, made by the user through the places API. */
const adminPlace = async (admin: TestUser) => {
  const res = await t.request("/api/communities", {
    method: "POST",
    headers: admin.headers,
    json: { name: "Osiedle Testowe" },
  });
  return (await res.json()) as { slug: string };
};

describe("invitations", () => {
  test("an admin invites by email; the invitee sees the place and the inviter, and accepting joins the place", async () => {
    t = await setup();
    const admin = await t.signUp({ place: null });
    const { slug } = await adminPlace(admin);
    const invitee = await t.signUp({ email: "invitee@example.test", place: null });

    expect((await invite(admin, slug, "invitee@example.test")).status).toBe(201);
    const [invitation] = await invitations(invitee);
    expect(invitation).toMatchObject({ placeName: "Osiedle Testowe", inviterName: expect.any(String) });

    const accepted = await t.request(`/api/invitations/${invitation?.id}/accept`, {
      method: "POST",
      headers: invitee.headers,
    });
    expect(accepted.status).toBe(200);
    expect(await accepted.json()).toMatchObject({ slug });
    expect(await invitations(invitee)).toEqual([]);
    const places = (await (await t.request("/api/communities", { headers: invitee.headers })).json()) as {
      slug: string;
      role: string;
    }[];
    expect(places).toEqual([expect.objectContaining({ slug, role: "user" })]);
  });

  test("declining removes the invitation; nobody else sees or accepts someone else's invitation", async () => {
    t = await setup();
    const admin = await t.signUp({ place: null });
    const { slug } = await adminPlace(admin);
    const invitee = await t.signUp({ email: "decliner@example.test", place: null });
    const stranger = await t.signUp({ place: null });
    await invite(admin, slug, "decliner@example.test");
    const [invitation] = await invitations(invitee);

    expect(await invitations(stranger)).toEqual([]);
    const foreign = await t.request(`/api/invitations/${invitation?.id}/accept`, {
      method: "POST",
      headers: stranger.headers,
    });
    expect(foreign.status).toBe(404);

    const declined = await t.request(`/api/invitations/${invitation?.id}`, {
      method: "DELETE",
      headers: invitee.headers,
    });
    expect(declined.status).toBe(200);
    expect(await invitations(invitee)).toEqual([]);
  });

  test("only admins invite; an unknown email and a second invitation are refused", async () => {
    t = await setup();
    await t.seed();
    const admin = await t.signUp({ place: null });
    const { slug } = await adminPlace(admin);
    const member = await t.signUp({ place: null });
    await t.join(member, slug);
    const someone = await t.signUp({ email: "someone@example.test", place: null });

    // A plain member sees the place but may not invite to it.
    expect((await invite(member, slug, "someone@example.test")).status).toBe(403);
    expect((await invite(admin, slug, "nobody@example.test")).status).toBe(404);
    expect((await invite(admin, slug, "someone@example.test")).status).toBe(201);
    expect((await invite(admin, slug, "someone@example.test")).status).toBe(409);
    expect((await invite(admin, slug, member.email)).status).toBe(409);
    expect(await invitations(someone)).toHaveLength(1);
  });
});
