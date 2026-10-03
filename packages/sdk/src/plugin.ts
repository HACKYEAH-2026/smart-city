import { z } from "zod";
import type { AI } from "./ai";
import type { Database } from "./db";
import type { Files, fileRef } from "./files";
import type { ToolResult, UI, UINode, ViewParams } from "./ui";

/**
 * Plugin contract. A plugin module imports NOTHING at runtime (only `import type`):
 * its default export is a function that receives the SDK ({ definePlugin, ui, z, fileRef }) from the host.
 * This way the same file works as a built-in plugin and as a plugin uploaded at runtime via the API,
 * and can later run in isolation (Worker/WASM) without changes to the plugin code.
 */

export const PLUGIN_PERMISSIONS = ["db", "files", "ai"] as const;
export type Permission = (typeof PLUGIN_PERMISSIONS)[number];

export const ROLES = ["admin", "user"] as const;
export type Role = (typeof ROLES)[number];

const id = z
  .string()
  .regex(/^[a-z][a-z0-9-]{1,39}$/, "Use 2-40 chars: lowercase letters, digits, hyphens; start with a letter");

export const pluginManifestSchema = z.object({
  id,
  name: z.string().trim().min(1).max(60),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "Use semver, e.g. 1.0.0"),
  icon: z.string().max(8).default("🧩"),
  description: z.string().max(280).default(""),
  permissions: z.array(z.enum(PLUGIN_PERMISSIONS)).default([]),
  /** Community navigation entries; each points to a plugin view. */
  nav: z.array(z.object({ view: z.string().min(1), label: z.string().min(1).max(40) })).min(1),
});
export type PluginManifest = z.output<typeof pluginManifestSchema>;
export type PluginManifestInput = z.input<typeof pluginManifestSchema>;

// ─────────────────────────────── Context ────────────────────────────────

export type PluginUser = { id: string; name: string; role: Role };
export type PluginCommunity = { id: string; slug: string; name: string };

/** The only API a plugin sees. No database, filesystem or network — only what the host provides. */
export type Context = {
  user: PluginUser;
  community: PluginCommunity;
  now(): Date;
  /** "db" permission. */
  db: Database;
  /** "files" permission. */
  files: Files;
  /** "ai" permission. */
  ai: AI;
};

// ──────────────────────────────── Plugin ────────────────────────────────

export type PluginView = (ctx: Context, params: ViewParams) => UINode | Promise<UINode>;

export type Tool<S extends z.ZodType = z.ZodType> = {
  /** Description for humans and AI assistants (MCP). */
  description: string;
  input: S;
  /** Who may call it; defaults to "user". Enforced by the host (403). */
  requires?: Role;
  /** No side effects (e.g. a read for an AI assistant). */
  readOnly?: boolean;
  handler: (ctx: Context, input: z.output<S>) => ToolResult | undefined | Promise<ToolResult | undefined>;
};

export type PluginDefinition = PluginManifestInput & {
  views: Record<string, PluginView>;
  tools?: Record<string, Tool>;
  /** Seed data after the plugin is enabled in a community (ctx.user = system, admin role). */
  onInstall?: (ctx: Context) => void | Promise<void>;
};

/** Typed identity: preserves each tool's input type in its handler. */
export function definePlugin<T extends Record<string, z.ZodType>>(
  plugin: Omit<PluginDefinition, "tools"> & { tools?: { [K in keyof T]: Tool<T[K]> } },
): PluginDefinition {
  return plugin as PluginDefinition;
}
export type PluginSdk = { definePlugin: typeof definePlugin; ui: UI; z: typeof z; fileRef: typeof fileRef };

/** Plugin module shape: `const p: PluginModule = ({ definePlugin, ui, z, fileRef }) => definePlugin({...})`. */
export type PluginModule = (sdk: PluginSdk) => PluginDefinition;
