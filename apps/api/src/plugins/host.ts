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

/** Narzędzie wymaga roli, której użytkownik nie ma (HTTP 403). */
export class ForbiddenError extends Error {}

/** Błędne wejście narzędzia — wina wywołującego, nie wtyczki (HTTP 400). */
export class PluginInputError extends Error {
  constructor(readonly issues: { path: PropertyKey[]; message: string }[]) {
    super("invalid_input");
  }
}

export type LoadedPlugin = ReturnType<typeof loadPlugin> & { origin: "builtin" | "uploaded" };

/**
 * Rejestr wtyczek. Wbudowane są rejestrowane przy starcie; wgrane przez API są zapisywane
 * w bazie (plugin_sources), kompilowane do pliku w `dir` i importowane przez Buna w locie.
 * Wtyczki wgrywa tylko administrator (kod wykonuje się w procesie API — patrz docs/plugins.md).
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

  /** Doładowuje wtyczki zapisane w bazie (raz na proces). Wołane przed obsługą żądań wtyczek. */
  ready(): Promise<void> {
    this.stored ??= (async () => {
      const rows = await this.db.select().from(schema.pluginSources);
      for (const row of rows) {
        try {
          const loaded = await this.compile(row.source);
          this.plugins.set(loaded.manifest.id, { ...loaded, origin: "uploaded" });
        } catch (err) {
          console.error(`wtyczka ${row.pluginId}: nie załadowano zapisanego kodu`, err);
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

  /** Wgrywa (albo podmienia) wtyczkę z kodu źródłowego. Zwraca manifest. */
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

  /** Po włączeniu wtyczki w społeczności: dane startowe (onInstall) jako użytkownik systemowy. */
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

  /** Węzły Image dostają podpisany, krótkotrwały URL (aplikacja nie musi znać mechanizmu plików). */
  private signImages(node: UINode): UINode {
    if (node.type === "Image") return { ...node, url: this.services.files.signedUrl(node.file) };
    if ("children" in node && node.children) {
      return { ...node, children: node.children.map((c) => this.signImages(c)) } as UINode;
    }
    return node;
  }

  private async compile(source: string): Promise<ReturnType<typeof loadPlugin>> {
    // Osobny katalog per hash treści: każda wersja to nowy moduł (import() cache'uje po ścieżce),
    // a resolver Buna nie widzi plików dopisanych do katalogu, który już raz odczytał.
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
