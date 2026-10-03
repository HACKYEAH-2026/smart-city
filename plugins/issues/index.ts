import type { PluginContext, PluginDoc, PluginModule } from "@app/plugin-sdk";

/**
 * WZORZEC WTYCZKI: zgłoszenia usterek z poparciem „+1” i łączeniem duplikatów.
 * Moduł nic nie importuje w runtime (tylko `import type`) — SDK dostaje od hosta.
 * Ten sam plik można wgrać przez POST /api/admin/plugins (bun run plugin:upload plugins/issues).
 */
type Issue = {
  title: string;
  description: string;
  category: string;
  status: "new" | "accepted" | "fixed";
  voters: string[];
};

const CATEGORIES = [
  { value: "lighting", label: "Oświetlenie" },
  { value: "roads", label: "Drogi i chodniki" },
  { value: "greenery", label: "Zieleń" },
  { value: "cleanliness", label: "Czystość" },
  { value: "other", label: "Inne" },
];
const STATUS = {
  new: { text: "Nowe", tone: "info" },
  accepted: { text: "Przyjęte", tone: "warning" },
  fixed: { text: "Naprawione", tone: "success" },
} as const;

const categoryLabel = (v: string) => CATEGORIES.find((c) => c.value === v)?.label ?? v;
const words = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length > 2),
  );

/** Duplikat: ta sama kategoria i co najmniej połowa znaczących słów tytułu wspólna. */
async function findDuplicate(ctx: PluginContext, input: { title: string; category: string }) {
  const mine = words(input.title);
  if (!mine.size) return null;
  const open = (await ctx.storage.list<Issue>("issues")).filter(
    (d) => d.data.category === input.category && d.data.status !== "fixed",
  );
  return (
    open.find((d) => {
      const theirs = words(d.data.title);
      const common = [...mine].filter((w) => theirs.has(w)).length;
      return common / Math.min(mine.size, theirs.size || 1) >= 0.5;
    }) ?? null
  );
}

const supporters = (n: number) => (n === 1 ? "1 osoba popiera" : `${n} osób popiera`);

const issues: PluginModule = ({ definePlugin, ui, z }) =>
  definePlugin({
    id: "issues",
    name: "Zgłoszenia",
    version: "1.0.0",
    icon: "🛠️",
    description: "Zgłaszanie usterek w okolicy, poparcie „+1” i automatyczne łączenie duplikatów.",
    permissions: ["storage"],
    nav: [{ view: "list", label: "Zgłoszenia" }],

    views: {
      list: async (ctx) => {
        const items = await ctx.storage.list<Issue>("issues");
        return ui.screen("Zgłoszenia", [
          ui.text(`Usterki zgłoszone przez mieszkańców: ${ctx.community.name}.`, "soft"),
          ui.button("Nowe zgłoszenie", ui.navigate("new")),
          ui.list(
            "Lista zgłoszeń",
            items.length
              ? items.map((d) =>
                  ui.card({
                    title: d.data.title,
                    subtitle: `${categoryLabel(d.data.category)} · ${supporters(d.data.voters.length)}`,
                    badge: STATUS[d.data.status],
                    onPress: ui.navigate("detail", { id: d.id }),
                  }),
                )
              : [ui.empty("Nie ma jeszcze zgłoszeń. Zgłoś pierwszą usterkę.")],
          ),
        ]);
      },

      new: () =>
        ui.screen("Nowe zgłoszenie", [
          ui.form({
            submitLabel: "Wyślij zgłoszenie",
            submit: ui.tool("report"),
            children: [
              ui.textInput({ name: "title", label: "Co się stało?" }),
              ui.select({ name: "category", label: "Kategoria", options: CATEGORIES, value: "other" }),
              ui.textInput({ name: "description", label: "Szczegóły i miejsce", multiline: true }),
            ],
          }),
          ui.button("Wróć do listy", ui.navigate("list"), "quiet"),
        ]),

      detail: async (ctx, params) => {
        const doc = params.id ? await ctx.storage.get<Issue>("issues", params.id) : null;
        if (!doc) return ui.screen("Nie znaleziono", [ui.empty("To zgłoszenie nie istnieje.")]);
        const voted = doc.data.voters.includes(ctx.user.id);
        return ui.screen(doc.data.title, [
          ui.row([
            ui.badge(STATUS[doc.data.status].text, STATUS[doc.data.status].tone),
            ui.badge(categoryLabel(doc.data.category)),
          ]),
          ui.text(doc.data.description || "Brak opisu."),
          ui.stat("Poparcie", supporters(doc.data.voters.length)),
          voted
            ? ui.badge("Popierasz to zgłoszenie", "success")
            : ui.button("+1 Popieram", ui.tool("upvote", { id: doc.id })),
          ui.button("Wróć do listy", ui.navigate("list"), "quiet"),
        ]);
      },
    },

    tools: {
      report: {
        description: "Zgłoś usterkę w społeczności. Jeśli podobne zgłoszenie już istnieje, dodaje do niego poparcie.",
        input: z.object({
          title: z.string().trim().min(3, "Opisz problem w kilku słowach").max(120),
          category: z.enum(CATEGORIES.map((c) => c.value) as [string, ...string[]]).default("other"),
          description: z.string().trim().max(2000).default(""),
        }),
        handler: async (ctx, input) => {
          const dup: PluginDoc<Issue> | null = await findDuplicate(ctx, input);
          if (dup) {
            const voters = dup.data.voters.includes(ctx.user.id) ? dup.data.voters : [...dup.data.voters, ctx.user.id];
            await ctx.storage.update("issues", dup.id, { voters });
            return {
              toast: "Takie zgłoszenie już istnieje — dodaliśmy Twoje poparcie.",
              navigate: ui.navigate("detail", { id: dup.id }),
            };
          }
          const doc = await ctx.storage.add<Issue>("issues", { ...input, status: "new", voters: [ctx.user.id] });
          return { toast: "Dziękujemy! Zgłoszenie zostało wysłane.", navigate: ui.navigate("detail", { id: doc.id }) };
        },
      },
      upvote: {
        description: "Poprzyj istniejące zgłoszenie (+1).",
        input: z.object({ id: z.string().min(1) }),
        handler: async (ctx, { id }) => {
          const doc = await ctx.storage.get<Issue>("issues", id);
          if (!doc) return { toast: "To zgłoszenie już nie istnieje." };
          if (!doc.data.voters.includes(ctx.user.id)) {
            await ctx.storage.update("issues", id, { voters: [...doc.data.voters, ctx.user.id] });
          }
          return { toast: "Dzięki za poparcie!", refresh: true };
        },
      },
    },
  });

export default issues;
