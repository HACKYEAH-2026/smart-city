import type { Context, Doc, FileId, PluginModule } from "@app/plugin-sdk";

/**
 * REFERENCE PLUGIN: issue reports.
 * Flow: form (optional photo) → ctx.ai.findSimilar checks open issues →
 * if one is similar, we ask "is this the same problem?" → merging attaches the resident's report
 * (description + photo) to the earlier issue. Only the community admin changes the status.
 * The module imports nothing at runtime (only `import type`) — the host provides the SDK.
 */
type Status = "open" | "accepted" | "fixed";
type Issue = { title: string; description: string; category: string; photo?: FileId; status: Status };
/** A resident's report under an issue; key `${issueId}:${userId}` = one per person. */
type Report = { issueId: string; author: string; description: string; photo?: FileId };
type Draft = { title: string; description: string; category: string; photo?: FileId };

const CATEGORIES = [
  { value: "lighting", label: "Oświetlenie" },
  { value: "roads", label: "Drogi i chodniki" },
  { value: "greenery", label: "Zieleń" },
  { value: "cleanliness", label: "Czystość" },
  { value: "other", label: "Inne" },
];
const STATUS = {
  open: { text: "Nowe", tone: "info" },
  accepted: { text: "Przyjęte", tone: "warning" },
  fixed: { text: "Naprawione", tone: "success" },
} as const;

const categoryLabel = (v: string) => CATEGORIES.find((c) => c.value === v)?.label ?? v;
const supporters = (n: number) => (n === 1 ? "1 osoba zgłasza" : `${n} osób zgłasza`);
const issueText = (d: Doc<Issue>) => `${d.data.title}. ${d.data.description}`;

async function addReport(ctx: Context, issueId: string, draft: Draft) {
  if (draft.photo) await ctx.files.keep(draft.photo);
  await ctx.db.upsert<Report>("reports", `${issueId}:${ctx.user.id}`, {
    issueId,
    author: ctx.user.name,
    description: draft.description,
    ...(draft.photo ? { photo: draft.photo } : {}),
  });
}

const issues: PluginModule = ({ definePlugin, ui, z, fileRef }) => {
  const draftSchema = z.object({
    title: z.string().trim().min(3, "Opisz problem w kilku słowach").max(120),
    category: z.enum(CATEGORIES.map((c) => c.value) as [string, ...string[]]).default("other"),
    description: z.string().trim().max(2000).default(""),
    photo: fileRef().optional(),
  });
  /** Form draft passed as a JSON param/argument; invalid = null. */
  const parseDraft = (json: string | undefined): Draft | null => {
    try {
      const r = draftSchema.safeParse(JSON.parse(json ?? "null"));
      return r.success ? r.data : null;
    } catch {
      return null;
    }
  };

  return definePlugin({
    id: "issues",
    name: "Zgłoszenia",
    version: "2.0.0",
    icon: "🛠️",
    description: "Zgłaszanie usterek ze zdjęciem; AI łączy zgłoszenia tego samego problemu.",
    permissions: ["db", "files", "ai"],
    nav: [{ view: "list", label: "Zgłoszenia" }],

    views: {
      list: async (ctx) => {
        const items = await ctx.db.list<Issue>("issues");
        const reports = await ctx.db.list<Report>("reports", { limit: 500 });
        const count = (id: string) => reports.filter((r) => r.data.issueId === id).length;
        return ui.screen("Zgłoszenia", [
          ui.text(`Usterki zgłoszone przez mieszkańców: ${ctx.community.name}.`, "soft"),
          ui.button("Nowe zgłoszenie", ui.navigate("new")),
          ui.list(
            "Lista zgłoszeń",
            items.length
              ? items.map((d) =>
                  ui.card({
                    title: d.data.title,
                    subtitle: `${categoryLabel(d.data.category)} · ${supporters(count(d.id))}`,
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
              ui.imagePicker({ name: "photo", label: "Zdjęcie (opcjonalnie)" }),
            ],
          }),
          ui.button("Wróć do listy", ui.navigate("list"), "quiet"),
        ]),

      /** Confirmation before merging: form data arrives in the `draft` param. */
      merge: async (ctx, params) => {
        const target = params.target ? await ctx.db.get<Issue>("issues", params.target) : null;
        const draft = parseDraft(params.draft);
        if (!target || !draft) return ui.screen("Nie znaleziono", [ui.button("Wróć", ui.navigate("list"))]);
        return ui.screen("Czy to ten sam problem?", [
          ui.text(params.reason || "Znaleźliśmy podobne zgłoszenie w okolicy.", "soft"),
          ui.card({
            title: target.data.title,
            subtitle: categoryLabel(target.data.category),
            badge: STATUS[target.data.status],
            children: [
              ui.text(target.data.description || "Brak opisu."),
              ...(target.data.photo ? [ui.image(target.data.photo, `Zdjęcie: ${target.data.title}`)] : []),
            ],
          }),
          ui.button("Tak, dołącz moje zgłoszenie", ui.tool("merge", { target: target.id, draft: params.draft })),
          ui.button("Nie, to inny problem", ui.tool("report", { ...draft, force: true }), "quiet"),
        ]);
      },

      detail: async (ctx, params) => {
        const doc = params.id ? await ctx.db.get<Issue>("issues", params.id) : null;
        if (!doc) return ui.screen("Nie znaleziono", [ui.empty("To zgłoszenie nie istnieje.")]);
        const reports = await ctx.db.list<Report>("reports", { where: { issueId: doc.id }, order: "oldest" });
        const mine = reports.some((r) => r.id === `${doc.id}:${ctx.user.id}`);
        const status = STATUS[doc.data.status];
        return ui.screen(doc.data.title, [
          ui.row([ui.badge(status.text, status.tone), ui.badge(categoryLabel(doc.data.category))]),
          ui.text(doc.data.description || "Brak opisu."),
          ...(doc.data.photo ? [ui.image(doc.data.photo, `Zdjęcie: ${doc.data.title}`)] : []),
          ui.stat("Poparcie", supporters(reports.length)),
          mine
            ? ui.badge("Zgłaszasz ten problem", "success")
            : ui.button("Ja też to widzę", ui.tool("support", { id: doc.id })),
          ...(ctx.user.role === "admin"
            ? [
                ui.row([
                  ui.button("Przyjmij", ui.tool("setStatus", { id: doc.id, status: "accepted" }), "quiet"),
                  ui.button("Oznacz jako naprawione", ui.tool("setStatus", { id: doc.id, status: "fixed" }), "quiet"),
                ]),
              ]
            : []),
          ui.heading(`Zgłoszenia mieszkańców (${reports.length})`, 3),
          ui.list(
            "Zgłoszenia mieszkańców",
            reports.map((r) =>
              ui.card({
                title: r.data.author,
                ...(r.data.description ? { subtitle: r.data.description } : {}),
                ...(r.data.photo ? { children: [ui.image(r.data.photo, `Zdjęcie od: ${r.data.author}`)] } : {}),
              }),
            ),
          ),
          ui.button("Wróć do listy", ui.navigate("list"), "quiet"),
        ]);
      },
    },

    tools: {
      report: {
        description:
          "Zgłoś usterkę w społeczności (opcjonalnie ze zdjęciem). Jeśli AI znajdzie ten sam problem, pyta o połączenie.",
        input: draftSchema.extend({ force: z.boolean().default(false) }),
        handler: async (ctx, { force, ...draft }) => {
          if (!force) {
            const open = await ctx.db.list<Issue>("issues", { limit: 50 });
            const candidates = open.filter((d) => d.data.status !== "fixed");
            const [match] = await ctx.ai.findSimilar(
              { text: `${draft.title}. ${draft.description}`, ...(draft.photo ? { image: draft.photo } : {}) },
              candidates,
              { text: issueText, image: (d) => d.data.photo, limit: 1 },
            );
            if (match) {
              return {
                navigate: ui.navigate("merge", {
                  target: match.doc.id,
                  draft: JSON.stringify(draft),
                  reason: match.reason,
                }),
                data: { similar: match.doc.id, reason: match.reason },
              };
            }
          }
          if (draft.photo) await ctx.files.keep(draft.photo);
          const issue = await ctx.db.create<Issue>("issues", {
            title: draft.title,
            description: draft.description,
            category: draft.category,
            status: "open",
            ...(draft.photo ? { photo: draft.photo } : {}),
          });
          await addReport(ctx, issue.id, draft);
          return {
            toast: "Dziękujemy! Zgłoszenie zostało wysłane.",
            navigate: ui.navigate("detail", { id: issue.id }),
            data: { id: issue.id },
          };
        },
      },

      merge: {
        description: "Dołącz zgłoszenie mieszkańca (opis, zdjęcie) do istniejącego zgłoszenia tego samego problemu.",
        input: z.object({ target: z.string().min(1), draft: z.string() }),
        handler: async (ctx, { target, draft }) => {
          const parsed = parseDraft(draft);
          const issue = await ctx.db.get<Issue>("issues", target);
          if (!issue || !parsed) return { error: "To zgłoszenie już nie istnieje." };
          await addReport(ctx, target, parsed);
          return {
            toast: "Dołączyliśmy Twoje zgłoszenie. Dzięki!",
            navigate: ui.navigate("detail", { id: target }),
            data: { id: target },
          };
        },
      },

      support: {
        description: "Potwierdź, że widzisz ten sam problem (bez opisu i zdjęcia).",
        input: z.object({ id: z.string().min(1) }),
        handler: async (ctx, { id }) => {
          if (!(await ctx.db.get<Issue>("issues", id))) return { error: "To zgłoszenie już nie istnieje." };
          await addReport(ctx, id, { title: "", description: "", category: "other" });
          return { toast: "Dzięki za potwierdzenie!", refresh: true };
        },
      },

      setStatus: {
        description: "Zmień status zgłoszenia (tylko administrator społeczności).",
        input: z.object({ id: z.string().min(1), status: z.enum(["open", "accepted", "fixed"]) }),
        requires: "admin",
        handler: async (ctx, { id, status }) => {
          const updated = await ctx.db.update<Issue>("issues", id, { status });
          if (!updated) return { error: "To zgłoszenie już nie istnieje." };
          return { toast: `Status: ${STATUS[status].text}`, refresh: true };
        },
      },

      list: {
        description: "Lista otwartych zgłoszeń w społeczności (dla asystentów AI).",
        input: z.object({}),
        readOnly: true,
        handler: async (ctx) => {
          const items = await ctx.db.list<Issue>("issues");
          return {
            data: items
              .filter((d) => d.data.status !== "fixed")
              .map((d) => ({ id: d.id, title: d.data.title, category: d.data.category, status: d.data.status })),
          };
        },
      },
    },
  });
};

export default issues;
