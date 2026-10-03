import type { Context, FileId, GeoLocation, PluginModule } from "@app/plugin-sdk";

/**
 * REFERENCE PLUGIN: issue reports.
 * Flow: form (optional photo and place on the map) → ctx.ai.findSimilar checks open issues →
 * if one is similar, we ask "is this the same problem?" → merging attaches the resident's report
 * (description + photo) to the earlier issue. Only the community admin changes the status.
 * Data lives in declared tables (`issues`, `reports`) with foreign keys to platform users and files.
 * The module imports nothing at runtime (only `import type`) — the host provides the SDK.
 */
const CATEGORY_VALUES = ["lighting", "roads", "greenery", "cleanliness", "other"] as const;
type Category = (typeof CATEGORY_VALUES)[number];
const CATEGORIES: { value: Category; label: string }[] = [
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
/** "1 osoba zgłasza", "3 osoby zgłaszają", "5 osób zgłasza" (Polish plural: 2–4 except 12–14 take "osoby"). */
const supporters = (n: number) => {
  const few = [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100);
  return n === 1 ? "1 osoba zgłasza" : few ? `${n} osoby zgłaszają` : `${n} osób zgłasza`;
};

type Draft = { title: string; description: string; category: Category; photo?: FileId; location?: GeoLocation };

const issues: PluginModule = ({ definePlugin, ui, z, fileRef, geoLocation, t }) => {
  const tables = {
    issues: t.table(
      {
        title: t.text(),
        description: t.text().default(""),
        category: t.enum(CATEGORY_VALUES).default("other"),
        status: t.enum(["open", "accepted", "fixed"]).default("open"),
        photo: t.ref("file").optional(),
        /** Where the problem is (picked on the app's map), with its address. */
        location: t.json<GeoLocation>().optional(),
        reporter: t.ref("user"),
      },
      { indexes: [["status"]] },
    ),
    /** A resident's report under an issue (including the first reporter's); one per person per issue. */
    reports: t.table(
      {
        issue: t.ref("issues"),
        author: t.ref("user"),
        description: t.text().default(""),
        photo: t.ref("file").optional(),
      },
      { unique: [["issue", "author"]] },
    ),
  };
  type Ctx = Context<typeof tables>;

  const draftSchema = z.object({
    title: z.string().trim().min(3, "Opisz problem w kilku słowach").max(120),
    category: z.enum(CATEGORY_VALUES).default("other"),
    description: z.string().trim().max(2000).default(""),
    photo: fileRef().optional(),
    location: geoLocation().optional(),
  });
  const jsonSchema = z.string().transform((s, ctx) => {
    try {
      return JSON.parse(s);
    } catch {
      ctx.addIssue({ code: "custom", message: "Invalid JSON" });
      return z.NEVER;
    }
  });
  /** Form draft passed as a JSON param/argument; invalid = null. */
  const parseDraft = (json: string | undefined): Draft | null => {
    const parsed = jsonSchema.pipe(draftSchema).safeParse(json ?? "");
    return parsed.success ? parsed.data : null;
  };

  /** Attaches the user's report to an issue (updates it if they already reported this issue). */
  const addReport = (ctx: Ctx, issue: string, draft: Pick<Draft, "description" | "photo">) =>
    ctx.db.reports.upsert(
      { issue, author: ctx.user.id, description: draft.description, photo: draft.photo ?? null },
      { on: ["issue", "author"] },
    );

  /** How many residents report each of the issues (the first reporter included): issue id → count. */
  const supportOf = async (ctx: Ctx, ids: string[]) => {
    const reports = await ctx.db.reports.findMany({ where: { issue: { in: ids } }, limit: 1000 });
    const counts = reports.reduce((m, r) => m.set(r.issue, (m.get(r.issue) ?? 0) + 1), new Map<string, number>());
    return (id: string) => counts.get(id) ?? 0;
  };

  /** What the AI compares: the title, the description and the address (the same lamp post is at the same address). */
  const describe = (i: { title: string; description: string; location?: GeoLocation | null }) =>
    [i.title, i.description, i.location?.address].filter(Boolean).join(". ");

  /** The open issues placed on the map, one layer per status (its tone colours the pins); nothing when none is. */
  const openIssuesMap = (
    items: { id: string; title: string; status: keyof typeof STATUS; location: GeoLocation | null }[],
    count: (id: string) => number,
  ) => {
    const layer = (status: "open" | "accepted") =>
      ui.map.pins(
        STATUS[status].text,
        items.flatMap((i) =>
          i.status === status && i.location
            ? [
                {
                  id: i.id,
                  at: i.location,
                  title: i.title,
                  subtitle: supporters(count(i.id)),
                  onPress: ui.navigate("detail", { id: i.id }),
                },
              ]
            : [],
        ),
        STATUS[status].tone,
      );
    const layers = [layer("open"), layer("accepted")].filter((l) => l.items.length);
    return layers.length ? [ui.map({ label: "Mapa zgłoszeń", layers })] : [];
  };

  /** The issue's address and a map with its pin. */
  const issuePlace = (id: string, title: string, location: GeoLocation, tone: "info" | "warning" | "success") => [
    ...(location.address ? [ui.text(location.address, "soft")] : []),
    ui.map({
      label: "Miejsce zgłoszenia",
      layers: [
        ui.map.pins(
          "Zgłoszenie",
          [{ id, at: location, title, ...(location.address ? { subtitle: location.address } : {}) }],
          tone,
        ),
      ],
    }),
  ];

  return definePlugin({
    id: "issues",
    name: "Zgłoszenia",
    version: "3.2.0",
    icon: "🛠️",
    description: "Zgłaszanie usterek ze zdjęciem i miejscem na mapie; AI łączy zgłoszenia tego samego problemu.",
    permissions: ["db", "files", "ai"],
    nav: [{ view: "list", label: "Zgłoszenia" }],
    tables,

    views: {
      list: async (ctx) => {
        const items = await ctx.db.issues.findMany({ orderBy: { createdAt: "desc" } });
        const count = await supportOf(
          ctx,
          items.map((i) => i.id),
        );
        return ui.screen("Zgłoszenia", [
          ui.text(`Usterki zgłoszone przez mieszkańców: ${ctx.community.name}.`, "soft"),
          ui.button("Nowe zgłoszenie", ui.navigate("new")),
          ...openIssuesMap(items, count),
          ui.list(
            "Lista zgłoszeń",
            items.length
              ? items.map((i) =>
                  ui.card({
                    title: i.title,
                    subtitle: `${categoryLabel(i.category)} · ${supporters(count(i.id))}`,
                    badge: STATUS[i.status],
                    onPress: ui.navigate("detail", { id: i.id }),
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
              ui.locationInput({ name: "location", label: "Gdzie to jest? (opcjonalnie)" }),
              ui.imagePicker({ name: "photo", label: "Zdjęcie (opcjonalnie)" }),
            ],
          }),
          ui.button("Wróć do listy", ui.navigate("list"), "quiet"),
        ]),

      /** Question before merging: the form data comes in the `draft` param. */
      merge: async (ctx, params) => {
        const target = params.target ? await ctx.db.issues.get(params.target) : null;
        const draft = parseDraft(params.draft);
        if (!target || !draft) return ui.screen("Nie znaleziono", [ui.button("Wróć", ui.navigate("list"))]);
        return ui.screen("Czy to ten sam problem?", [
          ui.text(params.reason || "Znaleźliśmy podobne zgłoszenie w okolicy.", "soft"),
          ui.card({
            title: target.title,
            subtitle: categoryLabel(target.category),
            badge: STATUS[target.status],
            children: [
              ui.text(target.description || "Brak opisu."),
              ...(target.photo ? [ui.image(target.photo, `Zdjęcie: ${target.title}`)] : []),
            ],
          }),
          ui.button("Tak, dołącz moje zgłoszenie", ui.tool("merge", { target: target.id, draft: params.draft })),
          ui.button("Nie, to inny problem", ui.tool("report", { ...draft, force: true }), "quiet"),
        ]);
      },

      detail: async (ctx, params) => {
        const issue = params.id ? await ctx.db.issues.get(params.id) : null;
        if (!issue) return ui.screen("Nie znaleziono", [ui.empty("To zgłoszenie nie istnieje.")]);
        const reports = await ctx.db.reports.findMany({
          where: { issue: issue.id },
          orderBy: { createdAt: "asc" },
          with: { author: true },
        });
        const mine = reports.some((r) => r.author.id === ctx.user.id);
        const status = STATUS[issue.status];
        return ui.screen(issue.title, [
          ui.row([ui.badge(status.text, status.tone), ui.badge(categoryLabel(issue.category))]),
          ui.text(issue.description || "Brak opisu."),
          ...(issue.location ? issuePlace(issue.id, issue.title, issue.location, status.tone) : []),
          ...(issue.photo ? [ui.image(issue.photo, `Zdjęcie: ${issue.title}`)] : []),
          ui.stat("Poparcie", supporters(reports.length)),
          mine
            ? ui.badge("Zgłaszasz ten problem", "success")
            : ui.button("Ja też to widzę", ui.tool("support", { id: issue.id })),
          ...(ctx.user.role === "admin"
            ? [
                ui.row([
                  ui.button("Przyjmij", ui.tool("setStatus", { id: issue.id, status: "accepted" }), "quiet"),
                  ui.button("Oznacz jako naprawione", ui.tool("setStatus", { id: issue.id, status: "fixed" }), "quiet"),
                ]),
              ]
            : []),
          ui.heading(`Zgłoszenia mieszkańców (${reports.length})`, 3),
          ui.list(
            "Zgłoszenia mieszkańców",
            reports.map((r) =>
              ui.card({
                title: r.author.name,
                ...(r.description ? { subtitle: r.description } : {}),
                ...(r.photo ? { children: [ui.image(r.photo, `Zdjęcie od: ${r.author.name}`)] } : {}),
              }),
            ),
          ),
          ui.button("Wróć do listy", ui.navigate("list"), "quiet"),
        ]);
      },
    },

    dashboardWidgets: {
      /** The 3 open issues most residents report; tapping the tile opens the full list. */
      summary: {
        size: { w: 2, h: 3 },
        render: async (ctx) => {
          const open = await ctx.db.issues.findMany({ where: { status: { ne: "fixed" } }, limit: 1000 });
          const support = await supportOf(
            ctx,
            open.map((i) => i.id),
          );
          // A stable sort: equal support keeps the default order, newest first.
          const top = [...open].sort((a, b) => support(b.id) - support(a.id)).slice(0, 3);
          return ui.widget(
            "Zgłoszenia",
            [
              top.length
                ? ui.list(
                    "Najczęściej zgłaszane",
                    top.map((i) =>
                      ui.card({
                        title: i.title,
                        subtitle: supporters(support(i.id)),
                        badge: STATUS[i.status],
                        onPress: ui.navigate("detail", { id: i.id }),
                      }),
                    ),
                  )
                : ui.empty("Nie ma otwartych zgłoszeń."),
              ui.button("Zgłoś problem", ui.navigate("new")),
            ],
            ui.navigate("list"),
          );
        },
      },
    },

    tools: {
      report: {
        description:
          "Zgłoś usterkę w społeczności (opcjonalnie ze zdjęciem i miejscem: lat, lng, adres). Jeśli AI znajdzie ten sam problem, pyta o połączenie.",
        input: draftSchema.extend({ force: z.boolean().default(false) }),
        handler: async (ctx, { force, ...draft }) => {
          const open = force ? [] : await ctx.db.issues.findMany({ where: { status: { ne: "fixed" } }, limit: 50 });
          const [match] = await ctx.ai.findSimilar({ text: describe(draft), image: draft.photo ?? null }, open, {
            text: describe,
            image: (i) => i.photo,
            limit: 1,
          });
          if (match) {
            return {
              navigate: ui.navigate("merge", {
                target: match.item.id,
                draft: JSON.stringify(draft),
                reason: match.reason,
              }),
              data: { similar: match.item.id, reason: match.reason },
            };
          }
          const issue = await ctx.db.issues.insert({
            title: draft.title,
            description: draft.description,
            category: draft.category,
            photo: draft.photo ?? null,
            location: draft.location ?? null,
            reporter: ctx.user.id,
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
          const issue = await ctx.db.issues.get(target);
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
          if (!(await ctx.db.issues.get(id))) return { error: "To zgłoszenie już nie istnieje." };
          const already = await ctx.db.reports.count({ where: { issue: id, author: ctx.user.id } });
          if (!already) await ctx.db.reports.insert({ issue: id, author: ctx.user.id });
          return { toast: "Dzięki za potwierdzenie!", refresh: true };
        },
      },

      setStatus: {
        description: "Zmień status zgłoszenia (tylko administrator społeczności).",
        input: z.object({ id: z.string().min(1), status: z.enum(["open", "accepted", "fixed"]) }),
        requires: "admin",
        handler: async (ctx, { id, status }) => {
          const updated = await ctx.db.issues.update(id, { status });
          if (!updated) return { error: "To zgłoszenie już nie istnieje." };
          return { toast: `Status: ${STATUS[status].text}`, refresh: true };
        },
      },

      list: {
        description: "Lista otwartych zgłoszeń w społeczności (dla asystentów AI).",
        input: z.object({}),
        readOnly: true,
        handler: async (ctx) => {
          const open = await ctx.db.issues.findMany({ where: { status: { ne: "fixed" } } });
          return { data: open.map((i) => ({ id: i.id, title: i.title, category: i.category, status: i.status })) };
        },
      },
    },
  });
};

export default issues;
