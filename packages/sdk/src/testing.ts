import { afterEach } from "bun:test";
import { createNodeEngines } from "@surrealdb/node";
import { RecordId, Surreal, type SurrealSession, surql } from "surrealdb";
import type { z } from "zod";
import { deniedService } from "./denied";
import { createDatabase } from "./engine/client";
import { PLATFORM_SCHEMA } from "./engine/platform";
import { HOST, syncSchema } from "./engine/schema";
import { loadPlugin } from "./load";
import type { Context, Permission, PluginCommunity, PluginUser } from "./plugin";
import type { AI, AICall, SimilarMatch } from "./services/ai";
import type { Database, Tables } from "./services/db";
import type { FileId, Files } from "./services/files";
import { type Notification, type Notify, parseNotification } from "./services/notify";
import {
  dashboardWidgetSchema,
  screenSchema,
  type ToolResult,
  toolResultSchema,
  type UINode,
  type ViewParams,
} from "./ui";

/**
 * Test harness for plugin authors: test a plugin like a plain function, without the API or an AI model.
 * The database is the real engine on embedded, in-memory SurrealDB (with the platform tables), so tables,
 * references, unique indexes, defaults and live `watch()` behave exactly as in the host. Also like the host:
 * manifest permissions, input validation (Zod), `requires`, UI and result schemas. Each harness gets a fresh database.
 *
 *   const t = await testPlugin(issues, { user: alice });
 *   t.ai.mockSimilar(() => []);
 *   const photo = await t.files.fake();
 *   await t.tool("report", { title: "Latarnia", photo });
 *   const live = await t.stream("messages", { discussion: id }); // snapshot, then changes
 *   await t.dashboardWidget("latest"); // `view()` records a visit like the host (ctx.lastVisit)
 *   t.notifications(); // what ctx.notify sent (recipients are resolved by the host, not here)
 */
export class ForbiddenError extends Error {}

const INSTALLATION = "installation_test";
const SYSTEM: PluginUser = { id: "system", name: "System", role: "admin" };
const ENGINE = Symbol.for("@app/plugin-sdk/testing/engine");
const cleanups: (() => Promise<void>)[] = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
});

/**
 * The one embedded in-memory SurrealDB engine of this test process, shared by all test files (hence
 * `globalThis`) and closed after the run by `closeTestEngine()` (preload). With @surrealdb/node 3.0.3, Bun 1.4
 * crashes on exit (SIGSEGV) once a process has opened a second embedded engine, so tests get a fresh database
 * on this one instead (`testDatabase()`).
 */
export function testEngine(): Promise<Surreal> {
  const global = globalThis as { [ENGINE]?: Promise<Surreal> };
  global[ENGINE] ??= (async () => {
    const surreal = new Surreal({ engines: createNodeEngines() });
    await surreal.connect("mem://");
    return surreal;
  })();
  return global[ENGINE];
}

/** Closes the shared engine at the end of a test run (preload `afterAll`); an open engine crashes Bun on exit. */
export async function closeTestEngine(): Promise<void> {
  const global = globalThis as { [ENGINE]?: Promise<Surreal> };
  const engine = global[ENGINE];
  delete global[ENGINE];
  await (await engine)?.close();
}

/**
 * A session on a fresh, empty database of the shared engine, closed after the current test. The database is
 * not removed (small, in memory): `REMOVE DATABASE` also makes Bun 1.4 crash on exit.
 */
export async function testDatabase(): Promise<SurrealSession> {
  const session = await (await testEngine()).newSession();
  await session.use({ namespace: "test", database: `t_${crypto.randomUUID().replaceAll("-", "")}` });
  cleanups.push(() => session.closeSession());
  return session;
}

async function platform(): Promise<SurrealSession> {
  const surreal = await testDatabase();
  await surreal.query(PLATFORM_SCHEMA);
  await surreal.query(surql`CREATE ${new RecordId(HOST.installation, INSTALLATION)};`);
  return surreal;
}

type CallMock = (req: AICall<z.ZodType | undefined>) => unknown;
type SimilarMock = (query: { text: string; image?: FileId | null }, candidates: unknown[]) => SimilarMatch<unknown>[];

function mockAI() {
  const mocks: { call: CallMock; similar: SimilarMock } = {
    call: () => {
      throw new Error("ctx.ai.call: no mock — use t.ai.mockCall(...)");
    },
    similar: () => [],
  };
  const api: AI = {
    async call(req) {
      const out = mocks.call(req as AICall<z.ZodType | undefined>);
      return (req.schema ? req.schema.parse(out) : String(out)) as never;
    },
    async findSimilar(query, candidates) {
      return mocks.similar(query, candidates) as never;
    },
  };
  return {
    api,
    mockCall: (fn: CallMock) => {
      mocks.call = fn;
    },
    mockSimilar: (fn: SimilarMock) => {
      mocks.similar = fn;
    },
  };
}

export async function testPlugin(mod: unknown, opts: { user?: PluginUser; community?: Partial<PluginCommunity> } = {}) {
  const { manifest, definition } = loadPlugin(mod);
  const tables: Tables = definition.tables ?? {};
  const community: PluginCommunity = {
    id: "c-test",
    slug: "test",
    name: "Test Community",
    location: null,
    ...opts.community,
  };
  const clock = { now: new Date(Date.UTC(2026, 0, 1)) };
  const now = () => new Date(clock.now);
  const surreal = await platform();
  await syncSchema(surreal, manifest.id, tables);
  const ai = mockAI();

  const ensureUser = async (user: PluginUser) => {
    if (user.id === SYSTEM.id) return;
    await surreal.query(surql`UPSERT ${new RecordId(HOST.user, user.id)} SET name = ${user.name};`);
  };
  const dbFor = (user: PluginUser): Database =>
    createDatabase({
      surreal,
      pluginId: manifest.id,
      tables,
      installationId: INSTALLATION,
      userId: user.id === SYSTEM.id ? null : user.id,
      now,
    });
  const fileRow = async (id: string) => {
    const [rows] = await surreal.query(
      surql<
        [{ mime: string; size: number; status: string }[]]
      >`SELECT mime, size, status FROM ${new RecordId(HOST.file, id)};`,
    );
    return rows[0];
  };
  const filesApi: Files = {
    async info(id) {
      const row = await fileRow(id);
      if (!row) throw new Error(`Unknown file ${id}`);
      return { mime: row.mime, size: row.size };
    },
    async remove(id) {
      await surreal.query(surql`DELETE ${new RecordId(HOST.file, id)};`);
    },
  };
  /** A pending upload by `user`, like POST …/files in the app. */
  const fakeFile = async (user: PluginUser, mime = "image/jpeg"): Promise<FileId> => {
    await ensureUser(user);
    const id = `file_${crypto.randomUUID()}` as FileId;
    const data = {
      installation: new RecordId(HOST.installation, INSTALLATION),
      uploaded_by: new RecordId(HOST.user, user.id),
      mime,
      size: 1024,
    };
    await surreal.query(surql`CREATE ${new RecordId(HOST.file, id)} CONTENT ${data};`);
    return id;
  };
  const can = (permission: Permission) => manifest.permissions.includes(permission);
  /** ctx.notify calls, validated like in the host, with the sender. */
  const sent: (Notification & { from: string })[] = [];
  const notifyAs =
    (user: PluginUser): Notify =>
    async (input) => {
      sent.push({ from: user.id, ...parseNotification(definition.views, input) });
    };
  /** Last view render per user, like the host's visit tracking (`ctx.lastVisit`). */
  const visits = new Map<string, Date>();
  const ctxFor = async (user: PluginUser): Promise<Context> => {
    await ensureUser(user);
    return {
      user,
      community,
      now,
      lastVisit: visits.get(user.id) ?? null,
      db: can("db") ? dbFor(user) : deniedService("db"),
      files: can("files") ? filesApi : deniedService("files"),
      ai: can("ai") ? ai.api : deniedService("ai"),
      notify: can("notify") ? notifyAs(user) : deniedService("notify"),
    };
  };
  const assertRole = (name: string, requires: string | undefined, user: PluginUser) => {
    if (requires === "admin" && user.role !== "admin") throw new ForbiddenError(`${name} requires admin`);
  };

  const harness = (user: PluginUser) => ({
    ctx: () => ctxFor(user),
    async view(name: string, params: ViewParams = {}): Promise<UINode> {
      const fn = definition.views[name];
      if (!fn) throw new Error(`no view ${name}`);
      const node = screenSchema.parse(await fn(await ctxFor(user), params));
      visits.set(user.id, now());
      return node;
    },
    /** Dashboard widget (validated like in the host); null = the widget shows nothing. */
    async dashboardWidget(name: string): Promise<UINode | null> {
      const fn = definition.dashboardWidgets?.[name];
      if (!fn) throw new Error(`no dashboard widget ${name}`);
      return dashboardWidgetSchema.nullable().parse(await fn.render(await ctxFor(user)));
    },
    async tool(name: string, args: Record<string, unknown> = {}): Promise<ToolResult> {
      const tool = definition.tools?.[name];
      if (!tool) throw new Error(`no tool ${name}`);
      assertRole(name, tool.requires, user);
      const input = tool.input.parse(args);
      return toolResultSchema.parse((await tool.handler(await ctxFor(user), input)) ?? {});
    },
    /** Opens a plugin stream; iterate it with `next()` and finish with `return()`. */
    async stream(name: string, args: Record<string, unknown> = {}): Promise<AsyncIterator<unknown>> {
      const stream = definition.streams?.[name];
      if (!stream) throw new Error(`no stream ${name}`);
      assertRole(name, stream.requires, user);
      const input = stream.input.parse(args);
      return stream.handler(await ctxFor(user), input)[Symbol.asyncIterator]();
    },
    /** Photo upload by this user (FileId for tool arguments). */
    files: { fake: (mime?: string) => fakeFile(user, mime) },
    /** Zod issues for tool input the host would reject with 400, or null. */
    invalidInput(name: string, args: Record<string, unknown>): z.core.$ZodIssue[] | null {
      const r = definition.tools?.[name]?.input.safeParse(args);
      return r && !r.success ? r.error.issues : null;
    },
  });

  const main = opts.user ?? { id: "u_test", name: "Test User", role: "user" };
  return {
    ...harness(main),
    as: (user: PluginUser) => harness(user),
    /** Runs onInstall (like the host after enabling the plugin in a community). */
    install: async () => {
      await definition.onInstall?.(await ctxFor(SYSTEM));
    },
    /** The plugin database (for assertions), acting as the system user. */
    db: dbFor(SYSTEM),
    /** Deletes a platform user (e.g. to check reference cascades). */
    deleteUser: async (id: string) => {
      await surreal.query(surql`DELETE ${new RecordId(HOST.user, id)};`);
    },
    files: {
      fake: (mime?: string) => fakeFile(main, mime),
      isKept: async (id: FileId) => (await fileRow(id))?.status === "kept",
    },
    ai: { mockCall: ai.mockCall, mockSimilar: ai.mockSimilar },
    /** Notifications sent with ctx.notify, oldest first (`from` = the acting user's id). */
    notifications: () => [...sent],
    setNow: (date: Date) => {
      clock.now = date;
    },
  };
}

/** All texts in a UI tree (titles, labels, values) — for layout-independent assertions. */
export function textsOf(node: UINode): string[] {
  const own = (["title", "subtitle", "text", "label", "value", "alt"] as const).flatMap((k) => {
    const v = (node as Record<string, unknown>)[k];
    return typeof v === "string" ? [v] : [];
  });
  const children = "children" in node && node.children ? node.children.flatMap(textsOf) : [];
  return [...own, ...children, ...mapTexts(node)];
}

/** A map's layer titles and its items' titles and subtitles (what the app lists next to the map). */
const mapTexts = (node: UINode): string[] =>
  node.type === "Map"
    ? node.layers.flatMap((layer) => [
        layer.title,
        ...layer.items.flatMap((item) => [item.title, ...(item.subtitle ? [item.subtitle] : [])]),
      ])
    : [];
