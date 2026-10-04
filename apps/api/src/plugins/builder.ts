import type { PluginCheck } from "@app/plugin-sdk";
import type { AiPlugin, PluginOutline, PluginVersion, VersionError, VersionStatus } from "@app/shared";
import { type RecordId, surql } from "surrealdb";
import { type CommunityRow, type Db, first, keyOf, ref, rows, toCommunity, toDate } from "../db";
import { logger, withLogFields } from "../log";
import { AuthorError, type AuthorTask, type PluginAuthor } from "../services/ai/author/types";
import type { PluginHost } from "./host";

/** A version still "working" this long after it started died with its process (a restart): it reads as failed. */
const VERSION_TIMEOUT_MS = 5 * 60_000;
const STALE_AFTER_MS = VERSION_TIMEOUT_MS + 60_000;
/** Requests to the AI one place may make in 24 hours (each one costs model calls). */
export const REQUESTS_PER_DAY = 20;

const log = logger("builder");

type PluginRow = { id: RecordId; published?: number };
type VersionRow = {
  id: RecordId;
  n: number;
  request: string;
  status: VersionStatus;
  attempts: number;
  summary?: string;
  source?: string;
  outline?: PluginOutline;
  error?: VersionError;
  created_at: Date | { toDate(): Date };
};

/** An AI plugin of the place as its plugin list shows it (routes/placeAdmin.ts). */
export type OwnedPlugin = {
  id: string;
  published: number | null;
  /** The published version's outline, else the latest ready one's; null while no version is ready. */
  outline: PluginOutline | null;
  /** The first request (what the plugin is for, until a version is ready). */
  request: string;
  working: boolean;
};

/**
 * The plugin builder: the AI (PluginAuthor) writes plugins for a place. The admin's description makes a plugin (a
 * draft until it is first published), every later request changes it; each request is a version written in the
 * background and checked like an upload. Publishing installs the latest ready version in the place (again after
 * changes: the plugin is replaced, its data stays). Plugins and their versions' source live in the database
 * (place_plugin, plugin_version); a published plugin is an uploaded plugin (plugin_source) whose generated id
 * belongs to this place only.
 */
export class PluginBuilder {
  private readonly jobs = new Set<Promise<void>>();

  constructor(
    private readonly db: Db,
    private readonly host: PluginHost,
    private readonly author: PluginAuthor | undefined,
  ) {}

  /** False without a model on the server: new requests get `ai_unavailable`. */
  get available(): boolean {
    return this.author !== undefined;
  }

  /** The place's AI plugins, oldest first (drafts and published ones). */
  async owned(place: CommunityRow): Promise<OwnedPlugin[]> {
    const plugins = await rows<PluginRow & { created_at: unknown }>(
      this.db,
      surql`SELECT id, published, created_at FROM place_plugin WHERE community = ${place.id} ORDER BY created_at;`,
    );
    return Promise.all(plugins.map(async (plugin) => toOwned(plugin, await this.versions(plugin.id))));
  }

  async get(place: CommunityRow, pluginId: string): Promise<AiPlugin | null> {
    const plugin = await this.plugin(place, pluginId);
    return plugin ? toAiPlugin(plugin, await this.versions(plugin.id)) : null;
  }

  /** A new plugin from the admin's description: a draft whose first version the author starts writing right away. */
  async create(place: CommunityRow, userId: string, request: string): Promise<AiPlugin | "limit"> {
    if (await this.overLimit(place)) return "limit";
    log.info("new plugin requested", { place: place.slug, user: userId });
    const plugin = await first<PluginRow>(
      this.db,
      surql`CREATE ${ref("placePlugin", newPluginId())} CONTENT ${{ community: place.id, author: ref("user", userId) }};`,
    );
    if (!plugin) throw new Error("place_plugin not created");
    await this.startVersion(place, plugin, [], request);
    return toAiPlugin(plugin, await this.versions(plugin.id));
  }

  /** A change: a new version made from the latest ready one. `busy` while a version is being written. */
  async change(place: CommunityRow, pluginId: string, request: string): Promise<AiPlugin | "busy" | "limit" | null> {
    const plugin = await this.plugin(place, pluginId);
    if (!plugin) return null;
    const versions = await this.versions(plugin.id);
    if (versions.some((v) => statusOf(v) === "working")) {
      log.info("change refused: a version is being written", { plugin: pluginId });
      return "busy";
    }
    if (await this.overLimit(place)) return "limit";
    await this.startVersion(place, plugin, versions, request);
    return toAiPlugin(plugin, await this.versions(plugin.id));
  }

  /**
   * Installs the latest ready version in the place (an upload with every check, then enabled). A source that no
   * longer passes — e.g. a breaking change against the published tables — throws PluginCheckError.
   */
  async publish(place: CommunityRow, pluginId: string): Promise<AiPlugin | "not_ready" | null> {
    const plugin = await this.plugin(place, pluginId);
    if (!plugin) return null;
    const ready = (await this.versions(plugin.id)).findLast((v) => statusOf(v) === "ready" && v.source);
    if (!ready?.source) {
      log.info("publish refused: no ready version", { plugin: pluginId });
      return "not_ready";
    }
    const manifest = await this.host.upload(ready.source);
    const loaded = this.host.get(manifest.id);
    if (!loaded) throw new Error(`plugin ${manifest.id} not loaded after upload`);
    await this.host.enable(loaded, toCommunity(place));
    await this.db.query(surql`UPDATE ${plugin.id} SET published = ${ready.n};`);
    log.info("plugin published", { plugin: pluginId, n: ready.n, place: place.slug });
    return toAiPlugin({ ...plugin, published: ready.n }, await this.versions(plugin.id));
  }

  /** Ids of the place's published AI plugins (they can be switched on and off like built-in ones). */
  async publishedIds(place: CommunityRow): Promise<Set<string>> {
    const found = await rows<{ id: RecordId }>(
      this.db,
      surql`SELECT id FROM place_plugin WHERE community = ${place.id} AND published != NONE;`,
    );
    return new Set(found.map((p) => keyOf(p.id)));
  }

  /** Resolves when no version is being written (tests). */
  async idle(): Promise<void> {
    while (this.jobs.size > 0) await Promise.allSettled([...this.jobs]);
  }

  private plugin(place: CommunityRow, pluginId: string): Promise<PluginRow | undefined> {
    return first<PluginRow>(
      this.db,
      surql`SELECT id, published FROM ${ref("placePlugin", pluginId)} WHERE community = ${place.id};`,
    );
  }

  private versions(plugin: RecordId): Promise<VersionRow[]> {
    return rows<VersionRow>(this.db, surql`SELECT * FROM plugin_version WHERE plugin = ${plugin} ORDER BY n;`);
  }

  private async startVersion(place: CommunityRow, plugin: PluginRow, earlier: VersionRow[], request: string) {
    const n = earlier.length + 1;
    const version = await first<VersionRow>(
      this.db,
      surql`CREATE plugin_version CONTENT ${{ plugin: plugin.id, n, request }};`,
    );
    if (!version) throw new Error("plugin_version not created");
    // Every ready version was written from the one before it, so the latest one's source has all their requests and
    // none of the failed ones (a retry repeats a failed request: the AI must not read it as done).
    const ready = earlier.filter((v) => statusOf(v) === "ready" && v.source);
    const base = ready.at(-1);
    const task: AuthorTask = {
      pluginId: keyOf(plugin.id),
      version: `1.${n - 1}.0`,
      place: { name: place.name, kind: await this.kindOf(place) },
      request,
      previous: base?.source ? { source: base.source, requests: ready.map((v) => v.request) } : null,
    };
    withLogFields({ plugin: task.pluginId, n }, () => {
      log.info("version started", { place: place.slug, kind: task.place.kind, from: base?.n ?? null, request });
      this.track(version.id, task);
    });
  }

  /** The place asked the AI REQUESTS_PER_DAY times in the last 24 hours. */
  private async overLimit(place: CommunityRow): Promise<boolean> {
    const found = await first<{ count: number }>(
      this.db,
      surql`SELECT count() AS count FROM plugin_version
            WHERE plugin.community = ${place.id} AND created_at > time::now() - 1d GROUP ALL;`,
    );
    const over = (found?.count ?? 0) >= REQUESTS_PER_DAY;
    if (over) log.warn("request refused: the place used its AI requests for today", { place: place.slug });
    return over;
  }

  private async kindOf(place: CommunityRow): Promise<string> {
    return (await first<{ kind?: string }>(this.db, surql`SELECT kind FROM ${place.id};`))?.kind ?? "other";
  }

  /**
   * Writes the version in the background, from the next turn of the event loop: plugin checks compile TypeScript
   * synchronously (docs/plugins.md, Known issues), and the request that started the version answers first.
   */
  private track(version: RecordId, task: AuthorTask): void {
    const tracked = Bun.sleep(0)
      .then(() => this.write(version, task))
      .finally(() => this.jobs.delete(tracked));
    this.jobs.add(tracked);
  }

  /**
   * Runs the author and stores the outcome on the version (never throws: a failure is the version's status). Logs
   * the outcome with how long it took and how many checks ran: why a version failed is only in the log.
   */
  private async write(version: RecordId, task: AuthorTask): Promise<void> {
    const started = performance.now();
    const checks = { count: 0 };
    const outcome = await this.authorVersion(version, task, checks).catch(failureOf);
    await this.db.query(surql`UPDATE ${version} MERGE ${outcome};`);
    const took = { ms: Math.round(performance.now() - started), checks: checks.count };
    if (outcome.status === "ready") log.info("version ready", { ...took, name: outcome.outline.name });
    else log.warn(`version failed: ${outcome.error}`, took);
  }

  private async authorVersion(version: RecordId, task: AuthorTask, checks: { count: number }) {
    if (!this.author) return { status: "failed", error: "ai_unavailable" } as const;
    const check = async (source: string) => {
      checks.count += 1;
      await this.db.query(surql`UPDATE ${version} SET attempts += 1;`);
      const started = performance.now();
      const result = ownedBy(task.pluginId, await this.host.check(source));
      logCheck(checks.count, result, Math.round(performance.now() - started));
      return result;
    };
    const written = await this.author.write(task, check, AbortSignal.timeout(VERSION_TIMEOUT_MS));
    // The author's word is not enough: the host checks the final source itself.
    const final = ownedBy(task.pluginId, await this.host.check(written.source));
    if (final.status !== "ok") throw new AuthorError(final);
    const { name, icon, description, views, tools, tables, dashboardWidgets } = final.plugin;
    return {
      status: "ready",
      source: written.source,
      summary: written.summary,
      outline: { name, icon, description, views, tools, tables, dashboardWidgets },
    } as const;
  }
}

/** A plugin that passed the checks under another id fails here: the AI may only write the plugin it was asked for. */
function ownedBy(pluginId: string, result: PluginCheck): PluginCheck {
  if (result.status !== "ok" || result.plugin.id === pluginId) return result;
  return { status: "error", stage: "load", errors: [{ message: `The plugin id must be "${pluginId}"` }] };
}

/** One check of the author's source: what failed and where (the author sees the same and tries to fix it). */
function logCheck(attempt: number, result: PluginCheck, ms: number): void {
  if (result.status === "ok") log.info("check passed", { attempt, ms });
  else log.info(`check failed at ${result.stage}`, { attempt, ms, errors: result.errors });
}

/** The version's failure; its cause goes to the log (the admin only sees the reason). */
function failureOf(err: unknown): { status: "failed"; error: VersionError } {
  if (err instanceof AuthorError) {
    const last = err.last?.status === "error" ? { stage: err.last.stage, errors: err.last.errors } : null;
    log.warn("no source passed the checks", { last, answer: err.answer ?? null });
    return { status: "failed", error: "check_failed" };
  }
  if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError" || /cancel/i.test(err.name))) {
    log.warn(`the author ran out of time (${VERSION_TIMEOUT_MS / 1000} s)`, { err });
    return { status: "failed", error: "timeout" };
  }
  log.error("the author failed", { err });
  return { status: "failed", error: "internal" };
}

const newPluginId = () => `ai-${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}`;

const createdAt = (row: VersionRow) => toDate(row.created_at);

/** A version still "working" long after its timeout belonged to a process that is gone. */
const statusOf = (row: VersionRow): VersionStatus =>
  row.status === "working" && Date.now() - createdAt(row).getTime() > STALE_AFTER_MS ? "failed" : row.status;

function toVersion(row: VersionRow): PluginVersion {
  const status = statusOf(row);
  return {
    n: row.n,
    request: row.request,
    status,
    attempts: row.attempts,
    summary: row.summary ?? null,
    outline: row.outline ?? null,
    source: row.source ?? null,
    error: status === "failed" ? (row.error ?? "timeout") : null,
    createdAt: createdAt(row).toISOString(),
  };
}

function toAiPlugin(plugin: PluginRow, versions: VersionRow[]): AiPlugin {
  const list = versions.map(toVersion);
  return {
    id: keyOf(plugin.id),
    status: list.at(-1)?.status ?? "working",
    published: plugin.published ?? null,
    versions: list,
  };
}

function toOwned(plugin: PluginRow, versions: VersionRow[]): OwnedPlugin {
  const { id, status, published, versions: list } = toAiPlugin(plugin, versions);
  const live = list.find((v) => v.n === published)?.outline;
  return {
    id,
    published,
    outline: live ?? list.findLast((v) => v.outline)?.outline ?? null,
    request: list[0]?.request ?? "",
    working: status === "working",
  };
}
