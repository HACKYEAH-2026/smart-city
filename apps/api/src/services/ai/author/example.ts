/**
 * The smallest useful plugin that passes every check: a board of notes (a table, a view with a form and a list, a
 * tool, one dashboard widget). The author's instructions show it as the shape to start from (prompt.ts); the test
 * author writes it (test-author.ts), so the builder's tests keep it passing the checks. Polish strings are what
 * residents would see.
 */
export const examplePlugin = ({
  id,
  version,
  name,
}: Record<"id" | "version" | "name", string>) => `import type { PluginModule } from "@app/plugin-sdk";

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
    dashboardWidgets: {
      latest: {
        size: { w: 2, h: 1 },
        render: async (ctx) =>
          ui.widget(${JSON.stringify(name)}, [ui.text(\`Wpisów: \${await ctx.db.notes.count()}\`, "soft")], {
            onPress: ui.navigate("main"),
          }),
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
