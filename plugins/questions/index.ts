import type { Context, PluginModule } from "@app/plugin-sdk";

/**
 * Questions and answers: residents ask the community admin (e.g. the city office or the housing estate board),
 * and the admin answers publicly.
 * - Anyone can ask a question; everyone can read questions and answers.
 * - Only admins answer (answering again replaces the answer).
 * - The author removes only their own question; admins remove any question.
 * - Dashboard widget (admins only): how many questions are waiting for an answer.
 * The module imports nothing at runtime (only `import type`); the host provides the SDK.
 */
const STATUS = {
  pending: { text: "Czeka na odpowiedź", tone: "warning" },
  answered: { text: "Odpowiedziano", tone: "success" },
} as const;

const questions: PluginModule = ({ definePlugin, ui, z, t }) => {
  const tables = {
    questions: t.table(
      {
        title: t.text(),
        details: t.text().default(""),
        author: t.ref("user"),
        status: t.enum(["pending", "answered"]).default("pending"),
        answer: t.text().optional(),
        answeredAt: t.timestamp().optional(),
      },
      { indexes: [["createdAt"], ["status"]] },
    ),
  };
  type Ctx = Context<typeof tables>;

  const id = z.string().min(1);
  const isAdmin = (ctx: Ctx) => ctx.user.role === "admin";
  const canRemove = (ctx: Ctx, authorId: string) => authorId === ctx.user.id || isAdmin(ctx);

  /** "1 pytanie czeka", "3 pytania czekają", "5 pytań czeka" (Polish plural forms). */
  const pendingCount = (n: number) => {
    const few = n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14);
    if (n === 1) return "1 pytanie czeka na odpowiedź";
    return few ? `${n} pytania czekają na odpowiedź` : `${n} pytań czeka na odpowiedź`;
  };

  const askForm = () =>
    ui.form({
      submitLabel: "Zadaj pytanie",
      submit: ui.tool("ask"),
      children: [
        ui.textInput({ name: "title", label: "Twoje pytanie" }),
        ui.textInput({ name: "details", label: "Szczegóły (opcjonalnie)", multiline: true }),
      ],
    });

  return definePlugin({
    id: "questions",
    name: "Pytania i odpowiedzi",
    version: "1.0.0",
    icon: "❓",
    description: "Mieszkańcy zadają pytania administratorowi, który odpowiada publicznie.",
    permissions: ["db"],
    nav: [{ view: "list", label: "Pytania" }],
    tables,

    views: {
      list: async (ctx) => {
        const items = await ctx.db.questions.findMany({ orderBy: { createdAt: "desc" }, with: { author: true } });
        return ui.screen("Pytania i odpowiedzi", [
          ...(isAdmin(ctx) ? [] : [askForm()]),
          ui.list(
            "Lista pytań",
            items.length
              ? items.map((q) =>
                  ui.card({
                    title: q.title,
                    subtitle: q.author.name,
                    badge: STATUS[q.status],
                    onPress: ui.navigate("item", { id: q.id }),
                  }),
                )
              : [ui.empty("Nie ma jeszcze pytań.")],
          ),
        ]);
      },

      item: async (ctx, params) => {
        const q = params.id ? await ctx.db.questions.get(params.id, { with: { author: true } }) : null;
        if (!q) return ui.screen("Nie znaleziono", [ui.empty("To pytanie nie istnieje.")]);
        const status = STATUS[q.status];
        return ui.screen(q.title, [
          ui.row([ui.badge(status.text, status.tone)]),
          ...(q.details ? [ui.text(q.details)] : []),
          ui.text(`Pyta: ${q.author.name}`, "soft"),
          ui.heading("Odpowiedź", 3),
          ui.text(q.answer || "Administrator jeszcze nie odpowiedział.", q.answer ? undefined : "soft"),
          ...(isAdmin(ctx)
            ? [
                ui.form({
                  submitLabel: q.answer ? "Zmień odpowiedź" : "Odpowiedz",
                  submit: ui.tool("answer", { id: q.id }),
                  children: [ui.textInput({ name: "answer", label: "Odpowiedź", multiline: true })],
                }),
              ]
            : []),
          ...(canRemove(ctx, q.author.id)
            ? [ui.button("Usuń pytanie", ui.tool("remove", { id: q.id }), "danger")]
            : []),
          ui.button("Wszystkie pytania", ui.navigate("list"), "quiet"),
        ]);
      },
    },

    dashboardWidgets: {
      pending: {
        size: { w: 3, h: 2 },
        // Always drawn: the admins see what waits for an answer, residents see how to ask.
        render: async (ctx) => {
          if (!isAdmin(ctx))
            return ui.widget("Pytania mieszkańców", [
              ui.text("Zadaj pytanie administratorowi.", "soft"),
              ui.button("Zobacz pytania", ui.navigate("list")),
            ]);
          const waiting = await ctx.db.questions.count({ where: { status: "pending" } });
          return ui.widget("Pytania mieszkańców", [
            ui.text(waiting ? pendingCount(waiting) : "Nie czeka żadne pytanie.", "soft"),
            ui.button("Odpowiedz na pytania", ui.navigate("list")),
          ]);
        },
      },
    },

    tools: {
      ask: {
        description: "Zadaj pytanie administratorowi społeczności.",
        input: z.object({
          title: z.string().trim().min(3, "Pytanie jest za krótkie").max(200, "Pytanie jest za długie"),
          details: z.string().trim().max(5000, "Opis jest za długi").default(""),
        }),
        handler: async (ctx, input) => {
          const q = await ctx.db.questions.insert({ ...input, author: ctx.user.id });
          return {
            toast: "Pytanie wysłane. Administrator odpowie wkrótce.",
            navigate: ui.navigate("item", { id: q.id }),
            data: { id: q.id },
          };
        },
      },

      answer: {
        description: "Odpowiedz na pytanie mieszkańca albo zmień odpowiedź (tylko administrator).",
        input: z.object({
          id,
          answer: z.string().trim().min(1, "Odpowiedź nie może być pusta").max(5000, "Odpowiedź jest za długa"),
        }),
        requires: "admin",
        handler: async (ctx, input) => {
          const updated = await ctx.db.questions.update(input.id, {
            answer: input.answer,
            status: "answered",
            answeredAt: ctx.now(),
          });
          if (!updated) return { error: "To pytanie nie istnieje." };
          return { toast: "Odpowiedź zapisana.", refresh: true, data: { id: input.id } };
        },
      },

      remove: {
        description: "Usuń pytanie (autor pytania albo administrator).",
        input: z.object({ id }),
        handler: async (ctx, input) => {
          const q = await ctx.db.questions.get(input.id);
          if (!q) return { error: "To pytanie nie istnieje." };
          if (!canRemove(ctx, q.author)) return { error: "Możesz usuwać tylko swoje pytania." };
          await ctx.db.questions.delete(input.id);
          return { toast: "Pytanie usunięte.", navigate: ui.navigate("list"), data: { id: input.id } };
        },
      },

      listQuestions: {
        description: "Lista pytań mieszkańców z odpowiedziami, najnowsze najpierw (dla asystentów AI).",
        input: z.object({}),
        readOnly: true,
        handler: async (ctx) => {
          const items = await ctx.db.questions.findMany({ orderBy: { createdAt: "desc" } });
          return {
            data: items.map((q) => ({
              id: q.id,
              title: q.title,
              details: q.details,
              status: q.status,
              answer: q.answer ?? null,
              createdAt: q.createdAt,
            })),
          };
        },
      },
    },
  });
};

export default questions;
