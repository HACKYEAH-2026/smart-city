import type { Context, PluginModule } from "@app/plugin-sdk";

/**
 * Neighbourly help: residents ask for help (carrying a heavy package, picking up a parcel from a parcel locker,
 * shopping) and neighbours volunteer.
 * Flow:
 * - Anyone posts a request (optionally with contact details, which stay hidden from volunteers until accepted).
 * - A neighbour opens a private chat with the author to ask for details, then sends a help offer.
 * - The author sees everyone who wrote or offered help, chats with each of them privately,
 *   and accepts or rejects each one (several volunteers can be accepted).
 * - Accepted volunteers get the author's contact details and a group chat with the author and the other accepted volunteers.
 * - The author marks the help as done per volunteer or for everyone at once (this also closes the request);
 *   each completed help gives the volunteer ranking points.
 * - The request author or an admin deletes a request (its chats go with it).
 * Data model: `helpers` holds one row per (request, volunteer) pair, and that row is also the private chat.
 * The module imports nothing at runtime (only `import type`); the host provides the SDK.
 */
const CATEGORY_VALUES = ["shopping", "carrying", "parcel", "other"] as const;
type Category = (typeof CATEGORY_VALUES)[number];
const CATEGORIES: { value: Category; label: string }[] = [
  { value: "shopping", label: "Zakupy" },
  { value: "carrying", label: "Wniesienie / przeniesienie" },
  { value: "parcel", label: "Odbiór paczki" },
  { value: "other", label: "Inne" },
];
const REQUEST_STATUS = {
  open: { text: "Szuka pomocy", tone: "info" },
  done: { text: "Zakończona", tone: "success" },
} as const;
const HELPER_STATUS = {
  asking: { text: "Pyta o szczegóły", tone: "neutral" },
  offered: { text: "Oferuje pomoc", tone: "info" },
  accepted: { text: "Pomoc przyjęta", tone: "warning" },
  rejected: { text: "Oferta odrzucona", tone: "neutral" },
  done: { text: "Pomoc wykonana", tone: "success" },
} as const;
const POINTS_PER_HELP = 10;

const categoryLabel = (v: string) => CATEGORIES.find((c) => c.value === v)?.label ?? v;
/** Polish plural forms: (1, "prośba", "prośby", "próśb"). */
const plural = (n: number, one: string, few: string, many: string) => {
  const isFew = n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14);
  return `${n} ${n === 1 ? one : isFew ? few : many}`;
};
/** Accepted volunteers (and those whose help is already done) are part of the team. */
const inTeam = (status: string) => status === "accepted" || status === "done";

const NO_THREAD_ACCESS = "Nie masz dostępu do tej rozmowy.";
const NO_GROUP_ACCESS = "Czat grupowy jest dostępny dla autora i przyjętych pomocników.";
const NOT_FOUND = "Ta prośba nie istnieje.";
const CLOSED = "Ta prośba jest już zakończona.";
const OWN_REQUEST = "Nie możesz zgłosić się do własnej prośby.";

const help: PluginModule = ({ definePlugin, ui, z, t }) => {
  const tables = {
    requests: t.table(
      {
        title: t.text(),
        details: t.text().default(""),
        category: t.enum(CATEGORY_VALUES).default("other"),
        when: t.text().default(""),
        /** Visible only to the author and accepted volunteers. */
        contact: t.text().default(""),
        author: t.ref("user"),
        status: t.enum(["open", "done"]).default("open"),
      },
      { indexes: [["status", "createdAt"], ["author"]] },
    ),
    /** One row per volunteer per request; it is also the private chat between that volunteer and the author. */
    helpers: t.table(
      {
        request: t.ref("requests"),
        volunteer: t.ref("user"),
        status: t.enum(["asking", "offered", "accepted", "rejected", "done"]).default("asking"),
        doneAt: t.timestamp().optional(),
      },
      { unique: [["request", "volunteer"]], indexes: [["volunteer", "status"], ["status"]] },
    ),
    threadMessages: t.table(
      { helper: t.ref("helpers"), author: t.ref("user"), text: t.text() },
      { indexes: [["helper", "createdAt"]] },
    ),
    groupMessages: t.table(
      { request: t.ref("requests"), author: t.ref("user"), text: t.text() },
      { indexes: [["request", "createdAt"]] },
    ),
  };
  type Ctx = Context<typeof tables>;

  const id = z.string().min(1);
  const text = z.string().trim().min(1, "Wiadomość nie może być pusta").max(2000, "Wiadomość jest za długa");
  const isAdmin = (ctx: Ctx) => ctx.user.role === "admin";

  const myHelper = async (ctx: Ctx, request: string) =>
    (await ctx.db.helpers.findMany({ where: { request, volunteer: ctx.user.id }, limit: 1 }))[0] ?? null;

  const loadHelper = async (ctx: Ctx, helperId: string) => {
    const helper = await ctx.db.helpers.get(helperId);
    const request = helper ? await ctx.db.requests.get(helper.request) : null;
    return helper && request ? { helper, request } : null;
  };
  const inThread = (ctx: Ctx, helper: { volunteer: string }, request: { author: string }) =>
    helper.volunteer === ctx.user.id || request.author === ctx.user.id;
  const inGroup = async (ctx: Ctx, request: { id: string; author: string }) =>
    request.author === ctx.user.id ||
    (await ctx.db.helpers.count({
      where: { request: request.id, volunteer: ctx.user.id, status: { in: ["accepted", "done"] } },
    })) > 0;

  const ranking = async (ctx: Ctx) => {
    const done = await ctx.db.helpers.findMany({ where: { status: "done" }, with: { volunteer: true }, limit: 1000 });
    const byUser = new Map<string, { id: string; name: string; helps: number }>();
    for (const h of done) {
      const row = byUser.get(h.volunteer.id) ?? { id: h.volunteer.id, name: h.volunteer.name, helps: 0 };
      row.helps += 1;
      byUser.set(row.id, row);
    }
    return [...byUser.values()]
      .map((r) => ({ ...r, points: r.helps * POINTS_PER_HELP }))
      .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, "pl"));
  };

  const chat = (messages: { author: { name: string }; text: string }[], submit: ReturnType<typeof ui.tool>) => [
    ui.list(
      "Wiadomości",
      messages.length
        ? messages.map((m) => ui.card({ title: m.author.name, subtitle: m.text }))
        : [ui.empty("Nie ma jeszcze wiadomości.")],
    ),
    ui.form({
      submitLabel: "Wyślij",
      submit,
      children: [ui.textInput({ name: "text", label: "Wiadomość", multiline: true })],
    }),
  ];

  const noAccess = (message: string) =>
    ui.screen("Brak dostępu", [ui.empty(message), ui.button("Wszystkie prośby", ui.navigate("list"), "quiet")]);

  return definePlugin({
    id: "help",
    name: "Pomoc sąsiedzka",
    version: "1.0.0",
    icon: "🤝",
    description: "Prośby o pomoc sąsiedzką: zakupy, paczki, wniesienie zakupów. Czaty z pomocnikami i ranking.",
    permissions: ["db"],
    nav: [
      { view: "list", label: "Pomoc sąsiedzka" },
      { view: "ranking", label: "Ranking pomocnych" },
    ],
    tables,

    views: {
      list: async (ctx) => {
        const open = await ctx.db.requests.findMany({
          where: { status: "open" },
          orderBy: { createdAt: "desc" },
          with: { author: true },
        });
        const mine = await ctx.db.requests.findMany({ where: { author: ctx.user.id }, orderBy: { createdAt: "desc" } });
        const helping = await ctx.db.helpers.findMany({
          where: { volunteer: ctx.user.id, status: { in: ["offered", "accepted", "done"] } },
          orderBy: { createdAt: "desc" },
          with: { request: true },
        });
        const others = open.filter((r) => r.author.id !== ctx.user.id);
        return ui.screen("Pomoc sąsiedzka", [
          ui.button("Poproś o pomoc", ui.navigate("new")),
          ...(mine.length
            ? [
                ui.list(
                  "Moje prośby",
                  mine.map((r) =>
                    ui.card({
                      title: r.title,
                      subtitle: categoryLabel(r.category),
                      badge: REQUEST_STATUS[r.status],
                      onPress: ui.navigate("request", { id: r.id }),
                    }),
                  ),
                ),
              ]
            : []),
          ...(helping.length
            ? [
                ui.list(
                  "Pomagam",
                  helping.map((h) =>
                    ui.card({
                      title: h.request.title,
                      badge: HELPER_STATUS[h.status],
                      onPress: ui.navigate("request", { id: h.request.id }),
                    }),
                  ),
                ),
              ]
            : []),
          ui.list(
            "Potrzebna pomoc",
            others.length
              ? others.map((r) =>
                  ui.card({
                    title: r.title,
                    subtitle: [categoryLabel(r.category), r.author.name, r.when].filter(Boolean).join(" · "),
                    onPress: ui.navigate("request", { id: r.id }),
                  }),
                )
              : [ui.empty("Nikt teraz nie potrzebuje pomocy.")],
          ),
          ui.button("Ranking pomocnych", ui.navigate("ranking"), "quiet"),
        ]);
      },

      new: () =>
        ui.screen("Poproś o pomoc", [
          ui.form({
            submitLabel: "Opublikuj prośbę",
            submit: ui.tool("createRequest"),
            children: [
              ui.textInput({ name: "title", label: "W czym potrzebujesz pomocy?" }),
              ui.select({ name: "category", label: "Rodzaj pomocy", options: CATEGORIES, value: "other" }),
              ui.textInput({ name: "when", label: "Na kiedy? (np. dziś do 18:00)" }),
              ui.textInput({ name: "details", label: "Szczegóły", multiline: true }),
              ui.textInput({
                name: "contact",
                label: "Kontakt (telefon, adres) – zobaczą go tylko przyjęci pomocnicy",
                multiline: true,
              }),
            ],
          }),
          ui.button("Wróć do listy", ui.navigate("list"), "quiet"),
        ]),

      request: async (ctx, params) => {
        const r = params.id ? await ctx.db.requests.get(params.id, { with: { author: true } }) : null;
        if (!r) return ui.screen("Nie znaleziono", [ui.empty(NOT_FOUND)]);
        const isAuthor = r.author.id === ctx.user.id;
        const status = REQUEST_STATUS[r.status];

        const helpers = isAuthor
          ? await ctx.db.helpers.findMany({
              where: { request: r.id },
              orderBy: { createdAt: "asc" },
              with: { volunteer: true },
            })
          : [];
        const mine = isAuthor ? null : await myHelper(ctx, r.id);
        const accepted = !!mine && inTeam(mine.status);
        const groupOpen = isAuthor ? helpers.some((h) => inTeam(h.status)) : accepted;

        const contact = !r.contact
          ? []
          : isAuthor
            ? [ui.text(`Twój kontakt (widoczny dla przyjętych pomocników): ${r.contact}`, "soft")]
            : accepted
              ? [ui.text(`Kontakt: ${r.contact}`)]
              : [ui.text("Dane kontaktowe zobaczysz, gdy autor przyjmie Twoją pomoc.", "soft")];

        const authorSection = [
          ui.heading(`Chętni do pomocy (${helpers.length})`, 3),
          ui.list(
            "Chętni do pomocy",
            helpers.length
              ? helpers.map((h) =>
                  ui.card({
                    title: h.volunteer.name,
                    badge: HELPER_STATUS[h.status],
                    children: [
                      ui.row([
                        ui.button("Rozmowa", ui.navigate("thread", { id: h.id }), "quiet"),
                        ...(h.status === "offered" || h.status === "rejected"
                          ? [ui.button("Przyjmij", ui.tool("respond", { helper: h.id, accept: true }))]
                          : []),
                        ...(h.status === "offered" || h.status === "accepted"
                          ? [ui.button("Odrzuć", ui.tool("respond", { helper: h.id, accept: false }), "quiet")]
                          : []),
                        ...(h.status === "accepted"
                          ? [ui.button("Wykonane", ui.tool("markDone", { request: r.id, helper: h.id }))]
                          : []),
                      ]),
                    ],
                  }),
                )
              : [ui.empty("Nikt jeszcze się nie zgłosił.")],
          ),
          ...(helpers.some((h) => h.status === "accepted")
            ? [ui.button("Wszyscy wykonali zadanie", ui.tool("markDone", { request: r.id }))]
            : []),
        ];

        const volunteerSection =
          r.status === "done" && !mine
            ? [ui.text(CLOSED, "soft")]
            : [
                ...(mine ? [ui.badge(HELPER_STATUS[mine.status].text, HELPER_STATUS[mine.status].tone)] : []),
                ui.button("Napisz do autora", ui.tool("contact", { request: r.id }), "quiet"),
                ...(r.status === "open" && (!mine || mine.status === "asking")
                  ? [ui.button("Zaoferuj pomoc", ui.tool("offer", { request: r.id }))]
                  : []),
              ];

        return ui.screen(r.title, [
          ui.row([ui.badge(status.text, status.tone), ui.badge(categoryLabel(r.category))]),
          ui.text(`Prosi: ${r.author.name}`, "soft"),
          ...(r.when ? [ui.text(`Na kiedy: ${r.when}`)] : []),
          ui.text(r.details || "Brak szczegółów."),
          ...contact,
          ...(isAuthor ? authorSection : volunteerSection),
          ...(groupOpen ? [ui.button("Czat grupowy", ui.navigate("group", { id: r.id }))] : []),
          ...(isAuthor || isAdmin(ctx)
            ? [ui.button("Usuń prośbę", ui.tool("deleteRequest", { id: r.id }), "danger")]
            : []),
          ui.button("Wszystkie prośby", ui.navigate("list"), "quiet"),
        ]);
      },

      /** Private chat between the author and one volunteer (`id` = helpers row). */
      thread: async (ctx, params) => {
        const h = params.id ? await ctx.db.helpers.get(params.id, { with: { volunteer: true, request: true } }) : null;
        if (!h || (h.volunteer.id !== ctx.user.id && h.request.author !== ctx.user.id))
          return noAccess(NO_THREAD_ACCESS);
        const isAuthor = h.request.author === ctx.user.id;
        const messages = await ctx.db.threadMessages.findMany({
          where: { helper: h.id },
          orderBy: { createdAt: "asc" },
          with: { author: true },
        });
        const status = HELPER_STATUS[h.status];
        return ui.screen(`Rozmowa: ${h.request.title}`, [
          ui.text(isAuthor ? `Rozmowa z: ${h.volunteer.name}` : "Rozmowa z autorem prośby", "soft"),
          ui.badge(status.text, status.tone),
          ...(!isAuthor && h.status === "asking" && h.request.status === "open"
            ? [ui.button("Zaoferuj pomoc", ui.tool("offer", { request: h.request.id }))]
            : []),
          ...(isAuthor && h.status === "offered"
            ? [
                ui.row([
                  ui.button("Przyjmij", ui.tool("respond", { helper: h.id, accept: true })),
                  ui.button("Odrzuć", ui.tool("respond", { helper: h.id, accept: false }), "quiet"),
                ]),
              ]
            : []),
          ...chat(messages, ui.tool("sendMessage", { helper: h.id })),
          ui.button("Wróć do prośby", ui.navigate("request", { id: h.request.id }), "quiet"),
        ]);
      },

      /** Group chat of the author and accepted volunteers (`id` = request). */
      group: async (ctx, params) => {
        const r = params.id ? await ctx.db.requests.get(params.id, { with: { author: true } }) : null;
        if (!r || !(await inGroup(ctx, { id: r.id, author: r.author.id }))) return noAccess(NO_GROUP_ACCESS);
        const team = await ctx.db.helpers.findMany({
          where: { request: r.id, status: { in: ["accepted", "done"] } },
          orderBy: { createdAt: "asc" },
          with: { volunteer: true },
        });
        const messages = await ctx.db.groupMessages.findMany({
          where: { request: r.id },
          orderBy: { createdAt: "asc" },
          with: { author: true },
        });
        return ui.screen(`Czat grupowy: ${r.title}`, [
          ui.text(`Uczestnicy: ${[r.author.name, ...team.map((h) => h.volunteer.name)].join(", ")}`, "soft"),
          ...(r.contact ? [ui.text(`Kontakt: ${r.contact}`)] : []),
          ...chat(messages, ui.tool("sendGroupMessage", { request: r.id })),
          ui.button("Wróć do prośby", ui.navigate("request", { id: r.id }), "quiet"),
        ]);
      },

      ranking: async (ctx) => {
        const rows = await ranking(ctx);
        const me = rows.find((r) => r.id === ctx.user.id);
        return ui.screen("Ranking pomocnych", [
          ui.text(`Za każdą wykonaną pomoc: ${POINTS_PER_HELP} pkt.`, "soft"),
          ui.stat("Twoje punkty", String(me?.points ?? 0)),
          ui.list(
            "Ranking",
            rows.length
              ? rows.map((r, i) =>
                  ui.card({
                    title: `${i + 1}. ${r.name}`,
                    subtitle: `${r.points} pkt · ${plural(r.helps, "pomoc", "pomoce", "pomocy")}`,
                  }),
                )
              : [ui.empty("Nikt jeszcze nie zdobył punktów.")],
          ),
          ui.button("Wszystkie prośby", ui.navigate("list"), "quiet"),
        ]);
      },
    },

    dashboardWidgets: {
      open: {
        size: { w: 3, h: 3 },
        render: async (ctx) => {
          const where = { status: "open" as const, author: { ne: ctx.user.id } };
          const latest = await ctx.db.requests.findMany({ where, orderBy: { createdAt: "desc" }, limit: 2 });
          if (!latest.length)
            return ui.widget("Pomoc sąsiedzka", [
              ui.text("Nikt teraz nie potrzebuje pomocy.", "soft"),
              ui.button("Poproś o pomoc", ui.navigate("new"), "quiet"),
            ]);
          const total = await ctx.db.requests.count({ where });
          return ui.widget("Pomoc sąsiedzka", [
            ui.text(plural(total, "prośba o pomoc", "prośby o pomoc", "próśb o pomoc"), "soft"),
            ...latest.map((r) => ui.card({ title: r.title, onPress: ui.navigate("request", { id: r.id }) })),
            ui.button("Zobacz wszystkie", ui.navigate("list"), "quiet"),
          ]);
        },
      },
    },

    tools: {
      createRequest: {
        description: "Poproś sąsiadów o pomoc (zakupy, paczka, wniesienie). Kontakt widzą tylko przyjęci pomocnicy.",
        input: z.object({
          title: z.string().trim().min(3, "Opisz w kilku słowach, w czym pomóc").max(120, "Tytuł jest za długi"),
          category: z.enum(CATEGORY_VALUES).default("other"),
          when: z.string().trim().max(120).default(""),
          details: z.string().trim().max(2000, "Opis jest za długi").default(""),
          contact: z.string().trim().max(300, "Kontakt jest za długi").default(""),
        }),
        handler: async (ctx, input) => {
          const r = await ctx.db.requests.insert({ ...input, author: ctx.user.id });
          return {
            toast: "Prośba opublikowana. Sąsiedzi zobaczą ją na liście.",
            navigate: ui.navigate("request", { id: r.id }),
            data: { id: r.id },
          };
        },
      },

      deleteRequest: {
        description: "Usuń prośbę razem z rozmowami (autor prośby albo administrator).",
        input: z.object({ id }),
        handler: async (ctx, input) => {
          const r = await ctx.db.requests.get(input.id);
          if (!r) return { error: NOT_FOUND };
          if (r.author !== ctx.user.id && !isAdmin(ctx)) return { error: "Możesz usuwać tylko swoje prośby." };
          await ctx.db.requests.delete(input.id);
          return { toast: "Prośba usunięta.", navigate: ui.navigate("list"), data: { id: input.id } };
        },
      },

      contact: {
        description: "Otwórz prywatną rozmowę z autorem prośby, żeby dopytać o szczegóły.",
        input: z.object({ request: id }),
        handler: async (ctx, input) => {
          const r = await ctx.db.requests.get(input.request);
          if (!r) return { error: NOT_FOUND };
          if (r.author === ctx.user.id) return { error: OWN_REQUEST };
          let helper = await myHelper(ctx, r.id);
          if (!helper) {
            if (r.status === "done") return { error: CLOSED };
            helper = await ctx.db.helpers.insert({ request: r.id, volunteer: ctx.user.id });
          }
          return { navigate: ui.navigate("thread", { id: helper.id }), data: { id: helper.id } };
        },
      },

      offer: {
        description: "Zaoferuj pomoc przy prośbie sąsiada.",
        input: z.object({ request: id }),
        handler: async (ctx, input) => {
          const r = await ctx.db.requests.get(input.request);
          if (!r) return { error: NOT_FOUND };
          if (r.author === ctx.user.id) return { error: OWN_REQUEST };
          if (r.status === "done") return { error: CLOSED };
          const existing = await myHelper(ctx, r.id);
          if (existing?.status === "rejected") return { error: "Autor nie przyjął Twojej oferty pomocy." };
          if (existing && existing.status !== "asking")
            return { toast: "Twoja oferta pomocy jest już wysłana.", data: { id: existing.id } };
          const helper = existing
            ? await ctx.db.helpers.update(existing.id, { status: "offered" })
            : await ctx.db.helpers.insert({ request: r.id, volunteer: ctx.user.id, status: "offered" });
          if (!helper) return { error: "Ta oferta pomocy już nie istnieje." };
          return { toast: "Oferta pomocy wysłana. Autor da Ci znać.", refresh: true, data: { id: helper.id } };
        },
      },

      respond: {
        description: "Przyjmij albo odrzuć ofertę pomocy (tylko autor prośby).",
        input: z.object({ helper: id, accept: z.boolean() }),
        handler: async (ctx, input) => {
          const found = await loadHelper(ctx, input.helper);
          if (!found) return { error: "Ta oferta nie istnieje." };
          const { helper, request } = found;
          if (request.author !== ctx.user.id) return { error: "Tylko autor prośby może przyjmować pomocników." };
          if (request.status === "done") return { error: CLOSED };
          if (helper.status === "asking") return { error: "Ta osoba nie zaoferowała jeszcze pomocy." };
          if (helper.status === "done") return { error: "Ta pomoc jest już wykonana." };
          await ctx.db.helpers.update(helper.id, { status: input.accept ? "accepted" : "rejected" });
          return {
            toast: input.accept
              ? "Pomoc przyjęta. Pomocnik widzi teraz Twój kontakt i czat grupowy."
              : "Oferta odrzucona.",
            refresh: true,
            data: { id: helper.id },
          };
        },
      },

      markDone: {
        description:
          "Potwierdź wykonanie pomocy: jednej osoby (helper) albo wszystkich przyjętych (zamyka prośbę). Pomocnicy dostają punkty.",
        input: z.object({ request: id, helper: id.optional() }),
        handler: async (ctx, input) => {
          const r = await ctx.db.requests.get(input.request);
          if (!r) return { error: NOT_FOUND };
          if (r.author !== ctx.user.id) return { error: "Tylko autor prośby może potwierdzić wykonanie." };
          let targets: { id: string }[];
          if (input.helper) {
            const h = await ctx.db.helpers.get(input.helper);
            if (!h || h.request !== r.id || h.status !== "accepted")
              return { error: "Wykonanie można potwierdzić tylko przyjętemu pomocnikowi." };
            targets = [h];
          } else {
            targets = await ctx.db.helpers.findMany({ where: { request: r.id, status: "accepted" } });
            if (!targets.length) return { error: "Nikt nie ma przyjętej pomocy do potwierdzenia." };
          }
          const now = ctx.now();
          for (const h of targets) await ctx.db.helpers.update(h.id, { status: "done", doneAt: now });
          if (!input.helper) await ctx.db.requests.update(r.id, { status: "done" });
          return {
            toast: input.helper
              ? "Dziękujemy! Pomocnik otrzymał punkty."
              : "Zadanie zakończone. Pomocnicy otrzymali punkty.",
            refresh: true,
            data: { marked: targets.length },
          };
        },
      },

      sendMessage: {
        description: "Wyślij wiadomość w prywatnej rozmowie autora prośby z pomocnikiem.",
        input: z.object({ helper: id, text }),
        handler: async (ctx, input) => {
          const found = await loadHelper(ctx, input.helper);
          if (!found || !inThread(ctx, found.helper, found.request)) return { error: NO_THREAD_ACCESS };
          const m = await ctx.db.threadMessages.insert({ helper: input.helper, author: ctx.user.id, text: input.text });
          return { refresh: true, data: { id: m.id } };
        },
      },

      sendGroupMessage: {
        description: "Wyślij wiadomość na czacie grupowym autora i przyjętych pomocników.",
        input: z.object({ request: id, text }),
        handler: async (ctx, input) => {
          const r = await ctx.db.requests.get(input.request);
          if (!r || !(await inGroup(ctx, r))) return { error: NO_GROUP_ACCESS };
          const m = await ctx.db.groupMessages.insert({ request: r.id, author: ctx.user.id, text: input.text });
          return { refresh: true, data: { id: m.id } };
        },
      },

      listRequests: {
        description: "Otwarte prośby o pomoc, najnowsze najpierw, bez danych kontaktowych (dla asystentów AI).",
        input: z.object({}),
        readOnly: true,
        handler: async (ctx) => {
          const items = await ctx.db.requests.findMany({ where: { status: "open" }, orderBy: { createdAt: "desc" } });
          return {
            data: items.map((r) => ({
              id: r.id,
              title: r.title,
              category: r.category,
              when: r.when,
              details: r.details,
              createdAt: r.createdAt,
            })),
          };
        },
      },

      ranking: {
        description: "Ranking pomocnych sąsiadów: punkty i liczba wykonanych pomocy (dla asystentów AI).",
        input: z.object({}),
        readOnly: true,
        handler: async (ctx) => ({ data: await ranking(ctx) }),
      },
    },

    streams: {
      thread: {
        description: "Prywatna rozmowa na żywo: najpierw aktualne wiadomości, potem każda zmiana.",
        input: z.object({ helper: id }),
        handler: async function* (ctx, input) {
          const found = await loadHelper(ctx, input.helper);
          if (!found || !inThread(ctx, found.helper, found.request)) return;
          yield* ctx.db.threadMessages.watch({
            where: { helper: input.helper },
            orderBy: { createdAt: "asc" },
            with: { author: true },
          });
        },
      },
      group: {
        description: "Czat grupowy na żywo: najpierw aktualne wiadomości, potem każda zmiana.",
        input: z.object({ request: id }),
        handler: async function* (ctx, input) {
          const r = await ctx.db.requests.get(input.request);
          if (!r || !(await inGroup(ctx, r))) return;
          yield* ctx.db.groupMessages.watch({
            where: { request: r.id },
            orderBy: { createdAt: "asc" },
            with: { author: true },
          });
        },
      },
    },
  });
};

export default help;
