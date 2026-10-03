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

export const PLUGIN_SOURCE_MAX = 200_000;
export const pluginUploadSchema = z.object({ source: z.string().min(1).max(PLUGIN_SOURCE_MAX) });
export const pluginInstallSchema = z.object({ pluginId: z.string().min(1) });
export const adminGrantSchema = z.object({ email: z.email() });

/** Plugin tool call arguments (form data + action args). */
export const toolCallSchema = z.object({ args: z.record(z.string(), z.unknown()).default({}) });

/** A community and its nav entry (API responses for the app). */
export type Community = { id: string; slug: string; name: string };
export type CommunityNavItem = { pluginId: string; icon: string; view: string; label: string };

/** Dashboard widget order set by a community admin: "<pluginId>/<widget>" keys, first = top left. */
export const dashboardOrderSchema = z.object({
  order: z.array(z.string().min(3).max(100)).max(100),
});
export type DashboardOrder = z.input<typeof dashboardOrderSchema>;
