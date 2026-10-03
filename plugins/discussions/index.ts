import type { Context, PluginModule } from "@app/plugin-sdk";

/**
 * Discussion boards (a simple forum) for a community.
 * - Anyone can start a discussion and post messages; messages can reply to another message.
 * - Authors edit their own messages; authors or moderators (community admins) delete discussions and messages.
 * - Moderators can lock a discussion (no new messages from regular users).
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
      },
      { indexes: [["discussion", "createdAt"]] },
    ),
  };
  type Ctx = Context<typeof tables>;

  const id = z.string().min(1);
  const text = z.string().trim().min(1, "Wiadomość nie może być pusta").max(2000, "Wiadomość jest za długa");

  const isModerator = (ctx: Ctx) => ctx.user.role === "admin";
  const canRemove = (ctx: Ctx, authorId: string) => authorId === ctx.user.id || isModerator(ctx);
  const touch = (ctx: Ctx, discussion: string) => ctx.db.discussions.update(discussion, { lastActivityAt: ctx.now() });

  return definePlugin({
    id: "discussions",
    name: "Dyskusje",
    version: "1.0.0",
    icon: "💬",
    description: "Forum społeczności: dyskusje, odpowiedzi i moderacja.",
    permissions: ["db"],
    nav: [{ view: "list", label: "Dyskusje" }],
    tables,

    views: {
      list: async (ctx) => {
        const items = await ctx.db.discussions.findMany({
          orderBy: { lastActivityAt: "desc" },
          with: { author: true },
        });
        return ui.screen("Dyskusje", [
          ui.list(
            "Lista dyskusji",
            items.length
              ? items.map((d) =>
                  ui.card({
                    title: d.title,
                    subtitle: d.author.name,
                    ...(d.locked ? { badge: { text: "Zamknięta", tone: "neutral" as const } } : {}),
                    onPress: ui.navigate("thread", { id: d.id }),
                  }),
                )
              : [ui.empty("Nie ma jeszcze dyskusji.")],
          ),
        ]);
      },
      thread: async (ctx, params) => {
        const discussion = params.id ? await ctx.db.discussions.get(params.id, { with: { author: true } }) : null;
        if (!discussion) return ui.screen("Nie znaleziono", [ui.empty("Ta dyskusja nie istnieje.")]);
        const messages = await ctx.db.messages.findMany({
          where: { discussion: discussion.id },
          orderBy: { createdAt: "asc" },
          with: { author: true },
        });
        return ui.screen(discussion.title, [
          ui.text(discussion.body || "Brak opisu.", "soft"),
          ui.list(
            "Wiadomości",
            messages.map((m) =>
              ui.card({ title: m.author.name, subtitle: m.editedAt ? `${m.text} (edytowano)` : m.text }),
            ),
          ),
        ]);
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
