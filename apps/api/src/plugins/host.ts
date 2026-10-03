import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type Context,
  loadPlugin,
  type PluginCommunity,
  PluginError,
  type PluginManifest,
  type PluginModule,
  screenSchema,
  type ToolResult,
  toolResultSchema,
  type UINode,
  type ViewParams,
} from "@app/plugin-sdk";
import { DbError, SchemaError } from "@app/plugin-sdk/engine";
import type { RecordId } from "surrealdb";
import { z } from "zod";
import { keyOf, ref, rows } from "../db";
import { syncPluginTables } from "../services/db/service";
import { FileInputError } from "../services/files/service";
import { createPluginContext, type PluginServices, SYSTEM_USER } from "./context";

export { PluginError };

/** The tool requires a role the user doesn't have (HTTP 403). */
export class ForbiddenError extends Error {}

/** Invalid tool input — the caller's fault, not the plugin's (HTTP 400). */
export class PluginInputError extends Error {
  constructor(readonly issues: { path: PropertyKey[]; message: string }[]) {
    super("invalid_input");
  }
}

export type LoadedPlugin = ReturnType<typeof loadPlugin> & { origin: "builtin" | "uploaded" };

/**
 * Plugin registry. Built-ins are registered at startup; plugins uploaded via the API are stored
 * in the database (plugin_source), written to a file in `dir` and imported by Bun on the fly.
 * Only an administrator uploads plugins (the code runs in the API process — see docs/plugins.md).
 */
export class PluginHost {
  private readonly plugins = new Map<string, LoadedPlugin>();
  private stored?: Promise<void>;

  private readonly db: PluginServices["db"];

  constructor(
    private readonly services: PluginServices,
    private readonly dir: string,
    builtins: PluginModule[],
  ) {
    this.db = services.db;
    for (const mod of builtins) {
      const loaded = loadPlugin(mod);
      this.plugins.set(loaded.manifest.id, { ...loaded, origin: "builtin" });
    }
  }

  /**
   * Once per process, before handling plugin requests: syncs the tables of built-in plugins and loads
   * (and syncs) plugins stored in the database. A stored plugin that fails to load is skipped and logged.
   */
  ready(): Promise<void> {
    this.stored ??= (async () => {
      for (const plugin of this.plugins.values()) await syncPluginTables(this.db, plugin);
      const stored = await rows<{ id: RecordId; source: string }>(this.db, "SELECT id, source FROM plugin_source;");
      for (const row of stored) {
        try {
          const loaded = await this.compile(row.source);
          await syncPluginTables(this.db, loaded);
          this.plugins.set(loaded.manifest.id, { ...loaded, origin: "uploaded" });
        } catch (err) {
          console.error(`plugin ${keyOf(row.id)}: failed to load stored code`, err);
        }
      }
    })();
    return this.stored;
  }

  get(id: string): LoadedPlugin | undefined {
    return this.plugins.get(id);
  }

  list(): LoadedPlugin[] {
    return [...this.plugins.values()];
  }

  /**
   * Uploads (or replaces) a plugin from source code. Returns the manifest. Its tables are synced first:
   * a breaking schema change rejects the upload and leaves the previous version running.
   */
  async upload(source: string): Promise<PluginManifest> {
    await this.ready();
    const loaded = await this.compile(source);
    const { id, version } = loaded.manifest;
    if (this.plugins.get(id)?.origin === "builtin") throw new PluginError(`"${id}" is a built-in plugin`);
    await syncPluginTables(this.db, loaded).catch((err) => {
      throw err instanceof SchemaError ? new PluginError(err.message) : err;
    });
    await this.db.query("UPSERT $r SET version = $version, source = $source, updated_at = time::now();", {
      r: ref("source", id),
      version,
      source,
    });
    this.plugins.set(id, { ...loaded, origin: "uploaded" });
    return loaded.manifest;
  }

  context(plugin: LoadedPlugin, args: { installationId: string; community: PluginCommunity; user: Context["user"] }) {
    return createPluginContext(this.services, { plugin, ...args });
  }

  /**
   * Enables the plugin in a community. The first installation runs its onInstall (seed data) as the
   * system user; re-enabling keeps the existing data.
   */
  async enable(plugin: LoadedPlugin, community: PluginCommunity): Promise<void> {
    await this.ready();
    const vars = { c: ref("community", community.id), plugin: plugin.manifest.id };
    const [created] = await rows<{ id: RecordId }>(
      this.db,
      `UPDATE plugin_installation SET enabled = true WHERE community = $c AND plugin = $plugin;
       INSERT IGNORE INTO plugin_installation { community: $c, plugin: $plugin } RETURN id;`,
      vars,
    );
    const onInstall = plugin.definition.onInstall;
    if (!created || !onInstall) return;
    const ctx = this.context(plugin, { installationId: keyOf(created.id), community, user: SYSTEM_USER });
    await guard(plugin, "onInstall", () => onInstall(ctx));
  }

  async renderView(plugin: LoadedPlugin, view: string, ctx: Context, params: ViewParams): Promise<UINode> {
    const fn = plugin.definition.views[view];
    if (!fn) throw new PluginError(`view_not_found:${view}`);
    const out = await guard(plugin, `view ${view}`, () => fn(ctx, params));
    const parsed = screenSchema.safeParse(out);
    if (!parsed.success) {
      throw new PluginError(
        `${plugin.manifest.id}: view "${view}" returned invalid UI: ${z.prettifyError(parsed.error)}`,
      );
    }
    return this.signImages(parsed.data);
  }

  async callTool(plugin: LoadedPlugin, name: string, ctx: Context, args: unknown): Promise<ToolResult> {
    const tool = plugin.definition.tools?.[name];
    if (!tool) throw new PluginError(`tool_not_found:${name}`);
    if (tool.requires === "admin" && ctx.user.role !== "admin") throw new ForbiddenError(`${name} requires admin`);
    const input = tool.input.safeParse(args);
    if (!input.success) throw new PluginInputError(input.error.issues);
    const out = (await guard(plugin, `tool ${name}`, () => tool.handler(ctx, input.data))) ?? {};
    const parsed = toolResultSchema.safeParse(out);
    if (!parsed.success) {
      throw new PluginError(
        `${plugin.manifest.id}: tool "${name}" returned invalid result: ${z.prettifyError(parsed.error)}`,
      );
    }
    return parsed.data;
  }

  /** Image nodes get a signed, short-lived URL (the app needn't know how files work). */
  private signImages(node: UINode): UINode {
    if (node.type === "Image") return { ...node, url: this.services.files.signedUrl(node.file) };
    if ("children" in node && node.children) {
      return { ...node, children: node.children.map((c) => this.signImages(c)) } as UINode;
    }
    return node;
  }

  private async compile(source: string): Promise<ReturnType<typeof loadPlugin>> {
    // Separate directory per content hash: each version is a new module (import() caches by path),
    // and Bun's resolver doesn't see files added to a directory it has already read.
    const dir = join(this.dir, Bun.hash(source).toString(16));
    mkdirSync(dir, { recursive: true });
    const file = join(dir, "plugin.ts");
    writeFileSync(file, source);
    let mod: { default?: unknown };
    try {
      mod = await import(file);
    } catch (err) {
      throw new PluginError(`Plugin source does not compile: ${(err as Error).message}`);
    }
    return loadPlugin(mod.default);
  }
}

async function guard<T>(plugin: LoadedPlugin, what: string, fn: () => T | Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof PluginError || err instanceof PluginInputError || err instanceof ForbiddenError) throw err;
    if (err instanceof FileInputError || err instanceof DbError) {
      throw new PluginInputError([{ path: [], message: err.message }]);
    }
    throw new PluginError(`${plugin.manifest.id}: ${what} threw: ${(err as Error).message}`);
  }
}

export const defaultPluginsDir = () => join(tmpdir(), "twoje-miejsce-plugins");
