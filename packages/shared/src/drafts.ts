import { z } from "zod";

/**
 * Plugins written by AI for a place ("Stwórz plugin z AI" in Zarządzaj miejscem). A draft is one plugin; each
 * request of the place's admin (the first description, then feedback) is a revision the AI writes in the background
 * and checks like an upload. The admin publishes a ready revision: the plugin is installed and on in that place.
 */
export const draftRequestSchema = z.object({
  /** What the plugin should do (first revision) or what to change (later ones), in the admin's words. */
  request: z.string().trim().min(10).max(2000),
});
export type DraftRequest = z.input<typeof draftRequestSchema>;

export const DRAFT_STATUSES = ["working", "ready", "failed"] as const;
export type DraftStatus = (typeof DRAFT_STATUSES)[number];

/**
 * Why a revision failed: no model on the server, the AI could not write source that passes the checks, it ran out
 * of time, or something else broke.
 */
export const DRAFT_ERRORS = ["ai_unavailable", "check_failed", "timeout", "internal"] as const;
export type DraftError = (typeof DRAFT_ERRORS)[number];

/** What a ready revision's plugin declares (from its check), shown to the admin before publishing. */
export type DraftPlugin = {
  name: string;
  icon: string;
  description: string;
  views: string[];
  tools: string[];
  tables: string[];
  dashboardWidgets: string[];
};

export type DraftRevision = {
  /** 1, 2, 3… in the order the admin asked. */
  n: number;
  request: string;
  status: DraftStatus;
  /** How many times the AI has checked its source so far (progress while working). */
  attempts: number;
  /** The AI's account of what it built or changed (Polish, for the admin); null until ready. */
  summary: string | null;
  plugin: DraftPlugin | null;
  /** The plugin's source (one TypeScript file) once ready. */
  source: string | null;
  error: DraftError | null;
  createdAt: string;
};

export type PluginDraft = {
  id: string;
  /** The plugin's id (generated, unique): its navigation and data in the place go by it. */
  pluginId: string;
  /** Status of the latest revision. */
  status: DraftStatus;
  /** The revision running in the place, or null when never published. */
  published: number | null;
  /** Oldest first. */
  revisions: DraftRevision[];
};

/** A draft in the place's list (GET /api/communities/:slug/drafts), newest first. */
export type PluginDraftItem = {
  id: string;
  pluginId: string;
  /** The latest ready revision's plugin name, else the first request. */
  title: string;
  icon: string | null;
  status: DraftStatus;
  published: number | null;
  revisions: number;
};
