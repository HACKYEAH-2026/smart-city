import type { PluginCheck } from "@app/plugin-sdk";
import { examplePlugin } from "./services/ai/author/example";
import { AuthorError, type AuthorResult, type AuthorTask, type PluginAuthor } from "./services/ai/author/types";

/**
 * The plugin builder's AI for tests and E2E (test-server.ts with PLUGIN_AUTHOR=test): no model, the author's example
 * plugin (a board of notes, services/ai/author/example.ts) named after the text in quotes in the latest request ("…" or „…"). It checks its source like
 * the real author; `firstTry` lets a test make the first check fail (a type error) to see the author fix it. A request
 * with SLOW in it runs out of time the first time a plugin gets it (E2E retries it). Polish strings are data shown in
 * the app, as from a real model.
 */
export class TestPluginAuthor implements PluginAuthor {
  /** Plugin and request of every SLOW request that already ran out of time once. */
  private readonly timedOut = new Set<string>();

  constructor(private readonly opts: { firstTry?: "typo" | "never" } = {}) {}

  async write(task: AuthorTask, check: (source: string) => Promise<PluginCheck>): Promise<AuthorResult> {
    this.runOutOfTimeOnce(task);
    const name = quoted(task.request) ?? quoted(task.previous?.requests.at(-1) ?? "") ?? "Tablica testowa";
    const source = examplePlugin({ id: task.pluginId, version: task.version, name });
    if (this.opts.firstTry) {
      const broken = await check(source.replace("ctx.db.notes.findMany()", "ctx.db.notez.findMany()"));
      if (this.opts.firstTry === "never") throw new AuthorError(broken);
    }
    const result = await check(source);
    if (result.status !== "ok") throw new AuthorError(result);
    const summary = task.previous
      ? `Zmieniłem plugin zgodnie z uwagą. Teraz nazywa się „${name}”.`
      : `Plugin „${name}” to tablica, na której członkowie miejsca dodają krótkie wpisy.`;
    return { source, summary };
  }

  private runOutOfTimeOnce(task: AuthorTask): void {
    const key = `${task.pluginId} ${task.request}`;
    if (!task.request.includes(SLOW) || this.timedOut.has(key)) return;
    this.timedOut.add(key);
    throw Object.assign(new Error("the test author ran out of time"), { name: "TimeoutError" });
  }
}

/** Marks a request that runs out of time on its first try (copied in apps/app/e2e/build-plugin.spec.ts). */
export const SLOW = "[slow]";

const quoted = (text: string) => /["„]([^"”]{2,40})["”]/.exec(text)?.[1];
