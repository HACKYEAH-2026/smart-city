import { z } from "zod";
import type { ToolResult, UI, UINode, ViewParams } from "./ui";

/**
 * Plugin contract. A plugin module imports NOTHING at runtime (only `import type`):
 * its default export is a function that receives the SDK ({ definePlugin, ui, z, fileRef }) from the host.
 * This way the same file works as a built-in plugin and as a plugin uploaded at runtime via the API,
 * and can later run in isolation (Worker/WASM) without changes to the plugin code.
 */

export const PLUGIN_PERMISSIONS = ["storage", "files", "ai"] as const;
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

// ─────────────────────────────── Storage ────────────────────────────────

/** A document in plugin storage. `data` is arbitrary plugin JSON. */
export type Doc<T = Record<string, unknown>> = {
  id: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  data: T;
};

export type Query<T> = {
  /** Equality on top-level `data` fields (string, number, boolean). */
  where?: Partial<T>;
  order?: "newest" | "oldest";
  limit?: number;
};

/**
 * Document store. Always scoped to ONE installation (plugin × community):
 * a plugin has no way to read data of another community or another plugin.
 */
export interface Storage {
  get<T = Record<string, unknown>>(collection: string, id: string): Promise<Doc<T> | null>;
  list<T = Record<string, unknown>>(collection: string, query?: Query<T>): Promise<Doc<T>[]>;
  /** New document with a generated id. */
  create<T extends Record<string, unknown>>(collection: string, data: T): Promise<Doc<T>>;
  /** Write under a key (id = key): creates or overwrites. The database guarantees uniqueness (e.g. one vote per person). */
  upsert<T extends Record<string, unknown>>(collection: string, key: string, data: T): Promise<Doc<T>>;
  /** Shallow merge of `patch` fields into the existing `data`. */
  update<T = Record<string, unknown>>(collection: string, id: string, patch: Partial<T>): Promise<Doc<T> | null>;
  remove(collection: string, id: string): Promise<boolean>;
}

// ──────────────────────────────── Files ─────────────────────────────────

/** Id of a file uploaded by the app (POST …/files). A plugin never sees the bytes or the disk. */
export type FileId = string & { readonly __brand: "FileId" };
export const FILE_ID = /^file_[0-9a-f-]{36}$/;
export const fileRef = () =>
  z
    .string()
    .regex(FILE_ID, "Invalid file id")
    .transform((v) => v as FileId);

export type FileInfo = { mime: string; size: number };

export interface Files {
  /** Confirms this user's upload in this plugin. Unconfirmed files disappear after 24 h. */
  keep(id: FileId): Promise<void>;
  info(id: FileId): Promise<FileInfo>;
  remove(id: FileId): Promise<void>;
}

// ───────────────────────────────── AI ──────────────────────────────────

export type AICall<S extends z.ZodType | undefined = undefined> = {
  prompt: string;
  images?: FileId[];
  /** With a schema the response is a validated object; without one — text. */
  schema?: S;
};

export type SimilarOptions<T> = {
  text: (doc: Doc<T>) => string;
  image?: (doc: Doc<T>) => FileId | undefined;
  limit?: number;
};

export type SimilarMatch<T> = { doc: Doc<T>; score: number; reason: string };

export interface AI {
  call<S extends z.ZodType | undefined = undefined>(
    req: AICall<S>,
  ): Promise<S extends z.ZodType ? z.output<S> : string>;
  /** Semantically similar documents (most similar first); empty list = none similar. */
  findSimilar<T>(
    query: { text: string; image?: FileId },
    candidates: Doc<T>[],
    opts: SimilarOptions<T>,
  ): Promise<SimilarMatch<T>[]>;
}

// ─────────────────────────────── Context ────────────────────────────────

export type PluginUser = { id: string; name: string; role: Role };
export type PluginCommunity = { id: string; slug: string; name: string };

/** The only API a plugin sees. No database, filesystem or network — only what the host provides. */
export type Context = {
  user: PluginUser;
  community: PluginCommunity;
  now(): Date;
  /** "storage" permission. */
  storage: Storage;
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
