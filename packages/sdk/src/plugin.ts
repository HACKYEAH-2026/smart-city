import { z } from "zod";
import type { AI } from "./services/ai";
import type { Database, TableBuilders, Tables } from "./services/db";
import type { Files, fileRef } from "./services/files";
import type { ToolResult, UI, UINode, ViewParams } from "./ui";

/**
 * Plugin contract. A plugin module imports NOTHING at runtime (only `import type`):
 * its default export is a function that receives the SDK ({ definePlugin, ui, z, fileRef, t }) from the host.
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

/** The only API a plugin sees. No raw database, filesystem or network — only what the host provides. */
export type Context<TT extends Tables = Tables> = {
  user: PluginUser;
  community: PluginCommunity;
  now(): Date;
  /**
   * When this user last opened a view of this plugin in this community, before the current request
   * (null = never). Tracked by the host; widgets use it to show what is new since the last visit.
   */
  lastVisit: Date | null;
  /** "db" permission: typed clients for the plugin's declared `tables`. */
  db: Database<TT>;
  /** "files" permission. */
  files: Files;
  /** "ai" permission. */
  ai: AI;
};

// ──────────────────────────────── Plugin ────────────────────────────────

export type PluginView<TT extends Tables = Tables> = (ctx: Context<TT>, params: ViewParams) => UINode | Promise<UINode>;

/**
 * Space a widget takes on the community dashboard: a grid 2 columns wide (`w`), in rows of fixed height (`h`).
 * The app lays widgets out in plugin order; a widget never grows beyond its size (content is clipped).
 */
export const widgetSizeSchema = z.object({
  w: z.union([z.literal(1), z.literal(2)]),
  h: z.union([z.literal(1), z.literal(2), z.literal(3)]),
});
export type WidgetSize = z.infer<typeof widgetSizeSchema>;

/** Dashboard widget: a fixed size and `render` returning `ui.widget(...)` (read-only), or null to hide it. */
export type PluginWidget<TT extends Tables = Tables> = {
  size: WidgetSize;
  render: (ctx: Context<TT>) => UINode | null | Promise<UINode | null>;
};

export type Tool<S extends z.ZodType = z.ZodType, TT extends Tables = Tables> = {
  /** Description for humans and AI assistants (MCP). */
  description: string;
  input: S;
  /** Who may call it; defaults to "user". Enforced by the host (403). */
  requires?: Role;
  /** No side effects (e.g. a read for an AI assistant). */
  readOnly?: boolean;
  handler: (ctx: Context<TT>, input: z.output<S>) => ToolResult | undefined | Promise<ToolResult | undefined>;
};

/**
 * A data stream (e.g. live messages of a discussion): an async generator the host exposes to the app and to
 * AI assistants. Typically `yield* ctx.db.messages.watch({ where })` — a snapshot first, then changes.
 */
export type Stream<S extends z.ZodType = z.ZodType, TT extends Tables = Tables> = {
  description: string;
  input: S;
  requires?: Role;
  handler: (ctx: Context<TT>, input: z.output<S>) => AsyncIterable<unknown>;
};

/** A loaded plugin with its types erased (what the host works with). */
export type PluginDefinition = PluginManifestInput & {
  /** Database tables of this plugin (SurrealDB, created and extended by the host — no migration files). */
  tables?: Tables;
  // biome-ignore lint/suspicious/noExplicitAny: erased table types; typed in definePlugin
  views: Record<string, PluginView<any>>;
  /** Widgets on the community dashboard, in this order. */
  // biome-ignore lint/suspicious/noExplicitAny: erased table types; typed in definePlugin
  widgets?: Record<string, PluginWidget<any>>;
  // biome-ignore lint/suspicious/noExplicitAny: erased table types; typed in definePlugin
  tools?: Record<string, Tool<z.ZodType, any>>;
  // biome-ignore lint/suspicious/noExplicitAny: erased table types; typed in definePlugin
  streams?: Record<string, Stream<z.ZodType, any>>;
  /** Seed data after the plugin is enabled in a community (ctx.user = system, admin role). */
  // biome-ignore lint/suspicious/noExplicitAny: erased table types; typed in definePlugin
  onInstall?: (ctx: Context<any>) => void | Promise<void>;
};

/**
 * Typed identity: infers the table types from `tables`, so `ctx.db` in views, tools and onInstall is typed,
 * and preserves each tool's input type in its handler.
 */
export function definePlugin<
  const TT extends Tables = Record<never, never>,
  const TS extends Record<string, z.ZodType> = Record<never, never>,
  const TR extends Record<string, z.ZodType> = Record<never, never>,
>(
  plugin: PluginManifestInput & {
    tables?: TT;
    views: Record<string, PluginView<TT>>;
    widgets?: Record<string, PluginWidget<TT>>;
    tools?: { [K in keyof TS]: Tool<TS[K], TT> };
    streams?: { [K in keyof TR]: Stream<TR[K], TT> };
    onInstall?: (ctx: Context<TT>) => void | Promise<void>;
  },
): PluginDefinition {
  return plugin as PluginDefinition;
}

export type PluginSdk = {
  definePlugin: typeof definePlugin;
  ui: UI;
  z: typeof z;
  fileRef: typeof fileRef;
  t: TableBuilders;
};

/** Plugin module shape: `const p: PluginModule = ({ definePlugin, ui, z, fileRef, t }) => definePlugin({...})`. */
export type PluginModule = (sdk: PluginSdk) => PluginDefinition;
