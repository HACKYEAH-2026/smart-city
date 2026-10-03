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
import { z } from "zod";
import { schema } from "../db";
import { FileInputError } from "../files/service";
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
 * in the database (plugin_sources), written to a file in `dir` and imported by Bun on the fly.
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

  /** Loads plugins stored in the database (once per process). Called before handling plugin requests. */
  ready(): Promise<void> {
    this.stored ??= (async () => {
      const rows = await this.db.select().from(schema.pluginSources);
      for (const row of rows) {
        try {
          const loaded = await this.compile(row.source);
          this.plugins.set(loaded.manifest.id, { ...loaded, origin: "uploaded" });
        } catch (err) {
          console.error(`plugin ${row.pluginId}: failed to load stored code`, err);
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

  /** Uploads (or replaces) a plugin from source code. Returns the manifest. */
  async upload(source: string): Promise<PluginManifest> {
    await this.ready();
    const loaded = await this.compile(source);
    const { id, version } = loaded.manifest;
    if (this.plugins.get(id)?.origin === "builtin") throw new PluginError(`"${id}" is a built-in plugin`);
    await this.db
      .insert(schema.pluginSources)
      .values({ pluginId: id, version, source })
      .onConflictDoUpdate({ target: schema.pluginSources.pluginId, set: { version, source, updatedAt: new Date() } });
    this.plugins.set(id, { ...loaded, origin: "uploaded" });
    return loaded.manifest;
  }

  context(plugin: LoadedPlugin, args: { installationId: string; community: PluginCommunity; user: Context["user"] }) {
    return createPluginContext(this.services, { plugin, ...args });
  }

  /** After enabling a plugin in a community: seed data (onInstall) as the system user. */
  async install(plugin: LoadedPlugin, installationId: string, community: PluginCommunity): Promise<void> {
    const onInstall = plugin.definition.onInstall;
    if (!onInstall) return;
    const ctx = this.context(plugin, { installationId, community, user: SYSTEM_USER });
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
    if (err instanceof FileInputError) throw new PluginInputError([{ path: [], message: err.message }]);
    throw new PluginError(`${plugin.manifest.id}: ${what} threw: ${(err as Error).message}`);
  }
}

export const defaultPluginsDir = () => join(tmpdir(), "twoje-miejsce-plugins");
