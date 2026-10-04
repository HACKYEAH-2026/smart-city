import type { CardTag, Context, PluginModule } from "@app/plugin-sdk";

/**
 * Discussion boards (a simple forum) for a community.
 * - Anyone can start a discussion and post messages; messages can reply to another message.
 * - Authors edit their own messages; authors or moderators (community admins) delete discussions and messages.
 * - Moderators can lock a discussion (no new messages from regular users).
 * - The list: a card per discussion (the last message, when, how many people and messages, what is new); a new
 *   discussion starts from the screen's header.
 * - Dashboard widget: the discussions with the latest activity, new ones (since `ctx.lastVisit`) marked.
 * - Streams: `messages` of one discussion and the `discussions` list — a snapshot first, then live changes.
 * The module imports nothing at runtime (only `import type`) — the host provides the SDK.
 */
const discussions: PluginModule = ({ definePlugin, ui, z, t }) => {
  const tables = {
    discussions: t.table(
      {
        title: t.text(),
        body: t.text().default(""),
        author: t.ref("user"),
        locked: t.boolean().default(false),
        lastActivityAt: t.timestamp(),
      },
      { indexes: [["lastActivityAt"]] },
    ),
    messages: t.table(
      {
        discussion: t.ref("discussions"),
        author: t.ref("user"),
        text: t.text(),
        replyTo: t.ref("messages").optional(),
        editedAt: t.timestamp().optional(),
        // Written by a place's administrator: the chat shows it in the accent colour.
        byAdmin: t.boolean().default(false),
      },
      { indexes: [["discussion", "createdAt"]] },
    ),
  };
  type Ctx = Context<typeof tables>;
  type Person = { id: string; name: string };
  type Discussion = { id: string; title: string; body: string; locked: boolean; lastActivityAt: Date; author: Person };

  const id = z.string().min(1);
  const text = z.string().trim().min(1, "Wiadomość nie może być pusta").max(2000, "Wiadomość jest za długa");

  const isModerator = (ctx: Ctx) => ctx.user.role === "admin";
  const canRemove = (ctx: Ctx, authorId: string) => authorId === ctx.user.id || isModerator(ctx);
  const touch = (ctx: Ctx, discussion: string) => ctx.db.discussions.update(discussion, { lastActivityAt: ctx.now() });

  /** A count with its Polish noun: 1 → `one`; 2–4 (but not 12–14) → `few`; the rest → `many` ("5 dyskusji"). */
  const plural = (n: number, one: string, few: string, many: string) => {
    const isFew = [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100);
    return `${n} ${n === 1 ? one : isFew ? few : many}`;
  };
  const discussionCount = (n: number) => plural(n, "dyskusja", "dyskusje", "dyskusji");
  /** The user's own posts read "Ty". */
  const nameOf = (ctx: Ctx, person: Person) => (person.id === ctx.user.id ? "Ty" : person.name);
  const preview = (s: string, max = 140) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);
  /** Activity after the user last opened discussions; everything is new to someone who never did. */
  const isNew = (ctx: Ctx, at: Date) => !ctx.lastVisit || at > ctx.lastVisit;

  /** A discussion as its latest activity: who wrote last, what and when (the widget). */
  const activityOf = async (ctx: Ctx, d: Discussion) => {
    const last = await ctx.db.messages.findFirst({
      where: { discussion: d.id },
      orderBy: { createdAt: "desc" },
      with: { author: true },
    });
    const line = last ? `${nameOf(ctx, last.author)}: ${preview(last.text)}` : preview(d.body) || "Nowa dyskusja";
    return ui.activity({
      title: d.title,
      text: d.locked ? `Zamknięta · ${line}` : line,
      person: (last?.author ?? d.author).name,
      at: d.lastActivityAt.toISOString(),
      ...(isNew(ctx, d.lastActivityAt) ? { unread: true } : {}),
      onPress: ui.navigate("thread", { id: d.id }),
    });
  };

  const LOCKED: CardTag = { text: "Zamknięta", icon: "lock", tone: "neutral" };

  /**
   * A discussion on the list: the last message (else the opening post), when, how many people took part (its author
   * included) and how many messages. Activity since the user's last visit gets a dot, others' new messages a count.
   */
  const cardOf = async (ctx: Ctx, d: Discussion) => {
    const where = { discussion: d.id };
    const [messages, total] = await Promise.all([
      ctx.db.messages.findMany({ where, orderBy: { createdAt: "desc" }, limit: 1000, with: { author: true } }),
      ctx.db.messages.count({ where }),
    ]);
    const [last] = messages;
    const line = last ? `${nameOf(ctx, last.author)}: ${last.text}` : d.body;
    const people = new Set([d.author.id, ...messages.map((m) => m.author.id)]).size;
    const fresh = ctx.lastVisit
      ? messages.filter((m) => m.author.id !== ctx.user.id && isNew(ctx, m.createdAt)).length
      : 0;
    return ui.card({
      title: d.title,
      ...(line ? { subtitle: preview(line, 100) } : {}),
      ...(d.locked ? { tags: [LOCKED] } : {}),
      meta: [
        { at: d.lastActivityAt.toISOString() },
        { text: plural(people, "osoba", "osoby", "osób"), icon: "people" },
        { text: plural(total, "wiadomość", "wiadomości", "wiadomości"), icon: "chat" },
      ],
      ...(isNew(ctx, d.lastActivityAt) ? { unread: true } : {}),
      ...(fresh ? { count: Math.min(fresh, 999) } : {}),
      onPress: ui.navigate("thread", { id: d.id }),
    });
  };

  const composer = (discussion: string) =>
    ui.composer({
      name: "text",
      label: "Twoja wiadomość",
      placeholder: "Napisz wiadomość…",
      sendLabel: "Wyślij",
      submit: ui.tool("sendMessage", { discussion }),
    });

  /** Moderators close a discussion from the header (an icon, after confirming) and open it again. */
  const lockAction = (discussion: { id: string; locked: boolean }) =>
    discussion.locked
      ? {
          icon: "unlock" as const,
          variant: "icon" as const,
          label: "Otwórz dyskusję",
          action: ui.tool("lockDiscussion", { id: discussion.id, locked: false }),
        }
      : {
          icon: "lock" as const,
          variant: "icon" as const,
          label: "Zamknij dyskusję",
          action: ui.tool("lockDiscussion", { id: discussion.id, locked: true }),
          confirm: {
            title: "Zamknąć dyskusję?",
            message: "Mieszkańcy nie będą mogli pisać nowych wiadomości. Możesz ją później otworzyć.",
            confirmLabel: "Zamknij",
          },
        };

  return definePlugin({
    id: "discussions",
    name: "Dyskusje",
    version: "1.2.0",
    icon: "💬",
    description: "Forum społeczności: dyskusje, odpowiedzi i moderacja, z ostatnią aktywnością na pulpicie.",
    permissions: ["db"],
    nav: [{ view: "list", label: "Dyskusje" }],
    tables,

    views: {
      list: async (ctx) => {
        const items = await ctx.db.discussions.findMany({
          orderBy: { lastActivityAt: "desc" },
          with: { author: true },
        });
        return ui.screen(
          "Dyskusje",
          [
            items.length
              ? ui.list("Lista dyskusji", await Promise.all(items.map((d) => cardOf(ctx, d))))
              : ui.empty("Nie ma jeszcze dyskusji. Zapytaj o coś sąsiadów albo zaproponuj zmianę."),
          ],
          {
            eyebrow: ctx.community.name,
            actions: [{ label: "Nowa dyskusja", icon: "plus", action: ui.navigate("new") }],
          },
        );
      },
      new: async () =>
        ui.screen("Nowa dyskusja", [
          ui.text("Zapytaj sąsiadów, zaproponuj zmianę albo zbierz opinie przed zebraniem.", "soft"),
          ui.form({
            submitLabel: "Załóż dyskusję",
            submit: ui.tool("createDiscussion"),
            children: [
              ui.textInput({ name: "title", label: "Temat" }),
              ui.textInput({ name: "body", label: "Opis (opcjonalnie)", multiline: true }),
            ],
          }),
        ]),
      /** A messenger-like chat: the opening post, the messages as bubbles, the message field pinned at the bottom. */
      thread: async (ctx, params) => {
        const discussion = params.id ? await ctx.db.discussions.get(params.id, { with: { author: true } }) : null;
        if (!discussion) return ui.screen("Nie znaleziono", [ui.empty("Ta dyskusja nie istnieje.")]);
        const messages = await ctx.db.messages.findMany({
          where: { discussion: discussion.id },
          orderBy: { createdAt: "asc" },
          with: { author: true },
        });
        return ui.screen(
          discussion.title,
          [
            ...(discussion.body
              ? [
                  ui.activity({
                    title: nameOf(ctx, discussion.author),
                    text: discussion.body,
                    person: discussion.author.name,
                    at: discussion.createdAt.toISOString(),
                  }),
                ]
              : []),
            ...(discussion.locked
              ? [ui.text("Dyskusja jest zamknięta. Nowe wiadomości piszą tylko moderatorzy.", "soft")]
              : []),
            messages.length
              ? ui.chat({
                  label: "Wiadomości",
                  messages: messages.map((m) => ({
                    id: m.id,
                    person: m.author.name,
                    text: m.text,
                    at: m.createdAt.toISOString(),
                    ...(m.author.id === ctx.user.id ? { mine: true } : {}),
                    ...(m.byAdmin ? { admin: true } : {}),
                    ...(m.editedAt ? { note: "edytowano" } : {}),
                  })),
                })
              : ui.empty("Nie ma jeszcze wiadomości. Napisz pierwszą."),
            ...(!discussion.locked || isModerator(ctx) ? [composer(discussion.id)] : []),
          ],
          isModerator(ctx) ? { actions: [lockAction(discussion)] } : {},
        );
      },
    },

    dashboardWidgets: {
      /** The 3 discussions with the latest activity; tapping one opens it, the header and the tile open them all. */
      recent: {
        title: "Dyskusje",
        size: { w: 3, h: 3 },
        sizes: [{ w: 3, h: 2 }],
        render: async (ctx) => {
          const latest = await ctx.db.discussions.findMany({
            orderBy: { lastActivityAt: "desc" },
            limit: 3,
            with: { author: true },
          });
          const total = latest.length ? await ctx.db.discussions.count() : 0;
          const fresh = ctx.lastVisit
            ? await ctx.db.discussions.count({ where: { lastActivityAt: { gt: ctx.lastVisit } } })
            : total;
          return ui.widget(
            "Dyskusje",
            [
              latest.length
                ? ui.list("Ostatnia aktywność", await Promise.all(latest.map((d) => activityOf(ctx, d))))
                : ui.empty("Nikt jeszcze nie zaczął rozmowy."),
              ui.button("Nowa dyskusja", ui.navigate("new"), "quiet", "plus"),
            ],
            {
              icon: "chat",
              ...(total ? { subtitle: fresh ? `${fresh} z nowymi wpisami` : discussionCount(total) } : {}),
              link: { label: "Wszystkie", action: ui.navigate("list") },
              onPress: ui.navigate("list"),
            },
          );
        },
      },
    },

    tools: {
      createDiscussion: {
        description: "Załóż nową dyskusję w społeczności.",
        input: z.object({
          title: z.string().trim().min(3, "Tytuł jest za krótki").max(120),
          body: z.string().trim().max(5000).default(""),
        }),
        handler: async (ctx, input) => {
          const discussion = await ctx.db.discussions.insert({
            ...input,
            author: ctx.user.id,
            lastActivityAt: ctx.now(),
          });
          return {
            toast: "Dyskusja założona.",
            navigate: ui.navigate("thread", { id: discussion.id }),
            data: { id: discussion.id },
          };
        },
      },

      deleteDiscussion: {
        description: "Usuń dyskusję razem z wiadomościami (autor dyskusji albo moderator).",
        input: z.object({ id }),
        handler: async (ctx, input) => {
          const discussion = await ctx.db.discussions.get(input.id);
          if (!discussion) return { error: "Ta dyskusja nie istnieje." };
          if (!canRemove(ctx, discussion.author)) return { error: "Możesz usuwać tylko swoje dyskusje." };
          await ctx.db.discussions.delete(input.id);
          return { toast: "Dyskusja usunięta.", navigate: ui.navigate("list"), data: { id: input.id } };
        },
      },

      lockDiscussion: {
        description: "Zamknij albo otwórz dyskusję dla nowych wiadomości (tylko moderator).",
        input: z.object({ id, locked: z.boolean() }),
        requires: "admin",
        handler: async (ctx, input) => {
          const updated = await ctx.db.discussions.update(input.id, { locked: input.locked });
          if (!updated) return { error: "Ta dyskusja nie istnieje." };
          return { toast: input.locked ? "Dyskusja zamknięta." : "Dyskusja otwarta.", refresh: true };
        },
      },

      sendMessage: {
        description: "Wyślij wiadomość w dyskusji (opcjonalnie jako odpowiedź na inną wiadomość).",
        input: z.object({ discussion: id, text, replyTo: id.optional() }),
        handler: async (ctx, input) => {
          const discussion = await ctx.db.discussions.get(input.discussion);
          if (!discussion) return { error: "Ta dyskusja nie istnieje." };
          if (discussion.locked && !isModerator(ctx)) return { error: "Ta dyskusja jest zamknięta." };
          const parent = input.replyTo ? await ctx.db.messages.get(input.replyTo) : null;
          if (input.replyTo && parent?.discussion !== discussion.id)
            return { error: "Nie można odpowiedzieć na tę wiadomość." };
          const message = await ctx.db.messages.insert({
            discussion: discussion.id,
            author: ctx.user.id,
            text: input.text,
            replyTo: parent?.id ?? null,
            byAdmin: isModerator(ctx),
          });
          await touch(ctx, discussion.id);
          return { refresh: true, data: { id: message.id } };
        },
      },

      editMessage: {
        description: "Popraw treść swojej wiadomości.",
        input: z.object({ id, text }),
        handler: async (ctx, input) => {
          const message = await ctx.db.messages.get(input.id);
          if (!message) return { error: "Ta wiadomość nie istnieje." };
          if (message.author !== ctx.user.id) return { error: "Możesz edytować tylko swoje wiadomości." };
          await ctx.db.messages.update(input.id, { text: input.text, editedAt: ctx.now() });
          return { refresh: true, data: { id: input.id } };
        },
      },

      deleteMessage: {
        description: "Usuń wiadomość (autor albo moderator).",
        input: z.object({ id }),
        handler: async (ctx, input) => {
          const message = await ctx.db.messages.get(input.id);
          if (!message) return { error: "Ta wiadomość nie istnieje." };
          if (!canRemove(ctx, message.author)) return { error: "Możesz usuwać tylko swoje wiadomości." };
          await ctx.db.messages.delete(input.id);
          return { refresh: true, data: { id: input.id } };
        },
      },

      listDiscussions: {
        description: "Lista dyskusji w społeczności z liczbą wiadomości (dla asystentów AI).",
        input: z.object({}),
        readOnly: true,
        handler: async (ctx) => {
          const items = await ctx.db.discussions.findMany({ orderBy: { lastActivityAt: "desc" } });
          const counts = await Promise.all(items.map((d) => ctx.db.messages.count({ where: { discussion: d.id } })));
          return {
            data: items.map((d, i) => ({ id: d.id, title: d.title, locked: d.locked, messages: counts[i] })),
          };
        },
      },
    },

    streams: {
      messages: {
        description: "Wiadomości dyskusji na żywo: najpierw aktualna lista, potem każda zmiana.",
        input: z.object({ discussion: id }),
        handler: async function* (ctx, input) {
          if (!(await ctx.db.discussions.get(input.discussion))) return;
          yield* ctx.db.messages.watch({
            where: { discussion: input.discussion },
            orderBy: { createdAt: "asc" },
            with: { author: true },
          });
        },
      },
      discussions: {
        description: "Lista dyskusji na żywo (nowe, zmienione, usunięte, ostatnia aktywność).",
        input: z.object({}),
        handler: (ctx) => ctx.db.discussions.watch({ orderBy: { lastActivityAt: "desc" }, with: { author: true } }),
      },
    },
  });
};

export default discussions;
