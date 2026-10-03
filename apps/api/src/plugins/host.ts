import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Db } from "@app/db";
import { schema } from "@app/db";
import {
  definePlugin,
  type PluginContext,
  type PluginDefinition,
  type PluginManifest,
  type PluginModule,
  pluginManifestSchema,
  screenSchema,
  type ToolResult,
  toolResultSchema,
  type UINode,
  ui,
  type ViewParams,
} from "@app/shared";
import { z } from "zod";

/** Błąd po stronie wtyczki (zły manifest, wyjątek w widoku, niepoprawny wynik). Komunikat jest bezpieczny dla admina. */
export class PluginError extends Error {}

/** Błędne wejście narzędzia — wina wywołującego, nie wtyczki (HTTP 400). */
export class PluginInputError extends Error {
  constructor(readonly issues: z.core.$ZodIssue[]) {
    super("invalid_input");
  }
}

export type LoadedPlugin = {
  manifest: PluginManifest;
  definition: PluginDefinition;
  origin: "builtin" | "uploaded";
};

const sdk = { definePlugin, ui, z };

/** Wywołuje moduł wtyczki z SDK i sprawdza manifest oraz spójność (nav → istniejące widoki). */
export function instantiate(mod: unknown): Omit<LoadedPlugin, "origin"> {
  if (typeof mod !== "function") throw new PluginError("Plugin module must export a default function (sdk) => plugin");
  let definition: PluginDefinition;
  try {
    definition = (mod as PluginModule)(sdk);
  } catch (err) {
    throw new PluginError(`Plugin factory threw: ${(err as Error).message}`);
  }
  if (!definition || typeof definition !== "object")
    throw new PluginError("Plugin factory must return definePlugin({...})");
  const parsed = pluginManifestSchema.safeParse(definition);
  if (!parsed.success) throw new PluginError(`Invalid manifest: ${z.prettifyError(parsed.error)}`);
  const manifest = parsed.data;
  if (!definition.views || typeof definition.views !== "object") throw new PluginError("Plugin must define views");
  for (const entry of manifest.nav) {
    if (typeof definition.views[entry.view] !== "function") {
      throw new PluginError(`Nav entry "${entry.label}" points to missing view "${entry.view}"`);
    }
  }
  for (const [name, tool] of Object.entries(definition.tools ?? {})) {
    if (typeof tool?.handler !== "function" || !(tool.input instanceof z.ZodType)) {
      throw new PluginError(`Tool "${name}" must have an input schema (z.object) and a handler`);
    }
  }
  return { manifest, definition };
}

/**
 * Rejestr wtyczek. Wbudowane są rejestrowane przy starcie; wgrane przez API są zapisywane
 * w bazie (plugin_sources), kompilowane do pliku w `dir` i importowane przez Buna w locie.
 * Wtyczki wgrywa tylko administrator (kod wykonuje się w procesie API — patrz docs/plugins.md).
 */
export class PluginHost {
  private readonly plugins = new Map<string, LoadedPlugin>();
  private stored?: Promise<void>;

  constructor(
    private readonly db: Db,
    private readonly dir: string,
    builtins: PluginModule[],
  ) {
    for (const mod of builtins) {
      const loaded = instantiate(mod);
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

  async renderView(plugin: LoadedPlugin, view: string, ctx: PluginContext, params: ViewParams): Promise<UINode> {
    const fn = plugin.definition.views[view];
    if (!fn) throw new PluginError(`view_not_found:${view}`);
    const out = await guard(plugin, `view ${view}`, () => fn(ctx, params));
    const parsed = screenSchema.safeParse(out);
    if (!parsed.success) {
      throw new PluginError(
        `${plugin.manifest.id}: view "${view}" returned invalid UI: ${z.prettifyError(parsed.error)}`,
      );
    }
    return parsed.data;
  }

  async callTool(plugin: LoadedPlugin, name: string, ctx: PluginContext, args: unknown): Promise<ToolResult> {
    const tool = plugin.definition.tools?.[name];
    if (!tool) throw new PluginError(`tool_not_found:${name}`);
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

  private async compile(source: string): Promise<Omit<LoadedPlugin, "origin">> {
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
    return instantiate(mod.default);
  }
}

async function guard<T>(plugin: LoadedPlugin, what: string, fn: () => T | Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof PluginError || err instanceof PluginInputError) throw err;
    throw new PluginError(`${plugin.manifest.id}: ${what} threw: ${(err as Error).message}`);
  }
}

export const defaultPluginsDir = () => join(tmpdir(), "twoje-miejsce-plugins");
