import { z } from "zod";

/** Admin contracts: communities and plugin installation. */
export const communitySlugSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{1,39}$/, "Use 2-40 chars: lowercase letters, digits, hyphens");

export const communityCreateSchema = z.object({
  slug: communitySlugSchema,
  name: z.string().trim().min(1).max(80),
});
export type CommunityCreate = z.input<typeof communityCreateSchema>;

/** Kinds of place (design E-NoweMiejsceTyp); the kind helps pick dashboard widgets. */
export const PLACE_KINDS = ["estate", "building", "company", "school", "district", "other"] as const;
export type PlaceKind = (typeof PLACE_KINDS)[number];

/** Who may join a place (design E-NoweMiejsceDostep): anyone with the code, after the admin's approval, or invited. */
export const JOIN_RULES = ["open", "approval", "invite"] as const;
export type JoinRule = (typeof JOIN_RULES)[number];

/**
 * A user creates a place (the answers of the "new place" wizard). Only the name is required; the slug and the
 * invite code are made on the server, and the creator becomes the place's admin.
 */
export const newPlaceSchema = z.object({
  name: z.string().trim().min(1).max(80),
  kind: z.enum(PLACE_KINDS).default("other"),
  address: z.string().trim().max(200).default(""),
  description: z.string().trim().max(500).default(""),
  joinRule: z.enum(JOIN_RULES).default("approval"),
  /** Make it the user's default place (the first place is the default anyway). */
  makeDefault: z.boolean().default(false),
});
export type NewPlace = z.input<typeof newPlaceSchema>;

/** Invite code: 6 characters without look-alikes (no 0/O, 1/I); stored bare, shown as "ABC-DEF". */
export const INVITE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const INVITE_CODE_LENGTH = 6;
export const formatInviteCode = (code: string): string => `${code.slice(0, 3)}-${code.slice(3)}`;

export const PLUGIN_SOURCE_MAX = 200_000;
export const pluginUploadSchema = z.object({ source: z.string().min(1).max(PLUGIN_SOURCE_MAX) });
export const pluginInstallSchema = z.object({ pluginId: z.string().min(1) });
export const adminGrantSchema = z.object({ email: z.email() });

/** Plugin tool call arguments (form data + action args). */
export const toolCallSchema = z.object({ args: z.record(z.string(), z.unknown()).default({}) });

/** A place the signed-in user is a member of (GET /api/communities): membership state included. */
export type MyPlace = {
  id: string;
  slug: string;
  name: string;
  kind: PlaceKind;
  role: "admin" | "user";
  isDefault: boolean;
  lastVisitAt: string | null;
};

/** A community and its nav entry (API responses for the app). */
export type Community = { id: string; slug: string; name: string };
/** A place as its member sees it (GET /api/communities/:slug); the invite code only for its admins, else null. */
export type PlaceDetails = Community & {
  role: "admin" | "user";
  kind: PlaceKind;
  address: string;
  description: string;
  joinRule: JoinRule;
  inviteCode: string | null;
};
/** Answer to creating a place: the new place and its invite code. */
export type CreatedPlace = Community & { inviteCode: string };
export type CommunityNavItem = { pluginId: string; icon: string; view: string; label: string };

/** Dashboard widget order set by a community admin: "<pluginId>/<widget>" keys, first = top left. */
export const dashboardOrderSchema = z.object({
  order: z.array(z.string().min(3).max(100)).max(100),
});
export type DashboardOrder = z.input<typeof dashboardOrderSchema>;
