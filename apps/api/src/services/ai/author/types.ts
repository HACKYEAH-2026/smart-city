import type { PluginCheck } from "@app/plugin-sdk";

/**
 * An AI that writes plugins (the plugin builder, plugins/builder.ts). Swappable: Strands Agents with the host's model
 * in production and dev (./strands.ts), a fake in tests. It gets a `check` that runs the upload's checks on a source and
 * keeps going until a source passes them; the host checks the result again before it stores anything.
 */
export interface PluginAuthor {
  write(task: AuthorTask, check: (source: string) => Promise<PluginCheck>, signal: AbortSignal): Promise<AuthorResult>;
}

/** What to write: a new plugin from a description, or a change to `previous` from the admin's feedback. */
export type AuthorTask = {
  pluginId: string;
  version: string;
  /** The place the plugin is for (name, kind), so examples and texts fit it. */
  place: { name: string; kind: string };
  request: string;
  /** For a change: the current source and the earlier requests, oldest first. */
  previous: { source: string; requests: string[] } | null;
};

/** `summary`: what was built or changed, in Polish, for the place's admin (2-4 sentences, no code). */
export type AuthorResult = { source: string; summary: string };

/** The author gave up: no source it wrote passed the checks. `last` is the last check result (for logs). */
export class AuthorError extends Error {
  constructor(readonly last: PluginCheck | null) {
    super(`no plugin source passed the checks${last?.status === "error" ? ` (last: ${last.stage})` : ""}`);
  }
}

/** Checks one author may run per version; after that the check tool tells it to stop. */
export const MAX_CHECKS = 8;
