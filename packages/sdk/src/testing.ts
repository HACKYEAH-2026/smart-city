import type { z } from "zod";
import { loadPlugin } from "./load";
import type {
  AI,
  AICall,
  Context,
  Doc,
  FileId,
  Files,
  PluginCommunity,
  PluginUser,
  Query,
  SimilarMatch,
  Storage,
} from "./plugin";
import { screenSchema, type ToolResult, toolResultSchema, type UINode, type ViewParams } from "./ui";

/**
 * Test harness dla autorów wtyczek: wtyczka testowana jak zwykła funkcja, bez API, bazy i modelu AI.
 * Zachowuje się jak host: walidacja wejścia (Zod), `requires`, schemat UI i wyniku, scalanie update,
 * upsert pod kluczem, filtrowanie `where`.
 *
 *   const t = testPlugin(issues, { user: alice });
 *   t.ai.mockSimilar(() => []);
 *   const photo = t.files.fake();
 *   await t.tool("report", { title: "Latarnia", photo });
 *   await t.as(admin).tool("setStatus", { id, status: "fixed" });
 */
export class ForbiddenError extends Error {}

export function memoryStorage(userId: () => string, now: () => Date): Storage {
  const docs = new Map<string, { collection: string; seq: number; doc: Doc }>();
  let seq = 0;
  const keyOf = (collection: string, id: string) => `${collection}\u0000${id}`;
  const clone = <T>(d: Doc) => structuredClone(d) as Doc<T>;
  const matches = (data: Record<string, unknown>, where: Record<string, unknown> = {}) =>
    Object.entries(where).every(([k, v]) => data[k] === v);

  const write = (collection: string, id: string, data: Record<string, unknown>) => {
    const existing = docs.get(keyOf(collection, id));
    seq += 1;
    const at = now().toISOString();
    const doc: Doc = existing
      ? { ...existing.doc, updatedAt: at, data: structuredClone(data) }
      : { id, createdBy: userId(), createdAt: at, updatedAt: at, data: structuredClone(data) };
    docs.set(keyOf(collection, id), { collection, seq: existing?.seq ?? seq, doc });
    return doc;
  };

  return {
    async get<T>(collection: string, id: string) {
      const row = docs.get(keyOf(collection, id));
      return row ? clone<T>(row.doc) : null;
    },
    async list<T>(collection: string, query: Query<T> = {}) {
      const rows = [...docs.values()]
        .filter((r) => r.collection === collection && matches(r.doc.data, query.where as Record<string, unknown>))
        .sort((a, b) => a.seq - b.seq);
      if (query.order !== "oldest") rows.reverse();
      return rows.slice(0, query.limit ?? 100).map((r) => clone<T>(r.doc));
    },
    async create<T extends Record<string, unknown>>(collection: string, data: T) {
      return clone<T>(write(collection, crypto.randomUUID(), data));
    },
    async upsert<T extends Record<string, unknown>>(collection: string, key: string, data: T) {
      return clone<T>(write(collection, key, data));
    },
    async update<T>(collection: string, id: string, patch: Partial<T>) {
      const row = docs.get(keyOf(collection, id));
      if (!row) return null;
      return clone<T>(write(collection, id, { ...row.doc.data, ...(patch as Record<string, unknown>) }));
    },
    async remove(collection: string, id: string) {
      return docs.delete(keyOf(collection, id));
    },
  };
}

/** Pliki w pamięci: fake() udaje upload przez aplikację; keep() sprawdza właściciela jak host. */
function memoryFiles(userId: () => string) {
  const files = new Map<string, { owner: string; kept: boolean; mime: string }>();
  const api: Files = {
    async keep(id) {
      const f = files.get(id);
      if (!f || f.owner !== userId()) throw new Error(`Unknown file ${id}`);
      f.kept = true;
    },
    async info(id) {
      const f = files.get(id);
      if (!f) throw new Error(`Unknown file ${id}`);
      return { mime: f.mime, size: 1024 };
    },
    async remove(id) {
      files.delete(id);
    },
  };
  return {
    api,
    /** Plik wysłany przez `owner` (domyślnie bieżący użytkownik), jeszcze niezatwierdzony. */
    fake(mime = "image/jpeg", owner = userId()): FileId {
      const id = `file_${crypto.randomUUID()}` as FileId;
      files.set(id, { owner, kept: false, mime });
      return id;
    },
    isKept: (id: FileId) => files.get(id)?.kept === true,
  };
}

type CallMock = (req: AICall<z.ZodType | undefined>) => unknown;
type SimilarMock = (query: { text: string; image?: FileId }, candidates: Doc<unknown>[]) => SimilarMatch<unknown>[];

function mockAI() {
  let call: CallMock = () => {
    throw new Error("ctx.ai.call: brak atrapy — użyj t.ai.mockCall(...)");
  };
  let similar: SimilarMock = () => [];
  const api: AI = {
    async call(req) {
      const out = call(req as AICall<z.ZodType | undefined>);
      return (req.schema ? req.schema.parse(out) : String(out)) as never;
    },
    async findSimilar(query, candidates) {
      return similar(query, candidates as Doc<unknown>[]) as never;
    },
  };
  return {
    api,
    mockCall: (fn: CallMock) => {
      call = fn;
    },
    mockSimilar: (fn: SimilarMock) => {
      similar = fn;
    },
  };
}

export function testPlugin(mod: unknown, opts: { user?: PluginUser; community?: PluginCommunity } = {}) {
  const { definition } = loadPlugin(mod);
  const community = opts.community ?? { id: "c-test", slug: "test", name: "Testowo" };
  let current: PluginUser = opts.user ?? { id: "u-test", name: "Testowy Użytkownik", role: "user" };
  let clock = new Date(Date.UTC(2026, 0, 1));
  const now = () => new Date(clock);
  const storage = memoryStorage(() => current.id, now);
  const files = memoryFiles(() => current.id);
  const ai = mockAI();

  const harness = (user: PluginUser) => {
    const ctx = (): Context => {
      current = user;
      return { user, community, now, storage, files: files.api, ai: ai.api };
    };
    return {
      ctx,
      async view(name: string, params: ViewParams = {}): Promise<UINode> {
        const fn = definition.views[name];
        if (!fn) throw new Error(`no view ${name}`);
        return screenSchema.parse(await fn(ctx(), params));
      },
      async tool(name: string, args: Record<string, unknown> = {}): Promise<ToolResult> {
        const tool = definition.tools?.[name];
        if (!tool) throw new Error(`no tool ${name}`);
        if (tool.requires === "admin" && user.role !== "admin") throw new ForbiddenError(`${name} requires admin`);
        const input = tool.input.parse(args);
        return toolResultSchema.parse((await tool.handler(ctx(), input)) ?? {});
      },
      /** Upload zdjęcia przez tego użytkownika (FileId do argumentów narzędzia). */
      files: { fake: (mime?: string) => files.fake(mime, user.id) },
      /** Wejście narzędzia, które host odrzuciłby z 400 (lista problemów Zod), albo null. */
      invalidInput(name: string, args: Record<string, unknown>): z.core.$ZodIssue[] | null {
        const r = definition.tools?.[name]?.input.safeParse(args);
        return r && !r.success ? r.error.issues : null;
      },
    };
  };

  return {
    ...harness(current),
    as: (user: PluginUser) => harness(user),
    /** Uruchamia onInstall (jak host po włączeniu wtyczki w społeczności). */
    install: async () => {
      current = { id: "system", name: "System", role: "admin" };
      await definition.onInstall?.({ user: current, community, now, storage, files: files.api, ai: ai.api });
    },
    storage,
    files: { fake: (mime?: string) => files.fake(mime, current.id), isKept: files.isKept },
    ai: { mockCall: ai.mockCall, mockSimilar: ai.mockSimilar },
    setNow: (date: Date) => {
      clock = date;
    },
  };
}

/** Wszystkie teksty drzewa UI (tytuły, etykiety, wartości) — do asercji niezależnych od układu. */
export function textsOf(node: UINode): string[] {
  const own = (["title", "subtitle", "text", "label", "value", "alt"] as const).flatMap((k) => {
    const v = (node as Record<string, unknown>)[k];
    return typeof v === "string" ? [v] : [];
  });
  const children = "children" in node && node.children ? node.children.flatMap(textsOf) : [];
  return [...own, ...children];
}
