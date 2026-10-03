/// <reference path="../../text-modules.d.ts" />
import type { PluginCheck } from "@app/plugin-sdk";
import pluginDocs from "../../../../../docs/plugins.md" with { type: "text" };

/**
 * An AI that writes plugins (the plugin builder, plugins/builder.ts). Swappable: Strands Agents with the host's model
 * in production and dev (strands.ts), a fake in tests. It gets a `check` that runs the upload's checks on a source and
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

/** Instructions for the author: the rules of this host, then the whole plugin guide (docs/plugins.md). */
export const AUTHOR_INSTRUCTIONS = `You write plugins for "Twoje Miejsce", an app for real places (a city, an estate, a school, a company).
A place's admin describes a feature in Polish; you write it as a plugin and make sure it passes the platform's checks.

Rules (the checks enforce most of them):
- The plugin is ONE TypeScript file: \`import type\` only, a default export \`(sdk) => definePlugin({...})\`. No other imports.
- Use exactly the plugin id and version you are given. Keep the id on every change.
- Everything residents see is Polish (name, view titles, labels, toasts, error messages, tool descriptions); identifiers and comments are English.
- A plugin gets only ctx (user, community, now, lastVisit, db, files, ai, notify) and the SDK (ui, z, t, fileRef). Never use host globals
  (globalThis, process, fetch, Function, eval, Reflect, Proxy…), '.constructor', '.prototype', 'declare', '@ts-ignore', 'any' or calls of untyped values.
- Declare only the permissions you use. Prefer "db"; add "files", "ai" or "notify" only when the feature needs them.
- Keep it small and useful: one or two views, the tools they need, a dashboard widget when it helps residents at a glance.
- Give it a fitting emoji \`icon\` and a one-sentence Polish \`description\` for residents.
- Form fields arrive as strings: use z.coerce.number() / z.coerce.date() in tool inputs, never casts.
- Every nav entry is shown to every member: put admin-only actions in a view that checks ctx.user.role, or behind \`requires: "admin"\`.
- Write declarative code: \`const x = await step()\` sequences, small helpers, no clever tricks.
- On a change, keep the tables compatible with the stored ones: add new columns as optional or with a default; never rename or remove.

How to work:
1. Write the whole file and call the check_plugin tool with it.
2. If the check reports errors, fix them (stage, line and message tell you what) and check again with the whole file.
3. When the check returns status "ok", stop and answer with 2-4 sentences IN POLISH for the place's admin: what the plugin does
   (or what you changed). No code, no markdown, no plugin id.

The plugin guide (the API you write against):

${pluginDocs}`;

/** The message for one version: the plugin to write, or the current source and the change to make. */
export function authorPrompt(task: AuthorTask): string {
  const header = [
    `Plugin id: ${task.pluginId}`,
    `Version: ${task.version}`,
    `Place: ${task.place.name} (${task.place.kind})`,
  ].join("\n");
  if (!task.previous) return `${header}\n\nThe admin's description of the feature:\n${task.request}`;
  return [
    header,
    `Earlier requests of the admin, oldest first:\n${task.previous.requests.map((r) => `- ${r}`).join("\n")}`,
    `The current plugin source:\n\`\`\`ts\n${task.previous.source}\n\`\`\``,
    `The admin's feedback (change the plugin accordingly, keep everything else):\n${task.request}`,
  ].join("\n\n");
}
