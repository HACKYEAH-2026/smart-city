import { z } from "zod";

/**
 * Plugins the AI writes for a place (the plugin builder: Zarządzaj miejscem → Pluginy → "Stwórz plugin z AI"). The AI
 * makes a plugin from the admin's description, and every later request of the admin changes it: each request is a
 * version the AI writes in the background and checks like an upload. Until its first publication the plugin is a
 * draft that only the place's admins see; publishing installs its latest ready version in the place. A published
 * plugin can still be changed: the next version runs in the place once it is published, and the data stays.
 */
export const pluginRequestSchema = z.object({
  /** What the plugin should do (the first version) or what to change (later ones), in the admin's words. */
  request: z.string().trim().min(10).max(2000),
});
export type PluginRequest = z.input<typeof pluginRequestSchema>;

export const VERSION_STATUSES = ["working", "ready", "failed"] as const;
export type VersionStatus = (typeof VERSION_STATUSES)[number];

/**
 * Why a version failed: no model on the server, the AI could not write source that passes the checks, it ran out of
 * time, or something else broke.
 */
export const VERSION_ERRORS = ["ai_unavailable", "check_failed", "timeout", "internal"] as const;
export type VersionError = (typeof VERSION_ERRORS)[number];

/** What a ready version declares (from its check), shown to the admin before publishing. */
export type PluginOutline = {
  name: string;
  icon: string;
  description: string;
  views: string[];
  tools: string[];
  tables: string[];
  dashboardWidgets: string[];
};

export type PluginVersion = {
  /** 1, 2, 3… in the order the admin asked. */
  n: number;
  request: string;
  status: VersionStatus;
  /** How many times the AI has checked its source so far (progress while working). */
  attempts: number;
  /** The AI's account of what it built or changed (Polish, for the admin); null until ready. */
  summary: string | null;
  outline: PluginOutline | null;
  /** The plugin's source (one TypeScript file) once ready. */
  source: string | null;
  error: VersionError | null;
  createdAt: string;
};

/** A plugin the AI writes for the place (GET /api/communities/:slug/plugins/:pluginId), with its versions. */
export type AiPlugin = {
  /** The plugin's id (generated, unique): its navigation and data in the place go by it. */
  id: string;
  /** Status of the latest version. */
  status: VersionStatus;
  /** The version running in the place; null while the plugin is a draft (never published). */
  published: number | null;
  /** Oldest first. */
  versions: PluginVersion[];
};
