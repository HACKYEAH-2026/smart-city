import type { Context, PluginModule } from "@app/plugin-sdk";

/**
 * Event calendar of the community.
 * - Admins add, edit and remove events (title, date and time, optional end, place, description, photo).
 * - Everyone browses upcoming events grouped by month, past events and event details.
 * - Contacting the admin: a resident opens a chat about a specific event ("Zapytaj organizatora")
 *   or a general one ("Napisz do administratora"). All admins share one inbox and see unread markers,
 *   and the resident sees replies in "Moje wiadomości".
 * Dates are typed as "RRRR-MM-DD GG:MM" in the community's time zone (TIME_ZONE); full ISO with an offset also works (AI tools).
 * The module imports nothing at runtime (only `import type`); the host provides the SDK.
 */
const TIME_ZONE = "Europe/Warsaw";
/** How long an event without an end time stays on the "upcoming" list after it starts. */
const DEFAULT_DURATION_MS = 3 * 60 * 60 * 1000;
const GENERAL = "general";

const MONTHS_GENITIVE = ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"];
const MONTHS = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"];
const WEEKDAYS = ["niedziela", "poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota"];

// ---- Dates in the community time zone (no runtime imports, so plain Intl) ----
const zoneFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
});
const partsIn = (date: Date) => {
  const parts = zoneFormat.formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour") % 24, mi: get("minute") };
};
const offsetAt = (ms: number) => {
  const p = partsIn(new Date(ms));
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi) - Math.floor(ms / 60000) * 60000;
};
/** Wall-clock time in TIME_ZONE → Date; null for impossible dates (e.g. 30 February, DST gap). */
const fromLocal = (y: number, m: number, d: number, h: number, mi: number) => {
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const date = new Date(guess - offsetAt(guess - offsetAt(guess)));
  const p = partsIn(date);
  return p.y === y && p.m === m && p.d === d && p.h === h && p.mi === mi ? date : null;
};
const parseWhen = (s: string): Date | null => {
  const local = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})$/.exec(s);
  if (local) {
    const [y, m, d, h, mi] = local.slice(1).map(Number) as [number, number, number, number, number];
    return fromLocal(y, m, d, h, mi);
  }
  if (/^\d{4}-\d{2}-\d{2}T.+(Z|[+-]\d{2}:\d{2})$/.test(s)) {
    const date = new Date(s);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
};
const pad = (n: number) => String(n).padStart(2, "0");
const fmtDay = (date: Date) => {
  const p = partsIn(date);
  return `${WEEKDAYS[new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay()]}, ${p.d} ${MONTHS_GENITIVE[p.m - 1]} ${p.y}`;
};
const fmtTime = (date: Date) => {
  const p = partsIn(date);
  return `${p.h}:${pad(p.mi)}`;
};
/** "poniedziałek, 12 października 2026, 18:00–20:00" */
const fmtWhen = (start: Date, end?: Date | null) => {
  const s = `${fmtDay(start)}, ${fmtTime(start)}`;
  if (!end) return s;
  return fmtDay(start) === fmtDay(end) ? `${s}–${fmtTime(end)}` : `${s} – ${fmtDay(end)}, ${fmtTime(end)}`;
};
const fmtInput = (date: Date) => {
  const p = partsIn(date);
  return `${p.y}-${pad(p.m)}-${pad(p.d)} ${pad(p.h)}:${pad(p.mi)}`;
};
const monthOf = (date: Date) => {
  const p = partsIn(date);
  return `${MONTHS[p.m - 1]} ${p.y}`;
};

const NOT_FOUND = "To wydarzenie nie istnieje.";
const NO_ACCESS = "Nie masz dostępu do tej rozmowy.";

const events: PluginModule = ({ definePlugin, ui, z, fileRef, t }) => {
  const tables = {
    events: t.table(
      {
        title: t.text(),
        description: t.text().default(""),
        location: t.text().default(""),
        startsAt: t.timestamp(),
        endsAt: t.timestamp().optional(),
        /** endsAt, or startsAt + DEFAULT_DURATION_MS: until then the event counts as upcoming. */
        visibleUntil: t.timestamp(),
        photo: t.ref("file").optional(),
      },
      { indexes: [["visibleUntil"], ["startsAt"]] },
    ),
    /** A resident's chat with the admins: about one event (topic = event id) or general (topic = "general"). */
    conversations: t.table(
      {
        resident: t.ref("user"),
        topic: t.text(),
        event: t.ref("events").optional(),
        lastMessageAt: t.timestamp(),
        unreadByAdmin: t.boolean().default(false),
        unreadByResident: t.boolean().default(false),
      },
      { unique: [["resident", "topic"]], indexes: [["lastMessageAt"], ["event"]] },
    ),
    messages: t.table(
      { conversation: t.ref("conversations"), author: t.ref("user"), text: t.text() },
      { indexes: [["conversation", "createdAt"]] },
    ),
  };
  type Ctx = Context<typeof tables>;

  const id = z.string().min(1);
  const when = (message: string) =>
    z.string().trim().transform((s, c) => {
      const date = parseWhen(s);
      if (!date) {
        c.addIssue({ code: "custom", message });
        return z.NEVER;
      }
      return date;
    });
  const eventInput = {
    title: z.string().trim().min(3, "Tytuł jest za krótki").max(120, "Tytuł jest za długi"),
    startsAt: when("Podaj datę i godzinę w formacie RRRR-MM-DD GG:MM"),
    endsAt: z
      .string()
      .trim()
      .optional()
      .transform((s, c) => {
        if (!s) return null;
        const date = parseWhen(s);
        if (!date) {
          c.addIssue({ code: "custom", message: "Podaj koniec w formacie RRRR-MM-DD GG:MM" });
          return z.NEVER;
        }
        return date;
      }),
    location: z.string().trim().max(200, "Miejsce jest za długie").default(""),
    description: z.string().trim().max(5000, "Opis jest za długi").default(""),
    photo: fileRef().optional(),
  };
  const text = z.string().trim().min(1, "Wiadomość nie może być pusta").max(2000, "Wiadomość jest za długa");
  const isAdmin = (ctx: Ctx) => ctx.user.role === "admin";

  const toRow = (input: { startsAt: Date; endsAt: Date | null; photo?: string | null }) => ({
    endsAt: input.endsAt,
    visibleUntil: input.endsAt ?? new Date(input.startsAt.getTime() + DEFAULT_DURATION_MS),
    photo: input.photo ?? null,
  });
  const loadConversation = async (ctx: Ctx, conversationId: string) => {
    const c = await ctx.db.conversations.get(conversationId);
    return c && (c.resident === ctx.user.id || isAdmin(ctx)) ? c : null;
  };
  const unreadCount = (ctx: Ctx) =>
    isAdmin(ctx)
      ? ctx.db.conversations.count({ where: { unreadByAdmin: true } })
      : ctx.db.conversations.count({ where: { resident: ctx.user.id, unreadByResident: true } });
  const topicTitle = (c: { topic: string; event: { title: string } | null }) =>
    c.event?.title ?? (c.topic === GENERAL ? "Wiadomość do administratora" : "Wydarzenie usunięte");

  const eventCard = (e: { id: string; title: string; startsAt: Date; endsAt: Date | null; location: string }) =>
    ui.card({
      title: e.title,
      subtitle: [fmtWhen(e.startsAt, e.endsAt), e.location].filter(Boolean).join(" · "),
      onPress: ui.navigate("event", { id: e.id }),
    });
  const eventForm = (submit: ReturnType<typeof ui.tool>, label: string, e?: { title: string; startsAt: Date; endsAt: Date | null; location: string; description: string }) =>
    ui.form({
      submitLabel: label,
      submit,
      children: [
        ui.textInput({ name: "title", label: "Nazwa wydarzenia", value: e?.title }),
        ui.textInput({ name: "startsAt", label: "Początek (RRRR-MM-DD GG:MM)", value: e ? fmtInput(e.startsAt) : undefined }),
        ui.textInput({ name: "endsAt", label: "Koniec (opcjonalnie)", value: e?.endsAt ? fmtInput(e.endsAt) : undefined }),
        ui.textInput({ name: "location", label: "Miejsce", value: e?.location }),
        ui.textInput({ name: "description", label: "Opis", multiline: true, value: e?.description }),
        ui.imagePicker({ name: "photo", label: "Zdjęcie (opcjonalnie)" }),
      ],
    });

  return definePlugin({
    id: "events",
    name: "Wydarzenia",
    version: "1.0.0",
    icon: "📅",
    description: "Kalendarz wydarzeń społeczności z możliwością zapytania organizatora na czacie.",
    permissions: ["db", "files"],
    nav: [
      { view: "list", label: "Wydarzenia" },
      { view: "inbox", label: "Wiadomości" },
    ],
    tables,

    views: {
      list: async (ctx, params) => {
        const past = params.past === "1";
        const now = ctx.now();
        const items = past
          ? await ctx.db.events.findMany({ where: { visibleUntil: { lte: now } }, orderBy: { startsAt: "desc" }, limit: 50 })
          : await ctx.db.events.findMany({ where: { visibleUntil: { gt: now } }, orderBy: { startsAt: "asc" }, limit: 100 });
        const months = new Map<string, typeof items>();
        for (const e of items) months.set(monthOf(e.startsAt), [...(months.get(monthOf(e.startsAt)) ?? []), e]);
        const unread = await unreadCount(ctx);
        const inbox = isAdmin(ctx) ? "Wiadomości od mieszkańców" : "Moje wiadomości";
        return ui.screen(past ? "Minione wydarzenia" : "Wydarzenia", [
          ui.row([
            ...(isAdmin(ctx)
              ? [ui.button("Dodaj wydarzenie", ui.navigate("new"))]
              : [ui.button("Napisz do administratora", ui.tool("startChat", {}), "quiet")]),
            ui.button(unread ? `${inbox} (nowe: ${unread})` : inbox, ui.navigate("inbox"), "quiet"),
          ]),
          ...(items.length
            ? [...months].flatMap(([month, list]) => [ui.heading(month, 3), ui.list(month, list.map(eventCard))])
            : [ui.empty(past ? "Nie ma minionych wydarzeń." : "Nie ma zaplanowanych wydarzeń.")]),
          past
            ? ui.button("Nadchodzące wydarzenia", ui.navigate("list"), "quiet")
            : ui.button("Minione wydarzenia", ui.navigate("list", { past: "1" }), "quiet"),
        ]);
      },

      event: async (ctx, params) => {
        const e = params.id ? await ctx.db.events.get(params.id) : null;
        if (!e) return ui.screen("Nie znaleziono", [ui.empty(NOT_FOUND), ui.button("Wszystkie wydarzenia", ui.navigate("list"), "quiet")]);
        const admin = isAdmin(ctx);
        const questions = admin
          ? await ctx.db.conversations.findMany({
              where: { event: e.id },
              orderBy: { lastMessageAt: "desc" },
              with: { resident: true },
            })
          : [];
        return ui.screen(e.title, [
          ...(e.visibleUntil.getTime() <= ctx.now().getTime() ? [ui.badge("Wydarzenie minęło", "neutral")] : []),
          ui.stat("Kiedy", fmtWhen(e.startsAt, e.endsAt)),
          ...(e.location ? [ui.stat("Gdzie", e.location)] : []),
          ...(e.photo ? [ui.image(e.photo, `Zdjęcie: ${e.title}`)] : []),
          ui.text(e.description || "Brak opisu."),
          ...(admin
            ? [
                ui.row([
                  ui.button("Edytuj", ui.navigate("edit", { id: e.id }), "quiet"),
                  ui.button("Usuń wydarzenie", ui.tool("deleteEvent", { id: e.id }), "danger"),
                ]),
                ui.heading(`Pytania mieszkańców (${questions.length})`, 3),
                ui.list(
                  "Pytania mieszkańców",
                  questions.length
                    ? questions.map((c) =>
                        ui.card({
                          title: c.resident.name,
                          ...(c.unreadByAdmin ? { badge: { text: "Nowa wiadomość", tone: "info" as const } } : {}),
                          onPress: ui.navigate("conversation", { id: c.id }),
                        }),
                      )
                    : [ui.empty("Nikt jeszcze nie pytał o to wydarzenie.")],
                ),
              ]
            : [ui.button("Zapytaj organizatora", ui.tool("startChat", { event: e.id }))]),
          ui.button("Wszystkie wydarzenia", ui.navigate("list"), "quiet"),
        ]);
      },

      new: (ctx) =>
        isAdmin(ctx)
          ? ui.screen("Nowe wydarzenie", [
              eventForm(ui.tool("createEvent"), "Dodaj wydarzenie"),
              ui.button("Anuluj", ui.navigate("list"), "quiet"),
            ])
          : ui.screen("Brak dostępu", [ui.empty("Wydarzenia dodają administratorzy.")]),

      edit: async (ctx, params) => {
        if (!isAdmin(ctx)) return ui.screen("Brak dostępu", [ui.empty("Wydarzenia edytują administratorzy.")]);
        const e = params.id ? await ctx.db.events.get(params.id) : null;
        if (!e) return ui.screen("Nie znaleziono", [ui.empty(NOT_FOUND)]);
        return ui.screen("Edycja wydarzenia", [
          eventForm(ui.tool("updateEvent", { id: e.id }), "Zapisz zmiany", e),
          ui.button("Anuluj", ui.navigate("event", { id: e.id }), "quiet"),
        ]);
      },

      inbox: async (ctx) => {
        const admin = isAdmin(ctx);
        const items = await ctx.db.conversations.findMany({
          ...(admin ? {} : { where: { resident: ctx.user.id } }),
          orderBy: { lastMessageAt: "desc" },
          with: { resident: true, event: true },
          limit: 200,
        });
        return ui.screen(admin ? "Wiadomości od mieszkańców" : "Moje wiadomości", [
          ...(admin ? [] : [ui.button("Napisz do administratora", ui.tool("startChat", {}), "quiet")]),
          ui.list(
            "Rozmowy",
            items.length
              ? items.map((c) =>
                  ui.card({
                    title: topicTitle(c),
                    subtitle: admin ? c.resident.name : "Rozmowa z administratorem",
                    ...((admin ? c.unreadByAdmin : c.unreadByResident)
                      ? { badge: { text: "Nowa wiadomość", tone: "info" as const } }
                      : {}),
                    onPress: ui.navigate("conversation", { id: c.id }),
                  }),
                )
              : [ui.empty("Nie ma jeszcze wiadomości.")],
          ),
          ui.button("Wszystkie wydarzenia", ui.navigate("list"), "quiet"),
        ]);
      },

      conversation: async (ctx, params) => {
        const found = params.id ? await loadConversation(ctx, params.id) : null;
        if (!found) return ui.screen("Brak dostępu", [ui.empty(NO_ACCESS), ui.button("Wszystkie wydarzenia", ui.navigate("list"), "quiet")]);
        const c = (await ctx.db.conversations.get(found.id, { with: { resident: true, event: true } }))!;
        const admin = isAdmin(ctx);
        // Opening the conversation marks it as read for this side.
        if (admin && c.unreadByAdmin) await ctx.db.conversations.update(c.id, { unreadByAdmin: false });
        if (!admin && c.unreadByResident) await ctx.db.conversations.update(c.id, { unreadByResident: false });
        const messages = await ctx.db.messages.findMany({
          where: { conversation: c.id },
          orderBy: { createdAt: "asc" },
          with: { author: true },
        });
        return ui.screen(topicTitle(c), [
          ui.text(admin ? `Mieszkaniec: ${c.resident.name}` : "Rozmowa z administratorem", "soft"),
          ...(c.event ? [ui.text(fmtWhen(c.event.startsAt, c.event.endsAt), "soft")] : []),
          ui.list(
            "Wiadomości",
            messages.length
              ? messages.map((m) => ui.card({ title: m.author.name, subtitle: m.text }))
              : [ui.empty(admin ? "Nie ma jeszcze wiadomości." : "Napisz, o co chcesz zapytać.")],
          ),
          ui.form({
            submitLabel: "Wyślij",
            submit: ui.tool("sendMessage", { conversation: c.id }),
            children: [ui.textInput({ name: "text", label: "Wiadomość", multiline: true })],
          }),
          ...(c.event ? [ui.button("Zobacz wydarzenie", ui.navigate("event", { id: c.event.id }), "quiet")] : []),
          ui.button(admin ? "Wszystkie wiadomości" : "Moje wiadomości", ui.navigate("inbox"), "quiet"),
        ]);
      },
    },

    dashboardWidgets: {
      upcoming: {
        size: { w: 2, h: 3 },
        render: async (ctx) => {
          const next = await ctx.db.events.findMany({
            where: { visibleUntil: { gt: ctx.now() } },
            orderBy: { startsAt: "asc" },
            limit: 3,
          });
          const unread = await unreadCount(ctx);
          if (!next.length && !unread) return null;
          return ui.widget("Wydarzenia", [
            ...(unread ? [ui.text(`Nowe wiadomości: ${unread}`, "soft")] : []),
            ...(next.length ? next.map(eventCard) : [ui.text("Nie ma zaplanowanych wydarzeń.", "soft")]),
            ui.button("Kalendarz wydarzeń", ui.navigate("list"), "quiet"),
          ]);
        },
      },
    },

    tools: {
      createEvent: {
        description: "Dodaj wydarzenie do kalendarza (tylko administrator). Daty: RRRR-MM-DD GG:MM lub ISO z przesunięciem.",
        input: z.object(eventInput),
        requires: "admin",
        handler: async (ctx, input) => {
          if (input.endsAt && input.endsAt <= input.startsAt) return { error: "Koniec musi być po rozpoczęciu." };
          const e = await ctx.db.events.insert({ ...input, ...toRow(input) });
          return { toast: "Wydarzenie dodane.", navigate: ui.navigate("event", { id: e.id }), data: { id: e.id } };
        },
      },

      updateEvent: {
        description: "Zmień wydarzenie (tylko administrator).",
        input: z.object({ id, ...eventInput }),
        requires: "admin",
        handler: async (ctx, { id: eventId, ...input }) => {
          if (input.endsAt && input.endsAt <= input.startsAt) return { error: "Koniec musi być po rozpoczęciu." };
          const existing = await ctx.db.events.get(eventId);
          if (!existing) return { error: NOT_FOUND };
          await ctx.db.events.update(eventId, {
            ...input,
            ...toRow({ ...input, photo: input.photo ?? existing.photo }),
          });
          return { toast: "Zmiany zapisane.", navigate: ui.navigate("event", { id: eventId }), data: { id: eventId } };
        },
      },

      deleteEvent: {
        description: "Usuń wydarzenie z kalendarza (tylko administrator).",
        input: z.object({ id }),
        requires: "admin",
        handler: async (ctx, input) => {
          if (!(await ctx.db.events.delete(input.id))) return { error: NOT_FOUND };
          return { toast: "Wydarzenie usunięte.", navigate: ui.navigate("list") };
        },
      },

      startChat: {
        description: "Napisz do administratora: o konkretnym wydarzeniu (event) albo ogólnie.",
        input: z.object({ event: id.optional() }),
        handler: async (ctx, input) => {
          if (isAdmin(ctx)) return { error: "Administratorzy odpowiadają w skrzynce wiadomości." };
          if (input.event && !(await ctx.db.events.get(input.event))) return { error: NOT_FOUND };
          const topic = input.event ?? GENERAL;
          const [existing] = await ctx.db.conversations.findMany({ where: { resident: ctx.user.id, topic }, limit: 1 });
          const c =
            existing ??
            (await ctx.db.conversations.insert({
              resident: ctx.user.id,
              topic,
              event: input.event ?? null,
              lastMessageAt: ctx.now(),
            }));
          return { navigate: ui.navigate("conversation", { id: c.id }), data: { id: c.id } };
        },
      },

      sendMessage: {
        description: "Wyślij wiadomość w rozmowie mieszkańca z administratorem.",
        input: z.object({ conversation: id, text }),
        handler: async (ctx, input) => {
          const c = await loadConversation(ctx, input.conversation);
          if (!c) return { error: NO_ACCESS };
          const m = await ctx.db.messages.insert({ conversation: c.id, author: ctx.user.id, text: input.text });
          const fromAdmin = isAdmin(ctx);
          await ctx.db.conversations.update(c.id, {
            lastMessageAt: ctx.now(),
            unreadByAdmin: !fromAdmin,
            unreadByResident: fromAdmin,
          });
          return { refresh: true, data: { id: m.id } };
        },
      },

      listEvents: {
        description: "Nadchodzące wydarzenia (albo minione: past=true) z datą i miejscem (dla asystentów AI).",
        input: z.object({ past: z.boolean().default(false) }),
        readOnly: true,
        handler: async (ctx, input) => {
          const now = ctx.now();
          const items = input.past
            ? await ctx.db.events.findMany({ where: { visibleUntil: { lte: now } }, orderBy: { startsAt: "desc" }, limit: 50 })
            : await ctx.db.events.findMany({ where: { visibleUntil: { gt: now } }, orderBy: { startsAt: "asc" }, limit: 100 });
          return {
            data: items.map((e) => ({
              id: e.id,
              title: e.title,
              startsAt: e.startsAt,
              endsAt: e.endsAt,
              when: fmtWhen(e.startsAt, e.endsAt),
              location: e.location,
              description: e.description,
            })),
          };
        },
      },
    },

    streams: {
      conversation: {
        description: "Rozmowa z administratorem na żywo: najpierw aktualne wiadomości, potem każda zmiana.",
        input: z.object({ conversation: id }),
        handler: async function* (ctx, input) {
          if (!(await loadConversation(ctx, input.conversation))) return;
          yield* ctx.db.messages.watch({
            where: { conversation: input.conversation },
            orderBy: { createdAt: "asc" },
            with: { author: true },
          });
        },
      },
    },
  });
};

export default events;
