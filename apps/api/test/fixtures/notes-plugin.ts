import type { PluginModule } from "@app/plugin-sdk";

/**
 * Smallest plugin with a table, a form and a tool, for tests of plugins uploaded at runtime (apps/api/test and
 * apps/app/e2e send this file's source to POST /api/admin/plugins). A test fixture, not a product feature.
 */
const notes: PluginModule = ({ definePlugin, ui, z, t }) =>
  definePlugin({
    id: "notes",
    name: "Notatki",
    version: "1.0.0",
    icon: "📝",
    description: "Wspólne notatki członków społeczności.",
    permissions: ["db"],
    nav: [{ view: "main", label: "Notatki" }],
    tables: {
      notes: t.table({ title: t.text(), body: t.text().default(""), author: t.ref("user").optional() }),
    },
    views: {
      main: async (ctx) => {
        const items = await ctx.db.notes.findMany();
        return ui.screen("Tablica notatek", [
          ui.form({
            submitLabel: "Dodaj notatkę",
            submit: ui.tool("add"),
            children: [ui.textInput({ name: "title", label: "Tytuł" }), ui.textInput({ name: "body", label: "Treść" })],
          }),
          ui.list(
            "Wszystkie notatki",
            items.length
              ? items.map((n) => ui.card({ title: n.title, subtitle: n.body }))
              : [ui.empty("Nie ma jeszcze notatek.")],
          ),
        ]);
      },
    },
    tools: {
      add: {
        description: "Dodaj notatkę",
        input: z.object({ title: z.string().trim().min(1), body: z.string().trim().max(200).default("") }),
        handler: async (ctx, input) => {
          await ctx.db.notes.insert({ ...input, author: ctx.user.id });
          return { toast: "Notatka dodana.", refresh: true };
        },
      },
    },
  });

export default notes;
