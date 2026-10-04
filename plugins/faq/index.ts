import type { Context, PluginModule } from "@app/plugin-sdk";

/**
 * Public FAQ of the community, edited by its admins.
 * - Everyone reads the questions and answers (screen + dashboard widget with the first few questions).
 * - Admins add, edit, reorder (up / down) and remove entries.
 * - `listFaq` gives the whole FAQ to AI assistants, so they can answer residents from it.
 * Ordering: `position` is a timestamp used as a sort key (new entries go to the end, moving swaps two keys).
 * The module imports nothing at runtime (only `import type`); the host provides the SDK.
 */
const WIDGET_ITEMS = 3;

const faq: PluginModule = ({ definePlugin, ui, z, t }) => {
  const tables = {
    entries: t.table({ question: t.text(), answer: t.text(), position: t.timestamp() }, { indexes: [["position"]] }),
  };
  type Ctx = Context<typeof tables>;

  const id = z.string().min(1);
  const entryInput = {
    question: z.string().trim().min(3, "Pytanie jest za krótkie").max(200, "Pytanie jest za długie"),
    answer: z.string().trim().min(1, "Odpowiedź nie może być pusta").max(5000, "Odpowiedź jest za długa"),
  };
  const isAdmin = (ctx: Ctx) => ctx.user.role === "admin";
  const ordered = (ctx: Ctx) => ctx.db.entries.findMany({ orderBy: { position: "asc" }, limit: 500 });

  /** A sort key after the last entry (strictly greater, even if the clock has not moved). */
  const nextPosition = async (ctx: Ctx) => {
    const [last] = await ctx.db.entries.findMany({ orderBy: { position: "desc" }, limit: 1 });
    const now = ctx.now();
    return last && last.position.getTime() >= now.getTime() ? new Date(last.position.getTime() + 1) : now;
  };

  const entryForm = (
    submit: ReturnType<typeof ui.tool>,
    label: string,
    values?: { question: string; answer: string },
  ) =>
    ui.form({
      submitLabel: label,
      submit,
      children: [
        ui.textInput({ name: "question", label: values ? "Pytanie" : "Nowe pytanie", value: values?.question }),
        ui.textInput({ name: "answer", label: "Odpowiedź", multiline: true, value: values?.answer }),
      ],
    });

  return definePlugin({
    id: "faq",
    name: "FAQ",
    version: "1.0.0",
    icon: "💡",
    description: "Najczęściej zadawane pytania społeczności, redagowane przez administratorów.",
    permissions: ["db"],
    nav: [{ view: "list", label: "FAQ" }],
    tables,

    views: {
      list: async (ctx) => {
        const entries = await ordered(ctx);
        const admin = isAdmin(ctx);
        return ui.screen("Najczęściej zadawane pytania", [
          ...(admin ? [entryForm(ui.tool("addEntry"), "Dodaj pytanie")] : []),
          ui.list(
            "Pytania i odpowiedzi",
            entries.length
              ? entries.map((e, i) =>
                  ui.card({
                    title: e.question,
                    children: [
                      ui.text(e.answer),
                      ...(admin
                        ? [
                            ui.row([
                              ui.button("Edytuj", ui.navigate("edit", { id: e.id }), "quiet"),
                              ...(i > 0
                                ? [ui.button("W górę", ui.tool("moveEntry", { id: e.id, direction: "up" }), "quiet")]
                                : []),
                              ...(i < entries.length - 1
                                ? [ui.button("W dół", ui.tool("moveEntry", { id: e.id, direction: "down" }), "quiet")]
                                : []),
                              ui.button("Usuń", ui.tool("removeEntry", { id: e.id }), "danger"),
                            ]),
                          ]
                        : []),
                    ],
                  }),
                )
              : [ui.empty("FAQ jest jeszcze puste.")],
          ),
        ]);
      },

      entry: async (ctx, params) => {
        const e = params.id ? await ctx.db.entries.get(params.id) : null;
        if (!e) return ui.screen("Nie znaleziono", [ui.empty("Tego pytania nie ma w FAQ.")]);
        return ui.screen(e.question, [
          ui.text(e.answer),
          ...(isAdmin(ctx) ? [ui.button("Edytuj", ui.navigate("edit", { id: e.id }), "quiet")] : []),
          ui.button("Całe FAQ", ui.navigate("list"), "quiet"),
        ]);
      },

      edit: async (ctx, params) => {
        if (!isAdmin(ctx))
          return ui.screen("Brak dostępu", [
            ui.empty("FAQ edytują tylko administratorzy."),
            ui.button("Całe FAQ", ui.navigate("list"), "quiet"),
          ]);
        const e = params.id ? await ctx.db.entries.get(params.id) : null;
        if (!e) return ui.screen("Nie znaleziono", [ui.empty("Tego pytania nie ma w FAQ.")]);
        return ui.screen("Edycja pytania", [
          entryForm(ui.tool("updateEntry", { id: e.id }), "Zapisz zmiany", e),
          ui.button("Anuluj", ui.navigate("list"), "quiet"),
        ]);
      },
    },

    dashboardWidgets: {
      top: {
        size: { w: 3, h: 3 },
        render: async (ctx) => {
          const total = await ctx.db.entries.count();
          if (!total)
            return ui.widget("FAQ", [
              ui.empty("Nie ma jeszcze pytań."),
              ui.button("Całe FAQ", ui.navigate("list"), "quiet"),
            ]);
          const first = await ctx.db.entries.findMany({ orderBy: { position: "asc" }, limit: WIDGET_ITEMS });
          return ui.widget("FAQ", [
            ...first.map((e) => ui.card({ title: e.question, onPress: ui.navigate("entry", { id: e.id }) })),
            ui.button(`Wszystkie pytania (${total})`, ui.navigate("list"), "quiet"),
          ]);
        },
      },
    },

    tools: {
      addEntry: {
        description: "Dodaj pytanie z odpowiedzią na koniec FAQ (tylko administrator).",
        input: z.object(entryInput),
        requires: "admin",
        handler: async (ctx, input) => {
          const e = await ctx.db.entries.insert({ ...input, position: await nextPosition(ctx) });
          return { toast: "Pytanie dodane do FAQ.", refresh: true, data: { id: e.id } };
        },
      },

      updateEntry: {
        description: "Zmień treść pytania lub odpowiedzi w FAQ (tylko administrator).",
        input: z.object({ id, ...entryInput }),
        requires: "admin",
        handler: async (ctx, { id: entryId, ...input }) => {
          if (!(await ctx.db.entries.update(entryId, input))) return { error: "Tego pytania nie ma w FAQ." };
          return { toast: "Zmiany zapisane.", navigate: ui.navigate("list"), data: { id: entryId } };
        },
      },

      moveEntry: {
        description: "Przesuń pytanie w górę albo w dół listy FAQ (tylko administrator).",
        input: z.object({ id, direction: z.enum(["up", "down"]) }),
        requires: "admin",
        handler: async (ctx, input) => {
          const entries = await ordered(ctx);
          const i = entries.findIndex((e) => e.id === input.id);
          if (i < 0) return { error: "Tego pytania nie ma w FAQ." };
          const other = entries[input.direction === "up" ? i - 1 : i + 1];
          if (!other) return { refresh: true };
          const current = entries[i];
          if (!current) return { error: "Tego pytania nie ma w FAQ." };
          await ctx.db.entries.update(current.id, { position: other.position });
          await ctx.db.entries.update(other.id, { position: current.position });
          return { refresh: true };
        },
      },

      removeEntry: {
        description: "Usuń pytanie z FAQ (tylko administrator).",
        input: z.object({ id }),
        requires: "admin",
        handler: async (ctx, input) => {
          if (!(await ctx.db.entries.delete(input.id))) return { error: "Tego pytania nie ma w FAQ." };
          return { toast: "Pytanie usunięte z FAQ.", refresh: true };
        },
      },

      listFaq: {
        description: "Całe FAQ społeczności w kolejności ustalonej przez administratora (dla asystentów AI).",
        input: z.object({}),
        readOnly: true,
        handler: async (ctx) => ({
          data: (await ordered(ctx)).map((e) => ({ id: e.id, question: e.question, answer: e.answer })),
        }),
      },
    },
  });
};

export default faq;
