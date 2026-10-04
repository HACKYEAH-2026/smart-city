import type { PluginModule } from "@app/plugin-sdk";

/**
 * Notes that refuse a near-duplicate: ctx.ai.embed, vectors stored in the plugin's own table and compared with cosine
 * similarity in the plugin (apps/api/test sends this file's source to POST /api/admin/plugins). A test fixture, not a
 * product feature.
 */
const cosine = (a: number[], b: number[]) => {
  const dot = a.reduce((sum, x, i) => sum + x * (b[i] ?? 0), 0);
  const norm = (v: number[]) => Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
  return dot / (norm(a) * norm(b) || 1);
};

const dedupe: PluginModule = ({ definePlugin, ui, z, t }) =>
  definePlugin({
    id: "dedupe",
    name: "Notatki bez powtórek",
    version: "1.0.0",
    icon: "🧭",
    description: "Notatki, które nie przyjmują drugi raz tej samej sprawy.",
    permissions: ["db", "ai"],
    nav: [{ view: "main", label: "Notatki" }],
    tables: {
      notes: t.table({ title: t.text(), vector: t.json<number[]>() }),
    },
    views: {
      main: async (ctx) => {
        const notes = await ctx.db.notes.findMany();
        return ui.screen("Notatki", [
          ui.list(
            "Wszystkie notatki",
            notes.map((n) => ui.card({ title: n.title })),
          ),
        ]);
      },
    },
    dashboardWidgets: {
      summary: {
        size: { w: 2, h: 1 },
        render: async (ctx) =>
          ui.widget("Notatki", [ui.text(`Spraw: ${await ctx.db.notes.count()}`, "soft")], {
            onPress: ui.navigate("main"),
          }),
      },
    },
    tools: {
      add: {
        description: "Dodaj notatkę, chyba że taka sprawa już jest",
        input: z.object({ title: z.string().trim().min(1) }),
        handler: async (ctx, { title }) => {
          const vector = await ctx.ai.embed(title);
          const notes = await ctx.db.notes.findMany();
          // Vectors of another model (another length) are skipped, not compared.
          const same = notes.find((n) => n.vector.length === vector.length && cosine(n.vector, vector) >= 0.9);
          if (same) return { toast: `Ta sprawa już jest: ${same.title}`, data: { duplicateOf: same.id } };
          const note = await ctx.db.notes.insert({ title, vector });
          return { toast: "Notatka dodana.", data: { id: note.id } };
        },
      },
    },
  });

export default dedupe;
