import { z } from "zod";

/** Kontrakty administracyjne: społeczności i instalacja wtyczek. */
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

/** Argumenty wywołania narzędzia wtyczki (dane formularza + args z akcji). */
export const toolCallSchema = z.object({ args: z.record(z.string(), z.unknown()).default({}) });
