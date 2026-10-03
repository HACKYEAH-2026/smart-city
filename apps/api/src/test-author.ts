import type { PluginCheck } from "@app/plugin-sdk";
import { AuthorError, type AuthorResult, type AuthorTask, type PluginAuthor } from "./services/ai/author";

/**
 * The plugin builder's AI for tests and E2E (test-server.ts with PLUGIN_AUTHOR=test): no model, a fixed small plugin
 * (a board of notes) named after the text in quotes in the latest request ("…" or „…"). It checks its source like
 * the real author; `firstTry` lets a test make the first check fail (a type error) to see the author fix it. Polish
 * strings are data shown in the app, as from a real model.
 */
export class TestPluginAuthor implements PluginAuthor {
  constructor(private readonly opts: { firstTry?: "typo" | "never" } = {}) {}

  async write(task: AuthorTask, check: (source: string) => Promise<PluginCheck>): Promise<AuthorResult> {
    const name = quoted(task.request) ?? quoted(task.previous?.requests.at(-1) ?? "") ?? "Tablica testowa";
    const source = notesPlugin(task.pluginId, task.version, name);
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
}

const quoted = (text: string) => /["„]([^"”]{2,40})["”]/.exec(text)?.[1];

const notesPlugin = (id: string, version: string, name: string) => `import type { PluginModule } from "@app/plugin-sdk";

const plugin: PluginModule = ({ definePlugin, ui, z, t }) =>
  definePlugin({
    id: ${JSON.stringify(id)},
    name: ${JSON.stringify(name)},
    version: ${JSON.stringify(version)},
    icon: "📌",
    description: "Krótkie wpisy członków miejsca.",
    permissions: ["db"],
    nav: [{ view: "main", label: ${JSON.stringify(name)} }],
    tables: {
      notes: t.table({ title: t.text(), author: t.ref("user").optional() }),
    },
    views: {
      main: async (ctx) => {
        const items = await ctx.db.notes.findMany();
        return ui.screen(${JSON.stringify(name)}, [
          ui.form({
            submitLabel: "Dodaj wpis",
            submit: ui.tool("add"),
            children: [ui.textInput({ name: "title", label: "Treść wpisu" })],
          }),
          ui.list(
            "Wpisy",
            items.length ? items.map((n) => ui.card({ title: n.title })) : [ui.empty("Nie ma jeszcze wpisów.")],
          ),
        ]);
      },
    },
    tools: {
      add: {
        description: "Dodaj wpis",
        input: z.object({ title: z.string().trim().min(1).max(200) }),
        handler: async (ctx, input) => {
          await ctx.db.notes.insert({ title: input.title, author: ctx.user.id });
          return { toast: "Dodano wpis.", refresh: true };
        },
      },
    },
  });

export default plugin;
`;
