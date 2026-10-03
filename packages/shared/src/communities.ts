import { type GeoPoint, geoPointSchema } from "@app/plugin-sdk";
import { z } from "zod";
import type { PluginCatalogItem } from "./plugins";

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
/** What describes a place: the wizard (newPlaceSchema) asks for it, its admins change it (placeUpdateSchema). */
const placeFields = {
  name: z.string().trim().min(1).max(80),
  kind: z.enum(PLACE_KINDS),
  address: z.string().trim().max(200),
  description: z.string().trim().max(500),
  joinRule: z.enum(JOIN_RULES),
  /** The place's pin on the map (null = none). */
  location: geoPointSchema.nullable(),
  /** Shown on the map of places to every signed-in user (only with a location); members always see it there. */
  onMap: z.boolean(),
};

export const newPlaceSchema = z.object({
  name: placeFields.name,
  kind: placeFields.kind.default("other"),
  address: placeFields.address.default(""),
  description: placeFields.description.default(""),
  joinRule: placeFields.joinRule.default("approval"),
  location: placeFields.location.default(null),
  onMap: placeFields.onMap.default(false),
  /** Make it the user's default place (the first place is the default anyway). */
  makeDefault: z.boolean().default(false),
  /** Built-in plugins to enable in the place (ids from GET /api/plugins); its navigation keeps this order. */
  plugins: z.array(z.string().min(1).max(64)).max(20).default([]),
});
export type NewPlace = z.input<typeof newPlaceSchema>;

/** A place's admin changes its settings (PATCH /api/communities/:slug): any of them; the slug stays. */
export const placeUpdateSchema = z.object(placeFields).partial();
export type PlaceUpdate = z.input<typeof placeUpdateSchema>;

/** A member of a place as its admins see it (GET /api/communities/:slug/members): admins first, then by name. */
export type PlaceMember = { id: string; name: string; email: string; role: "admin" | "user" };

/**
 * A plugin of the place and whether it is on (GET /api/communities/:slug/plugins), for its admins: a built-in one, or
 * one the AI wrote for this place (`madeByAi`, the plugin builder). A `draft` was never published: it cannot be
 * switched on, and its name and icon are those of its latest ready version (the first request while none is ready).
 * `working`: the AI is writing a version of it right now.
 */
export type PlacePlugin = PluginCatalogItem & { enabled: boolean; madeByAi: boolean; draft: boolean; working: boolean };
/** A place's admin switches one of its plugins on or off (PUT /api/communities/:slug/plugins/:pluginId). */
export const pluginSwitchSchema = z.object({ enabled: z.boolean() });

/** Invite code: 6 characters without look-alikes (no 0/O, 1/I); stored bare, shown as "ABC-DEF". */
export const INVITE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const INVITE_CODE_LENGTH = 6;
export const formatInviteCode = (code: string): string => `${code.slice(0, 3)}-${code.slice(3)}`;

/**
 * An invite code as typed or scanned ("abc-def", " ABCDEF "): the bare code, or null when it is not one.
 * Look-alikes (0/O, 1/I) are not in the alphabet, so they are rejected.
 */
export function parseInviteCode(raw: string): string | null {
  const code = raw.trim().toUpperCase().replaceAll("-", "");
  const valid = code.length === INVITE_CODE_LENGTH && [...code].every((ch) => INVITE_CODE_ALPHABET.includes(ch));
  return valid ? code : null;
}

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
  location: GeoPoint | null;
  onMap: boolean;
  inviteCode: string | null;
};
/** A place as someone holding its invite code sees it before joining (GET /api/communities/invite/:code). */
export type PlacePreview = { name: string; kind: PlaceKind; address: string; description: string; joinRule: JoinRule };
/** Joining a place by its invite code (POST /api/communities/join); the place becomes the user's last visited one. */
export const joinPlaceSchema = z.object({
  code: z.string().min(1).max(20),
  makeDefault: z.boolean().default(false),
});
export type JoinPlace = z.input<typeof joinPlaceSchema>;
/** An invitation to a place, as its invitee sees it (GET /api/invitations). */
export type Invitation = {
  id: string;
  placeName: string;
  placeKind: PlaceKind;
  inviterName: string;
  createdAt: string;
};
/** An admin invites a user to a place by the email the user signed up with (POST /api/invitations). */
export const inviteSchema = z.object({
  slug: z.string().min(1).max(100),
  email: z.string().trim().toLowerCase().email().max(200),
});
export type Invite = z.input<typeof inviteSchema>;
/** Answer to creating a place: the new place and its invite code. */
export type CreatedPlace = Community & { inviteCode: string };
export type CommunityNavItem = { pluginId: string; icon: string; view: string; label: string };

/** Dashboard widget order set by a community admin: "<pluginId>/<widget>" keys, first = top left. */
export const dashboardOrderSchema = z.object({
  order: z.array(z.string().min(3).max(100)).max(100),
});
export type DashboardOrder = z.input<typeof dashboardOrderSchema>;
