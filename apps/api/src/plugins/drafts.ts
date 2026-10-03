import type { PluginCheck } from "@app/plugin-sdk";
import type { DraftError, DraftPlugin, DraftRevision, DraftStatus, PluginDraft, PluginDraftItem } from "@app/shared";
import { type RecordId, surql } from "surrealdb";
import { type CommunityRow, type Db, first, keyOf, ref, rows, toCommunity, toDate } from "../db";
import { AuthorError, type AuthorTask, type PluginAuthor } from "../services/ai/author";
import type { PluginHost } from "./host";

/** A revision still "working" this long after it started died with its process (a restart): it reads as failed. */
const REVISION_TIMEOUT_MS = 5 * 60_000;
const STALE_AFTER_MS = REVISION_TIMEOUT_MS + 60_000;

type DraftRow = { id: RecordId; plugin: string; published?: number };
type RevisionRow = {
  id: RecordId;
  n: number;
  request: string;
  status: DraftStatus;
  attempts: number;
  summary?: string;
  source?: string;
  plugin?: DraftPlugin;
  error?: DraftError;
  created_at: Date | { toDate(): Date };
};

/**
 * The plugin builder: a place's admin describes a feature, the AI (PluginAuthor) writes it as a plugin in the
 * background, the admin gives feedback (each request is a revision) and publishes a ready revision into the place.
 * Revisions and their source live in the database (plugin_draft, plugin_draft_revision); a published plugin is an
 * uploaded plugin (plugin_source) whose generated id belongs to this place only.
 */
export class DraftService {
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

  async list(place: CommunityRow): Promise<PluginDraftItem[]> {
    const drafts = await rows<DraftRow>(
      this.db,
      surql`SELECT id, plugin, published, created_at FROM plugin_draft WHERE community = ${place.id} ORDER BY created_at DESC;`,
    );
    return Promise.all(drafts.map(async (draft) => toItem(draft, await this.revisions(draft.id))));
  }

  async get(place: CommunityRow, draftId: string): Promise<PluginDraft | null> {
    const draft = await this.draft(place, draftId);
    return draft ? toDraft(draft, await this.revisions(draft.id)) : null;
  }

  /** A new draft with its first revision, which the author starts writing right away. */
  async create(place: CommunityRow, userId: string, request: string): Promise<PluginDraft> {
    const draft = await first<DraftRow>(
      this.db,
      surql`CREATE plugin_draft CONTENT ${{ community: place.id, author: ref("user", userId), plugin: newPluginId() }};`,
    );
    if (!draft) throw new Error("plugin_draft not created");
    await this.startRevision(place, draft, [], request);
    return toDraft(draft, await this.revisions(draft.id));
  }

  /** Feedback: a new revision that changes the latest ready source. `busy` while a revision is being written. */
  async revise(place: CommunityRow, draftId: string, request: string): Promise<PluginDraft | "busy" | null> {
    const draft = await this.draft(place, draftId);
    if (!draft) return null;
    const revisions = await this.revisions(draft.id);
    if (revisions.some((r) => statusOf(r) === "working")) return "busy";
    await this.startRevision(place, draft, revisions, request);
    return toDraft(draft, await this.revisions(draft.id));
  }

  /**
   * Installs the latest ready revision in the place (an upload with every check, then enabled). A source that no
   * longer passes — e.g. a breaking change against the published tables — throws PluginCheckError.
   */
  async publish(place: CommunityRow, draftId: string): Promise<PluginDraft | "not_ready" | null> {
    const draft = await this.draft(place, draftId);
    if (!draft) return null;
    const ready = (await this.revisions(draft.id)).findLast((r) => statusOf(r) === "ready" && r.source);
    if (!ready?.source) return "not_ready";
    const manifest = await this.host.upload(ready.source);
    const plugin = this.host.get(manifest.id);
    if (!plugin) throw new Error(`plugin ${manifest.id} not loaded after upload`);
    await this.host.enable(plugin, toCommunity(place));
    await this.db.query(surql`UPDATE ${draft.id} SET published = ${ready.n};`);
    return toDraft({ ...draft, published: ready.n }, await this.revisions(draft.id));
  }

  /** Plugin ids of this place's published drafts (they show up among the place's plugins). */
  async publishedPluginIds(place: CommunityRow): Promise<Set<string>> {
    const found = await rows<{ plugin: string }>(
      this.db,
      surql`SELECT plugin FROM plugin_draft WHERE community = ${place.id} AND published != NONE;`,
    );
    return new Set(found.map((d) => d.plugin));
  }

  /** Resolves when no revision is being written (tests). */
  async idle(): Promise<void> {
    while (this.jobs.size > 0) await Promise.allSettled([...this.jobs]);
  }

  private draft(place: CommunityRow, draftId: string): Promise<DraftRow | undefined> {
    return first<DraftRow>(
      this.db,
      surql`SELECT id, plugin, published FROM ${ref("draft", draftId)} WHERE community = ${place.id};`,
    );
  }

  private revisions(draft: RecordId): Promise<RevisionRow[]> {
    return rows<RevisionRow>(this.db, surql`SELECT * FROM plugin_draft_revision WHERE draft = ${draft} ORDER BY n;`);
  }

  private async startRevision(place: CommunityRow, draft: DraftRow, earlier: RevisionRow[], request: string) {
    const n = earlier.length + 1;
    const revision = await first<RevisionRow>(
      this.db,
      surql`CREATE plugin_draft_revision CONTENT ${{ draft: draft.id, n, request }};`,
    );
    if (!revision) throw new Error("plugin_draft_revision not created");
    const base = earlier.findLast((r) => statusOf(r) === "ready" && r.source);
    const task: AuthorTask = {
      pluginId: draft.plugin,
      version: `1.${n - 1}.0`,
      place: { name: place.name, kind: await this.kindOf(place) },
      request,
      previous: base?.source ? { source: base.source, requests: earlier.map((r) => r.request) } : null,
    };
    this.track(this.write(revision.id, task));
  }

  private async kindOf(place: CommunityRow): Promise<string> {
    return (await first<{ kind?: string }>(this.db, surql`SELECT kind FROM ${place.id};`))?.kind ?? "other";
  }

  private track(job: Promise<void>): void {
    const tracked = job.finally(() => this.jobs.delete(tracked));
    this.jobs.add(tracked);
  }

  /** Runs the author and stores the outcome on the revision (never throws: a failure is the revision's status). */
  private async write(revision: RecordId, task: AuthorTask): Promise<void> {
    const outcome = await this.authorRevision(revision, task).catch(failureOf);
    await this.db.query(surql`UPDATE ${revision} MERGE ${outcome};`);
  }

  private async authorRevision(revision: RecordId, task: AuthorTask) {
    if (!this.author) return { status: "failed", error: "ai_unavailable" } as const;
    const check = async (source: string) => {
      await this.db.query(surql`UPDATE ${revision} SET attempts += 1;`);
      return ownedBy(task.pluginId, await this.host.check(source));
    };
    const written = await this.author.write(task, check, AbortSignal.timeout(REVISION_TIMEOUT_MS));
    // The author's word is not enough: the host checks the final source itself.
    const final = ownedBy(task.pluginId, await this.host.check(written.source));
    if (final.status !== "ok") throw new AuthorError(final);
    const { name, icon, description, views, tools, tables, dashboardWidgets } = final.plugin;
    return {
      status: "ready",
      source: written.source,
      summary: written.summary,
      plugin: { name, icon, description, views, tools, tables, dashboardWidgets },
    } as const;
  }
}

/** A plugin that passed the checks under another id fails here: a draft may only write its own plugin. */
function ownedBy(pluginId: string, result: PluginCheck): PluginCheck {
  if (result.status !== "ok" || result.plugin.id === pluginId) return result;
  return { status: "error", stage: "load", errors: [{ message: `The plugin id must be "${pluginId}"` }] };
}

function failureOf(err: unknown): { status: "failed"; error: DraftError } {
  if (err instanceof AuthorError) {
    console.error(`plugin draft: ${err.message}`);
    return { status: "failed", error: "check_failed" };
  }
  if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError" || /cancel/i.test(err.name))) {
    return { status: "failed", error: "timeout" };
  }
  console.error("plugin draft: the author failed", err);
  return { status: "failed", error: "internal" };
}

const newPluginId = () => `ai-${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}`;

const createdAt = (row: RevisionRow) => toDate(row.created_at);

/** A revision still "working" long after its timeout belonged to a process that is gone. */
const statusOf = (row: RevisionRow): DraftStatus =>
  row.status === "working" && Date.now() - createdAt(row).getTime() > STALE_AFTER_MS ? "failed" : row.status;

function toRevision(row: RevisionRow): DraftRevision {
  const status = statusOf(row);
  return {
    n: row.n,
    request: row.request,
    status,
    attempts: row.attempts,
    summary: row.summary ?? null,
    plugin: row.plugin ?? null,
    source: row.source ?? null,
    error: status === "failed" ? (row.error ?? "timeout") : null,
    createdAt: createdAt(row).toISOString(),
  };
}

function toDraft(draft: DraftRow, revisions: RevisionRow[]): PluginDraft {
  const list = revisions.map(toRevision);
  return {
    id: keyOf(draft.id),
    pluginId: draft.plugin,
    status: list.at(-1)?.status ?? "working",
    published: draft.published ?? null,
    revisions: list,
  };
}

function toItem(draft: DraftRow, revisions: RevisionRow[]): PluginDraftItem {
  const { id, pluginId, status, published, revisions: list } = toDraft(draft, revisions);
  const plugin = list.findLast((r) => r.plugin)?.plugin;
  return {
    id,
    pluginId,
    title: plugin?.name ?? list[0]?.request ?? "",
    icon: plugin?.icon ?? null,
    status,
    published,
    revisions: list.length,
  };
}
