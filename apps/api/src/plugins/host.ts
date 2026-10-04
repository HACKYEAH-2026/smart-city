import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type Context,
  type DashboardWidgetSize,
  dashboardWidgetSchema,
  loadPlugin,
  type PluginCheck,
  PluginCheckError,
  type PluginCommunity,
  PluginError,
  type PluginManifest,
  type PluginModule,
  sameSize,
  screenSchema,
  summarize,
  type ToolResult,
  toolResultSchema,
  type UINode,
  type ViewParams,
  type WidgetFrame,
} from "@app/plugin-sdk";
import { DbError } from "@app/plugin-sdk/engine";
import { type GeometryPoint, type RecordId, surql } from "surrealdb";
import { z } from "zod";
import { first, fromGeoPoint, keyOf, ref, rows, toDate, visitRef } from "../db";
import { planPluginTables, syncPluginTables } from "../services/db/service";
import { FileInputError } from "../services/files/service";
import { checkImports, checkSafety, checkSyntax, checkTypes, failAs } from "./check";
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

/** A dashboard widget as a plugin declares it (see PluginHost.dashboardWidgets). */
export type DeclaredWidget = { name: string; title: string; size: DashboardWidgetSize; sizes: DashboardWidgetSize[] };

const uniqueSizes = (sizes: DashboardWidgetSize[]): DashboardWidgetSize[] =>
  sizes.filter((s, i) => sizes.findIndex((o) => sameSize(o, s)) === i);

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
      const stored = await rows<{ id: RecordId; source: string }>(
        this.db,
        surql`SELECT id, source FROM plugin_source;`,
      );
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

  /** Checks plugin source exactly as an upload does, without storing it or changing the database. */
  async check(source: string): Promise<PluginCheck> {
    return this.validate(source).then(summarize, (err: unknown) => {
      if (err instanceof PluginCheckError) return err.result;
      throw err;
    });
  }

  /**
   * Uploads (or replaces) a plugin from source code. Returns the manifest. The source must pass every check
   * stage (PluginCheckError otherwise); its tables are synced before it is stored, so a schema change that
   * fails to apply rejects the upload and leaves the previous version running.
   */
  async upload(source: string): Promise<PluginManifest> {
    const loaded = await this.validate(source);
    const { id, version } = loaded.manifest;
    await syncPluginTables(this.db, loaded).catch(failAs("schema"));
    await this.db.query(
      surql`UPSERT ${ref("source", id)} SET version = ${version}, source = ${source}, updated_at = time::now();`,
    );
    this.plugins.set(id, { ...loaded, origin: "uploaded" });
    return loaded.manifest;
  }

  context(
    plugin: LoadedPlugin,
    args: { installationId: string; community: PluginCommunity; user: Context["user"]; lastVisit?: Date | null },
  ) {
    return createPluginContext(this.services, { plugin, ...args });
  }

  /**
   * Enables the plugin in a community. The first installation runs its onInstall (seed data) as the
   * system user; re-enabling keeps the existing data.
   */
  async enable(plugin: LoadedPlugin, community: Omit<PluginCommunity, "location">): Promise<void> {
    await this.ready();
    const [c, id] = [ref("community", community.id), plugin.manifest.id];
    const [created] = await rows<{ id: RecordId }>(
      this.db,
      surql`UPDATE plugin_installation SET enabled = true WHERE community = ${c} AND plugin = ${id};
            INSERT IGNORE INTO plugin_installation { community: ${c}, plugin: ${id} } RETURN id;`,
    );
    const onInstall = plugin.definition.onInstall;
    if (!created || !onInstall) return;
    const ctx = this.context(plugin, {
      installationId: keyOf(created.id),
      community: await this.withLocation(community),
      user: SYSTEM_USER,
    });
    await guard(plugin, "onInstall", () => onInstall(ctx));
  }

  /** The community with its pin (`ctx.community.location`). */
  private async withLocation(community: Omit<PluginCommunity, "location">): Promise<PluginCommunity> {
    const row = await first<{ location?: GeometryPoint }>(
      this.db,
      surql`SELECT location FROM ${ref("community", community.id)};`,
    );
    return { ...community, location: row?.location ? fromGeoPoint(row.location) : null };
  }

  /** `installationId`: whose files the view may show (see signImages). */
  async renderView(
    plugin: LoadedPlugin,
    installationId: string,
    view: string,
    ctx: Context,
    params: ViewParams,
  ): Promise<UINode> {
    const fn = plugin.definition.views[view];
    if (!fn) throw new PluginError(`view_not_found:${view}`);
    const out = await guard(plugin, `view ${view}`, () => fn(ctx, params));
    const parsed = screenSchema.safeParse(out);
    if (!parsed.success) {
      throw new PluginError(
        `${plugin.manifest.id}: view "${view}" returned invalid UI: ${z.prettifyError(parsed.error)}`,
      );
    }
    return this.signImages(parsed.data, installationId, ctx.user.id);
  }

  /** A dashboard widget drawn in `frame` (it always renders; null or invalid UI is a plugin error). */
  async renderDashboardWidget(
    plugin: LoadedPlugin,
    installationId: string,
    name: string,
    ctx: Context,
    frame: WidgetFrame,
  ): Promise<UINode> {
    const widget = plugin.definition.dashboardWidgets?.[name];
    if (!widget) throw new PluginError(`dashboard_widget_not_found:${name}`);
    const out = await guard(plugin, `dashboard widget ${name}`, () => widget.render(ctx, frame));
    const parsed = dashboardWidgetSchema.safeParse(out);
    if (!parsed.success) {
      throw new PluginError(
        `${plugin.manifest.id}: dashboard widget "${name}" returned invalid UI: ${z.prettifyError(parsed.error)}`,
      );
    }
    return this.signImages(parsed.data, installationId, ctx.user.id);
  }

  /**
   * Widgets a plugin declares, in its order. `title` falls back to the plugin's name; `sizes` = every size an admin
   * may pick, the default `size` first, repeats dropped.
   */
  dashboardWidgets(plugin: LoadedPlugin): DeclaredWidget[] {
    return Object.entries(plugin.definition.dashboardWidgets ?? {}).map(([name, w]) => ({
      name,
      title: w.title ?? plugin.manifest.name,
      size: w.size,
      sizes: uniqueSizes([w.size, ...(w.sizes ?? [])]),
    }));
  }

  /** When the user last opened a view of this installation (ctx.lastVisit), or null. */
  async lastVisit(installationId: string, userId: string): Promise<Date | null> {
    const row = await first<{ at: Date | { toDate(): Date } }>(
      this.db,
      surql`SELECT at FROM ${visitRef(installationId, userId)};`,
    );
    return row ? toDate(row.at) : null;
  }

  /** Best effort: a failed write (e.g. a conflict between parallel views) only logs; the view still renders. */
  async recordVisit(installationId: string, userId: string): Promise<void> {
    await this.db
      .query(
        surql`UPSERT ${visitRef(installationId, userId)}
              SET installation = ${ref("installation", installationId)}, user = ${ref("user", userId)}, at = time::now();`,
      )
      .catch((err: unknown) => console.error(`visit ${installationId}/${userId} not recorded`, err));
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

  /**
   * Every photo in the tree gets a signed, short-lived URL (the app needn't know how files work): Image, Gallery
   * items, a Card's thumbnail, an ImagePicker's prefilled photos and a Highlight's thumbnail. Only photos this user
   * may see in this installation are signed (FileService.visible): a view can put any FileId in its tree, e.g. one
   * from its params, and a signed URL serves the file to anyone. Others stay without `url` (the app's placeholder).
   */
  private async signImages(node: UINode, installationId: string, userId: string): Promise<UINode> {
    const visible = await this.services.files.visible(installationId, userId, photosOf(node));
    const sign = <T extends { file: string }>(photo: T): T =>
      visible.has(photo.file) ? { ...photo, url: this.services.files.signedUrl(photo.file) } : photo;
    const walk = (n: UINode): UINode => {
      switch (n.type) {
        case "Image":
          return sign(n);
        case "Gallery":
          return { ...n, items: n.items.map(sign) };
        case "ImagePicker":
          return n.value ? { ...n, value: n.value.map(sign) } : n;
        case "Highlight":
          return n.image ? { ...n, image: sign(n.image) } : n;
        case "Card":
          return {
            ...n,
            ...(n.image ? { image: sign(n.image) } : {}),
            ...(n.children ? { children: n.children.map(walk) } : {}),
          };
        default:
          return "children" in n ? { ...n, children: n.children.map(walk) } : n;
      }
    };
    return walk(node);
  }

  /**
   * The check stages, cheapest first; the first failing one throws PluginCheckError. `syntax`, `imports`, `types`
   * and `safety` only read the source; `load` runs the plugin factory (in this process: docs/plugins.md, Security);
   * `schema` compares the tables with the stored shape without changing anything.
   */
  private async validate(source: string): Promise<ReturnType<typeof loadPlugin>> {
    await this.ready();
    checkSyntax(source);
    checkImports(source);
    await checkTypes(source);
    await checkSafety(source);
    const loaded = await this.compile(source).catch(failAs("load"));
    if (this.plugins.get(loaded.manifest.id)?.origin === "builtin") {
      throw new PluginCheckError("load", [{ message: `"${loaded.manifest.id}" is a built-in plugin` }]);
    }
    await planPluginTables(this.db, loaded).catch(failAs("schema"));
    return loaded;
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

/** Every FileId the tree shows as a photo (the nodes signImages signs). */
const photosOf = (node: UINode): string[] => [
  ...ownPhotos(node),
  ...("children" in node && node.children ? node.children.flatMap(photosOf) : []),
];

function ownPhotos(node: UINode): string[] {
  switch (node.type) {
    case "Image":
      return [node.file];
    case "Gallery":
      return node.items.map((item) => item.file);
    case "ImagePicker":
      return (node.value ?? []).map((photo) => photo.file);
    case "Highlight":
    case "Card":
      return node.image ? [node.image.file] : [];
    default:
      return [];
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
