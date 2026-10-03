import type { z } from "zod";
import { loadPlugin } from "./load";
import type { PluginContext, PluginDoc, PluginStorage } from "./plugin";
import { screenSchema, type ToolResult, toolResultSchema, type UINode, type ViewParams } from "./ui";

/**
 * Test harness dla autorów wtyczek: wtyczka testowana jak zwykła funkcja, bez API i bazy.
 * Magazyn w pamięci zachowuje się jak ctx.storage w hoście (scalanie update, kolejność newest/oldest).
 * Widoki i narzędzia są walidowane tak samo jak w hoście (schemat UI, wejście Zod, wynik).
 *
 *   const t = testPlugin(issues);
 *   await t.tool("report", { title: "Latarnia" });
 *   const screen = await t.view("list");
 *   const bob = t.as({ id: "bob", name: "Bob" }); // ten sam magazyn, inny użytkownik
 */
export function memoryStorage(userId: () => string): PluginStorage {
  const docs = new Map<string, { collection: string; seq: number; doc: PluginDoc }>();
  let seq = 0;
  const now = () => new Date(Date.UTC(2026, 0, 1, 0, 0, seq)).toISOString();
  return {
    async list<T>(collection: string, opts: { order?: "newest" | "oldest"; limit?: number } = {}) {
      const rows = [...docs.values()].filter((d) => d.collection === collection).sort((a, b) => a.seq - b.seq);
      if (opts.order !== "oldest") rows.reverse();
      return rows.slice(0, opts.limit ?? 100).map((r) => structuredClone(r.doc) as PluginDoc<T>);
    },
    async get<T>(collection: string, id: string) {
      const row = docs.get(id);
      return row && row.collection === collection ? (structuredClone(row.doc) as PluginDoc<T>) : null;
    },
    async add<T extends Record<string, unknown>>(collection: string, data: T) {
      seq += 1;
      const doc: PluginDoc = { id: `doc-${seq}`, createdBy: userId(), createdAt: now(), updatedAt: now(), data };
      docs.set(doc.id, { collection, seq, doc: structuredClone(doc) });
      return doc as PluginDoc<T>;
    },
    async update<T>(collection: string, id: string, patch: Record<string, unknown>) {
      const row = docs.get(id);
      if (!row || row.collection !== collection) return null;
      seq += 1;
      row.doc = { ...row.doc, updatedAt: now(), data: { ...row.doc.data, ...structuredClone(patch) } };
      return structuredClone(row.doc) as PluginDoc<T>;
    },
    async remove(collection: string, id: string) {
      const row = docs.get(id);
      if (!row || row.collection !== collection) return false;
      return docs.delete(id);
    },
  };
}

type User = PluginContext["user"];

export function testPlugin(mod: unknown, opts: { user?: User; community?: PluginContext["community"] } = {}) {
  const { definition } = loadPlugin(mod);
  const community = opts.community ?? { id: "c-test", slug: "test", name: "Testowo" };
  let current: User = opts.user ?? { id: "u-test", name: "Testowy Użytkownik" };
  const storage = memoryStorage(() => current.id);

  const harness = (user: User) => {
    const ctx = (): PluginContext => {
      current = user;
      return { user, community, storage };
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
        const input = tool.input.parse(args);
        return toolResultSchema.parse((await tool.handler(ctx(), input)) ?? {});
      },
      /** Wejście narzędzia, które host odrzuciłby z 400 (lista problemów Zod), albo null. */
      invalidInput(name: string, args: Record<string, unknown>): z.core.$ZodIssue[] | null {
        const r = definition.tools?.[name]?.input.safeParse(args);
        return r && !r.success ? r.error.issues : null;
      },
    };
  };
  return { ...harness(current), as: (user: User) => harness(user), storage };
}

/** Wszystkie teksty drzewa UI (tytuły, etykiety, wartości) — do asercji niezależnych od układu. */
export function textsOf(node: UINode): string[] {
  const own = (["title", "subtitle", "text", "label", "value"] as const).flatMap((k) => {
    const v = (node as Record<string, unknown>)[k];
    return typeof v === "string" ? [v] : [];
  });
  const children = "children" in node && node.children ? node.children.flatMap(textsOf) : [];
  return [...own, ...children];
}
