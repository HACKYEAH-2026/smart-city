import type { PluginModule } from "@app/shared";

/**
 * PRZYKŁAD wtyczki wgrywanej w locie (nie jest wbudowana). Demo:
 *   bun run plugin:upload apps/api/src/plugins/examples/benches.ts
 * Używana też przez testy integracyjne i E2E wgrywania wtyczek.
 */
type Bench = { park: string; problem: string };

const benches: PluginModule = ({ definePlugin, ui, z }) =>
  definePlugin({
    id: "benches",
    name: "Ławki",
    version: "1.0.0",
    icon: "🪑",
    description: "Zgłaszanie zepsutych ławek w parkach.",
    permissions: ["storage"],
    nav: [{ view: "main", label: "Ławki" }],
    views: {
      main: async (ctx) => {
        const items = await ctx.storage.list<Bench>("benches");
        return ui.screen("Ławki w parkach", [
          ui.form({
            submitLabel: "Zgłoś ławkę",
            submit: ui.tool("report"),
            children: [
              ui.textInput({ name: "park", label: "Park" }),
              ui.textInput({ name: "problem", label: "Co jest nie tak?" }),
            ],
          }),
          ui.list(
            "Zepsute ławki",
            items.length
              ? items.map((d) => ui.card({ title: d.data.park, subtitle: d.data.problem }))
              : [ui.empty("Wszystkie ławki są całe.")],
          ),
        ]);
      },
    },
    tools: {
      report: {
        description: "Zgłoś zepsutą ławkę w parku",
        input: z.object({ park: z.string().trim().min(1), problem: z.string().trim().max(200).default("") }),
        handler: async (ctx, input) => {
          await ctx.storage.add("benches", input);
          return { toast: "Dziękujemy! Ławka trafiła na listę.", refresh: true };
        },
      },
    },
  });

export default benches;
