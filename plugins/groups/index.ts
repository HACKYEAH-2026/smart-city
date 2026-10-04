import type { Context, PluginModule, UINode } from "@app/plugin-sdk";

/**
 * Community groups, similar to groups on Facebook.
 * - Any user creates a group (and becomes its owner). Groups are public or private.
 *   - Public: everyone reads; joining is instant and needed to post, comment and like.
 *   - Private: name and description are listed, but posts are visible to members only;
 *     joining sends a request that the owner or a group moderator accepts or rejects.
 * - Members write posts (optional photo), comment and like. Authors edit their own posts and delete their own posts and comments.
 * - The owner manages settings, appoints moderators and deletes the group. Moderators accept requests, pin posts,
 *   remove posts and comments, and remove or ban members (but not other moderators).
 * - App admins (role "admin") moderate everywhere: they read every group, join private groups without acceptance,
 *   and have all owner and moderator powers.
 * Ownership lives in `members` (not on the group row), so a deleted owner account does not delete the group.
 * The module imports nothing at runtime (only `import type`); the host provides the SDK.
 */
const VISIBILITY = {
  public: { text: "Publiczna", tone: "info" },
  private: { text: "Prywatna", tone: "warning" },
} as const;
const ROLE = {
  owner: { text: "Właściciel", tone: "success" },
  moderator: { text: "Moderator", tone: "info" },
  member: { text: "Członek", tone: "neutral" },
} as const;

const PRIVATE = "To jest grupa prywatna. Posty widzą tylko jej członkowie.";
const NOT_FOUND = "Ta grupa nie istnieje.";
const POST_NOT_FOUND = "Ten post nie istnieje.";
const MEMBER_NOT_FOUND = "Ten członek nie istnieje.";
const JOIN_FIRST = "Aby pisać w grupie, najpierw do niej dołącz.";
const MODERATORS_ONLY = "To mogą zrobić tylko moderatorzy grupy.";
const OWNER_ONLY = "To może zrobić tylko właściciel grupy.";
const BANNED = "Masz blokadę w tej grupie.";

const short = (s: string, n = 80) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

const groups: PluginModule = ({ definePlugin, ui, z, fileRef, t }) => {
  const tables = {
    groups: t.table(
      {
        name: t.text(),
        description: t.text().default(""),
        visibility: t.enum(["public", "private"]).default("public"),
        lastActivityAt: t.timestamp(),
      },
      { indexes: [["lastActivityAt"]] },
    ),
    /** Membership, join request (pending) or ban; one row per user per group. */
    members: t.table(
      {
        group: t.ref("groups"),
        user: t.ref("user"),
        role: t.enum(["owner", "moderator", "member"]).default("member"),
        status: t.enum(["pending", "member", "banned"]).default("member"),
      },
      {
        unique: [["group", "user"]],
        indexes: [
          ["user", "status"],
          ["group", "status"],
        ],
      },
    ),
    posts: t.table(
      {
        group: t.ref("groups"),
        author: t.ref("user"),
        text: t.text(),
        photo: t.ref("file").optional(),
        pinned: t.boolean().default(false),
        editedAt: t.timestamp().optional(),
        lastActivityAt: t.timestamp(),
      },
      { indexes: [["group", "pinned", "lastActivityAt"]] },
    ),
    comments: t.table(
      { post: t.ref("posts"), author: t.ref("user"), text: t.text() },
      { indexes: [["post", "createdAt"]] },
    ),
    likes: t.table({ post: t.ref("posts"), user: t.ref("user") }, { unique: [["post", "user"]] }),
  };
  type Ctx = Context<typeof tables>;

  const id = z.string().min(1);
  const postText = z.string().trim().min(1, "Wpis nie może być pusty").max(5000, "Wpis jest za długi");
  const commentText = z.string().trim().min(1, "Komentarz nie może być pusty").max(2000, "Komentarz jest za długi");
  const groupInput = {
    name: z.string().trim().min(3, "Nazwa grupy jest za krótka").max(80, "Nazwa grupy jest za długa"),
    description: z.string().trim().max(2000, "Opis jest za długi").default(""),
    visibility: z.enum(["public", "private"]).default("public"),
  };
  const isAdmin = (ctx: Ctx) => ctx.user.role === "admin";

  const membership = async (ctx: Ctx, group: string) =>
    (await ctx.db.members.findMany({ where: { group, user: ctx.user.id }, limit: 1 }))[0] ?? null;

  /** What the current user may do in a group. */
  const access = async (ctx: Ctx, groupId: string) => {
    const group = await ctx.db.groups.get(groupId);
    if (!group) return null;
    const me = await membership(ctx, group.id);
    const admin = isAdmin(ctx);
    const isMember = me?.status === "member";
    const role = isMember ? me.role : null;
    return {
      group,
      me,
      isMember,
      canRead: group.visibility === "public" || isMember || admin,
      canPost: isMember || admin,
      canModerate: admin || role === "owner" || role === "moderator",
      canManage: admin || role === "owner",
    };
  };
  const loadPost = async (ctx: Ctx, postId: string) => {
    const post = await ctx.db.posts.get(postId);
    const a = post ? await access(ctx, post.group) : null;
    return post && a ? { post, a } : null;
  };
  const loadMember = async (ctx: Ctx, memberId: string) => {
    const m = await ctx.db.members.get(memberId);
    const a = m ? await access(ctx, m.group) : null;
    return m && a ? { m, a } : null;
  };
  const touch = async (ctx: Ctx, group: string, post?: string) => {
    const now = ctx.now();
    await ctx.db.groups.update(group, { lastActivityAt: now });
    if (post) await ctx.db.posts.update(post, { lastActivityAt: now });
  };

  const back = (groupId: string) => ui.button("Wróć do grupy", ui.navigate("group", { id: groupId }), "quiet");
  const notFound = (message: string) =>
    ui.screen("Nie znaleziono", [ui.empty(message), ui.button("Wszystkie grupy", ui.navigate("list"), "quiet")]);
  const noAccess = (message: string, groupId?: string) =>
    ui.screen("Brak dostępu", [
      ui.empty(message),
      groupId ? back(groupId) : ui.button("Wszystkie grupy", ui.navigate("list"), "quiet"),
    ]);

  return definePlugin({
    id: "groups",
    name: "Grupy",
    version: "1.0.0",
    icon: "👥",
    description: "Grupy mieszkańców: publiczne i prywatne, posty, komentarze, polubienia i moderacja.",
    permissions: ["db", "files"],
    nav: [{ view: "list", label: "Grupy" }],
    tables,

    views: {
      list: async (ctx) => {
        const all = await ctx.db.groups.findMany({ orderBy: { lastActivityAt: "desc" }, limit: 200 });
        const mine = await ctx.db.members.findMany({ where: { user: ctx.user.id }, limit: 500 });
        const statusOf = new Map(mine.map((m) => [m.group, m]));
        const joined = all.filter((g) => statusOf.get(g.id)?.status === "member");
        const others = all.filter((g) => statusOf.get(g.id)?.status !== "member");
        return ui.screen("Grupy", [
          ui.button("Załóż grupę", ui.navigate("new")),
          ui.list(
            "Moje grupy",
            joined.length
              ? joined.map((g) =>
                  ui.card({
                    title: g.name,
                    subtitle: ROLE[statusOf.get(g.id)?.role ?? "member"].text,
                    badge: VISIBILITY[g.visibility],
                    onPress: ui.navigate("group", { id: g.id }),
                  }),
                )
              : [ui.empty("Nie należysz jeszcze do żadnej grupy.")],
          ),
          ui.list(
            "Odkryj grupy",
            others.length
              ? others.map((g) =>
                  ui.card({
                    title: g.name,
                    subtitle:
                      statusOf.get(g.id)?.status === "pending"
                        ? "Czekasz na akceptację"
                        : short(g.description || "Brak opisu."),
                    badge: VISIBILITY[g.visibility],
                    onPress: ui.navigate("group", { id: g.id }),
                  }),
                )
              : [ui.empty("Nie ma innych grup.")],
          ),
        ]);
      },

      new: () =>
        ui.screen("Nowa grupa", [
          ui.form({
            submitLabel: "Załóż grupę",
            submit: ui.tool("createGroup"),
            children: [
              ui.textInput({ name: "name", label: "Nazwa grupy" }),
              ui.textInput({ name: "description", label: "Opis", multiline: true }),
              ui.select({
                name: "visibility",
                label: "Widoczność",
                options: [
                  { value: "public", label: "Publiczna – każdy widzi posty i może dołączyć" },
                  { value: "private", label: "Prywatna – posty widzą członkowie, dołączenie wymaga akceptacji" },
                ],
                value: "public",
              }),
            ],
          }),
          ui.button("Wszystkie grupy", ui.navigate("list"), "quiet"),
        ]),

      group: async (ctx, params) => {
        const a = params.id ? await access(ctx, params.id) : null;
        if (!a) return notFound(NOT_FOUND);
        const { group, me } = a;
        const memberCount = await ctx.db.members.count({ where: { group: group.id, status: "member" } });
        const pending = a.canModerate
          ? await ctx.db.members.count({ where: { group: group.id, status: "pending" } })
          : 0;

        const membershipActions =
          me?.status === "banned"
            ? [ui.text(BANNED, "soft")]
            : me?.status === "pending"
              ? [
                  ui.text("Twoja prośba o dołączenie czeka na akceptację.", "soft"),
                  ui.button("Anuluj prośbę", ui.tool("leave", { group: group.id }), "quiet"),
                ]
              : me?.status === "member"
                ? me.role === "owner"
                  ? []
                  : [ui.button("Opuść grupę", ui.tool("leave", { group: group.id }), "quiet")]
                : [
                    ui.button(
                      group.visibility === "private" && !isAdmin(ctx) ? "Poproś o dołączenie" : "Dołącz do grupy",
                      ui.tool("join", { group: group.id }),
                    ),
                  ];

        const management = [
          ...(a.canModerate
            ? [
                ui.button(
                  pending ? `Członkowie (prośby: ${pending})` : "Członkowie",
                  ui.navigate("members", { id: group.id }),
                  "quiet",
                ),
              ]
            : []),
          ...(a.canManage ? [ui.button("Ustawienia grupy", ui.navigate("settings", { id: group.id }), "quiet")] : []),
        ];

        let content: UINode[];
        if (!a.canRead) content = [ui.empty(PRIVATE)];
        else {
          const pinned = await ctx.db.posts.findMany({
            where: { group: group.id, pinned: true },
            orderBy: { lastActivityAt: "desc" },
            with: { author: true },
          });
          const rest = await ctx.db.posts.findMany({
            where: { group: group.id, pinned: false },
            orderBy: { lastActivityAt: "desc" },
            with: { author: true },
            limit: 50,
          });
          const posts = [...pinned, ...rest];
          const stats = await Promise.all(
            posts.map(async (p) => ({
              likes: await ctx.db.likes.count({ where: { post: p.id } }),
              comments: await ctx.db.comments.count({ where: { post: p.id } }),
            })),
          );
          content = [
            ...(a.canPost
              ? [
                  ui.form({
                    submitLabel: "Opublikuj",
                    submit: ui.tool("createPost", { group: group.id }),
                    children: [
                      ui.textInput({ name: "text", label: "Napisz coś do grupy", multiline: true }),
                      ui.imagePicker({ name: "photo", label: "Zdjęcie (opcjonalnie)" }),
                    ],
                  }),
                ]
              : []),
            ui.list(
              "Posty",
              posts.length
                ? posts.map((p, i) =>
                    ui.card({
                      title: p.author.name,
                      subtitle: p.text,
                      ...(p.pinned ? { badge: { text: "Przypięty", tone: "info" as const } } : {}),
                      onPress: ui.navigate("post", { id: p.id }),
                      children: [
                        ...(p.photo ? [ui.image(p.photo, `Zdjęcie od: ${p.author.name}`)] : []),
                        ui.text(`Polubienia: ${stats[i]?.likes ?? 0} · Komentarze: ${stats[i]?.comments ?? 0}`, "soft"),
                      ],
                    }),
                  )
                : [ui.empty("Nie ma jeszcze postów.")],
            ),
          ];
        }

        return ui.screen(group.name, [
          ui.row([
            ui.badge(VISIBILITY[group.visibility].text, VISIBILITY[group.visibility].tone),
            ui.badge(`Członkowie: ${memberCount}`),
          ]),
          ...(group.description ? [ui.text(group.description, "soft")] : []),
          ...membershipActions,
          ...(management.length ? [ui.row(management)] : []),
          ...content,
          ui.button("Wszystkie grupy", ui.navigate("list"), "quiet"),
        ]);
      },

      post: async (ctx, params) => {
        const p = params.id ? await ctx.db.posts.get(params.id, { with: { author: true } }) : null;
        const a = p ? await access(ctx, p.group) : null;
        if (!p || !a) return notFound(POST_NOT_FOUND);
        if (!a.canRead) return noAccess(PRIVATE, a.group.id);
        const isAuthor = p.author.id === ctx.user.id;
        const comments = await ctx.db.comments.findMany({
          where: { post: p.id },
          orderBy: { createdAt: "asc" },
          with: { author: true },
        });
        const likes = await ctx.db.likes.count({ where: { post: p.id } });
        const liked = (await ctx.db.likes.count({ where: { post: p.id, user: ctx.user.id } })) > 0;
        return ui.screen(a.group.name, [
          ui.heading(p.author.name, 3),
          ...(p.pinned ? [ui.badge("Przypięty", "info")] : []),
          ui.text(p.editedAt ? `${p.text} (edytowano)` : p.text),
          ...(p.photo ? [ui.image(p.photo, `Zdjęcie od: ${p.author.name}`)] : []),
          ui.text(`Polubienia: ${likes}`, "soft"),
          ...(a.canPost
            ? [
                ui.button(
                  liked ? "Cofnij polubienie" : "Lubię to",
                  ui.tool("like", { post: p.id }),
                  liked ? "quiet" : undefined,
                ),
              ]
            : []),
          ...(isAuthor
            ? [
                ui.form({
                  submitLabel: "Zapisz zmiany",
                  submit: ui.tool("editPost", { id: p.id }),
                  children: [ui.textInput({ name: "text", label: "Edytuj post", multiline: true, value: p.text })],
                }),
              ]
            : []),
          ...(a.canModerate || isAuthor
            ? [
                ui.row([
                  ...(a.canModerate
                    ? [
                        ui.button(
                          p.pinned ? "Odepnij" : "Przypnij",
                          ui.tool("pinPost", { id: p.id, pinned: !p.pinned }),
                          "quiet",
                        ),
                      ]
                    : []),
                  ui.button("Usuń post", ui.tool("deletePost", { id: p.id }), "danger"),
                ]),
              ]
            : []),
          ui.heading(`Komentarze (${comments.length})`, 3),
          ui.list(
            "Komentarze",
            comments.length
              ? comments.map((c) =>
                  ui.card({
                    title: c.author.name,
                    subtitle: c.text,
                    ...(c.author.id === ctx.user.id || a.canModerate
                      ? { children: [ui.button("Usuń komentarz", ui.tool("deleteComment", { id: c.id }), "quiet")] }
                      : {}),
                  }),
                )
              : [ui.empty("Nie ma jeszcze komentarzy.")],
          ),
          ...(a.canPost
            ? [
                ui.form({
                  submitLabel: "Skomentuj",
                  submit: ui.tool("comment", { post: p.id }),
                  children: [ui.textInput({ name: "text", label: "Komentarz", multiline: true })],
                }),
              ]
            : []),
          back(a.group.id),
        ]);
      },

      members: async (ctx, params) => {
        const a = params.id ? await access(ctx, params.id) : null;
        if (!a) return notFound(NOT_FOUND);
        if (!a.canModerate) return noAccess("Członkami zarządzają moderatorzy grupy.", a.group.id);
        const all = await ctx.db.members.findMany({
          where: { group: a.group.id },
          orderBy: { createdAt: "asc" },
          with: { user: true },
          limit: 1000,
        });
        const pending = all.filter((m) => m.status === "pending");
        const members = all.filter((m) => m.status === "member");
        const banned = all.filter((m) => m.status === "banned");

        const actions = (m: (typeof all)[number]) => {
          if (m.role === "owner" || m.user.id === ctx.user.id) return [];
          if (m.role === "moderator")
            return a.canManage
              ? [
                  ui.button("Odbierz moderatora", ui.tool("setRole", { member: m.id, role: "member" }), "quiet"),
                  ui.button("Usuń z grupy", ui.tool("removeMember", { member: m.id }), "quiet"),
                  ui.button("Zablokuj", ui.tool("removeMember", { member: m.id, ban: true }), "danger"),
                ]
              : [];
          return [
            ...(a.canManage
              ? [ui.button("Mianuj moderatorem", ui.tool("setRole", { member: m.id, role: "moderator" }), "quiet")]
              : []),
            ui.button("Usuń z grupy", ui.tool("removeMember", { member: m.id }), "quiet"),
            ui.button("Zablokuj", ui.tool("removeMember", { member: m.id, ban: true }), "danger"),
          ];
        };

        return ui.screen(`Członkowie: ${a.group.name}`, [
          ui.heading(`Prośby o dołączenie (${pending.length})`, 3),
          ui.list(
            "Prośby o dołączenie",
            pending.length
              ? pending.map((m) =>
                  ui.card({
                    title: m.user.name,
                    children: [
                      ui.row([
                        ui.button("Przyjmij", ui.tool("respondRequest", { member: m.id, accept: true })),
                        ui.button("Odrzuć", ui.tool("respondRequest", { member: m.id, accept: false }), "quiet"),
                      ]),
                    ],
                  }),
                )
              : [ui.empty("Brak próśb o dołączenie.")],
          ),
          ui.heading(`Członkowie (${members.length})`, 3),
          ui.list(
            "Członkowie",
            members.map((m) => {
              const buttons = actions(m);
              return ui.card({
                title: m.user.name,
                badge: ROLE[m.role],
                ...(buttons.length ? { children: [ui.row(buttons)] } : {}),
              });
            }),
          ),
          ...(banned.length
            ? [
                ui.heading(`Zablokowani (${banned.length})`, 3),
                ui.list(
                  "Zablokowani",
                  banned.map((m) =>
                    ui.card({
                      title: m.user.name,
                      children: [ui.button("Odblokuj", ui.tool("unban", { member: m.id }), "quiet")],
                    }),
                  ),
                ),
              ]
            : []),
          back(a.group.id),
        ]);
      },

      settings: async (ctx, params) => {
        const a = params.id ? await access(ctx, params.id) : null;
        if (!a) return notFound(NOT_FOUND);
        if (!a.canManage) return noAccess("Ustawienia zmienia właściciel grupy.", a.group.id);
        const g = a.group;
        return ui.screen(`Ustawienia: ${g.name}`, [
          ui.form({
            submitLabel: "Zapisz ustawienia",
            submit: ui.tool("updateGroup", { id: g.id }),
            children: [
              ui.textInput({ name: "name", label: "Nazwa grupy", value: g.name }),
              ui.textInput({ name: "description", label: "Opis", multiline: true, value: g.description }),
              ui.select({
                name: "visibility",
                label: "Widoczność",
                options: [
                  { value: "public", label: "Publiczna" },
                  { value: "private", label: "Prywatna" },
                ],
                value: g.visibility,
              }),
            ],
          }),
          ui.button("Usuń grupę", ui.tool("deleteGroup", { id: g.id }), "danger"),
          back(g.id),
        ]);
      },
    },

    dashboardWidgets: {
      feed: {
        size: { w: 3, h: 3 },
        render: async (ctx) => {
          const mine = await ctx.db.members.findMany({ where: { user: ctx.user.id, status: "member" }, limit: 500 });
          if (!mine.length)
            return ui.widget("Grupy", [
              ui.empty("Nie należysz jeszcze do żadnej grupy."),
              ui.button("Moje grupy", ui.navigate("list"), "quiet"),
            ]);
          const latest = await ctx.db.posts.findMany({
            where: { group: { in: mine.map((m) => m.group) } },
            orderBy: { lastActivityAt: "desc" },
            limit: 3,
            with: { author: true, group: true },
          });
          const moderated = mine.filter((m) => m.role !== "member").map((m) => m.group);
          const pending = moderated.length
            ? await ctx.db.members.count({ where: { group: { in: moderated }, status: "pending" } })
            : 0;
          return ui.widget("Grupy", [
            ...(pending ? [ui.text(`Prośby o dołączenie: ${pending}`, "soft")] : []),
            ...(latest.length
              ? latest.map((p) =>
                  ui.card({
                    title: p.group.name,
                    subtitle: `${p.author.name}: ${short(p.text)}`,
                    onPress: ui.navigate("post", { id: p.id }),
                  }),
                )
              : [ui.text("Nic nowego w Twoich grupach.", "soft")]),
            ui.button("Moje grupy", ui.navigate("list"), "quiet"),
          ]);
        },
      },
    },

    tools: {
      createGroup: {
        description: "Załóż grupę (publiczną albo prywatną); zakładający zostaje jej właścicielem.",
        input: z.object(groupInput),
        handler: async (ctx, input) => {
          const g = await ctx.db.groups.insert({ ...input, lastActivityAt: ctx.now() });
          await ctx.db.members.insert({ group: g.id, user: ctx.user.id, role: "owner", status: "member" });
          return { toast: "Grupa założona.", navigate: ui.navigate("group", { id: g.id }), data: { id: g.id } };
        },
      },

      updateGroup: {
        description:
          "Zmień nazwę, opis lub widoczność grupy (właściciel albo administrator). Zmiana na publiczną przyjmuje oczekujące prośby.",
        input: z.object({ id, ...groupInput }),
        handler: async (ctx, { id: groupId, ...input }) => {
          const a = await access(ctx, groupId);
          if (!a) return { error: NOT_FOUND };
          if (!a.canManage) return { error: OWNER_ONLY };
          await ctx.db.groups.update(groupId, input);
          if (input.visibility === "public") {
            const pending = await ctx.db.members.findMany({
              where: { group: groupId, status: "pending" },
              limit: 1000,
            });
            for (const m of pending) await ctx.db.members.update(m.id, { status: "member" });
          }
          return {
            toast: "Ustawienia zapisane.",
            navigate: ui.navigate("group", { id: groupId }),
            data: { id: groupId },
          };
        },
      },

      deleteGroup: {
        description: "Usuń grupę z postami i członkostwami (właściciel albo administrator).",
        input: z.object({ id }),
        handler: async (ctx, input) => {
          const a = await access(ctx, input.id);
          if (!a) return { error: NOT_FOUND };
          if (!a.canManage) return { error: OWNER_ONLY };
          await ctx.db.groups.delete(input.id);
          return { toast: "Grupa usunięta.", navigate: ui.navigate("list"), data: { id: input.id } };
        },
      },

      join: {
        description:
          "Dołącz do grupy. Do prywatnej wysyła prośbę o akceptację (administrator aplikacji dołącza od razu).",
        input: z.object({ group: id }),
        handler: async (ctx, input) => {
          const a = await access(ctx, input.group);
          if (!a) return { error: NOT_FOUND };
          if (a.me?.status === "banned") return { error: BANNED };
          if (a.me?.status === "member") return { toast: "Już należysz do tej grupy.", data: { status: "member" } };
          if (a.me?.status === "pending")
            return { toast: "Twoja prośba już czeka na akceptację.", data: { status: "pending" } };
          const status = a.group.visibility === "public" || isAdmin(ctx) ? "member" : "pending";
          await ctx.db.members.insert({ group: a.group.id, user: ctx.user.id, status });
          return {
            toast: status === "member" ? "Witamy w grupie!" : "Prośba o dołączenie wysłana.",
            refresh: true,
            data: { status },
          };
        },
      },

      leave: {
        description: "Opuść grupę albo anuluj prośbę o dołączenie.",
        input: z.object({ group: id }),
        handler: async (ctx, input) => {
          const a = await access(ctx, input.group);
          if (!a) return { error: NOT_FOUND };
          if (!a.me || a.me.status === "banned") return { error: "Nie należysz do tej grupy." };
          if (a.me.role === "owner") return { error: "Właściciel nie może opuścić grupy. Może ją usunąć." };
          await ctx.db.members.delete(a.me.id);
          return {
            toast: a.me.status === "pending" ? "Prośba anulowana." : "Nie należysz już do tej grupy.",
            refresh: true,
          };
        },
      },

      respondRequest: {
        description: "Przyjmij albo odrzuć prośbę o dołączenie do grupy (moderatorzy grupy).",
        input: z.object({ member: id, accept: z.boolean() }),
        handler: async (ctx, input) => {
          const found = await loadMember(ctx, input.member);
          if (found?.m.status !== "pending") return { error: "Ta prośba nie istnieje." };
          if (!found.a.canModerate) return { error: MODERATORS_ONLY };
          if (input.accept) await ctx.db.members.update(found.m.id, { status: "member" });
          else await ctx.db.members.delete(found.m.id);
          return { toast: input.accept ? "Nowy członek przyjęty." : "Prośba odrzucona.", refresh: true };
        },
      },

      setRole: {
        description: "Mianuj członka moderatorem albo odbierz uprawnienia (właściciel albo administrator).",
        input: z.object({ member: id, role: z.enum(["moderator", "member"]) }),
        handler: async (ctx, input) => {
          const found = await loadMember(ctx, input.member);
          if (found?.m.status !== "member") return { error: MEMBER_NOT_FOUND };
          if (!found.a.canManage) return { error: OWNER_ONLY };
          if (found.m.role === "owner") return { error: "Nie można zmienić roli właściciela." };
          await ctx.db.members.update(found.m.id, { role: input.role });
          return {
            toast: input.role === "moderator" ? "Mianowano moderatora." : "Odebrano uprawnienia moderatora.",
            refresh: true,
          };
        },
      },

      removeMember: {
        description:
          "Usuń członka z grupy, opcjonalnie z blokadą ponownego dołączenia (moderatorzy; moderatora usuwa tylko właściciel).",
        input: z.object({ member: id, ban: z.boolean().default(false) }),
        handler: async (ctx, input) => {
          const found = await loadMember(ctx, input.member);
          if (!found || found.m.status === "banned") return { error: MEMBER_NOT_FOUND };
          const { m, a } = found;
          if (!a.canModerate) return { error: MODERATORS_ONLY };
          if (m.role === "owner") return { error: "Nie można usunąć właściciela grupy." };
          if (m.role === "moderator" && !a.canManage)
            return { error: "Moderatora może usunąć tylko właściciel grupy." };
          if (input.ban) await ctx.db.members.update(m.id, { status: "banned", role: "member" });
          else await ctx.db.members.delete(m.id);
          return { toast: input.ban ? "Użytkownik zablokowany." : "Usunięto z grupy.", refresh: true };
        },
      },

      unban: {
        description: "Zdejmij blokadę, żeby użytkownik mógł znów dołączyć (moderatorzy grupy).",
        input: z.object({ member: id }),
        handler: async (ctx, input) => {
          const found = await loadMember(ctx, input.member);
          if (found?.m.status !== "banned") return { error: MEMBER_NOT_FOUND };
          if (!found.a.canModerate) return { error: MODERATORS_ONLY };
          await ctx.db.members.delete(found.m.id);
          return { toast: "Blokada zdjęta.", refresh: true };
        },
      },

      createPost: {
        description: "Napisz post w grupie (opcjonalnie ze zdjęciem).",
        input: z.object({ group: id, text: postText, photo: fileRef().optional() }),
        handler: async (ctx, input) => {
          const a = await access(ctx, input.group);
          if (!a) return { error: NOT_FOUND };
          if (!a.canPost) return { error: a.me?.status === "banned" ? BANNED : JOIN_FIRST };
          const p = await ctx.db.posts.insert({
            group: a.group.id,
            author: ctx.user.id,
            text: input.text,
            photo: input.photo ?? null,
            lastActivityAt: ctx.now(),
          });
          await touch(ctx, a.group.id);
          return { toast: "Post opublikowany.", refresh: true, data: { id: p.id } };
        },
      },

      editPost: {
        description: "Popraw treść swojego posta.",
        input: z.object({ id, text: postText }),
        handler: async (ctx, input) => {
          const p = await ctx.db.posts.get(input.id);
          if (!p) return { error: POST_NOT_FOUND };
          if (p.author !== ctx.user.id) return { error: "Możesz edytować tylko swoje posty." };
          await ctx.db.posts.update(p.id, { text: input.text, editedAt: ctx.now() });
          return { toast: "Post zapisany.", refresh: true, data: { id: p.id } };
        },
      },

      deletePost: {
        description: "Usuń post z komentarzami (autor, moderatorzy grupy albo administrator).",
        input: z.object({ id }),
        handler: async (ctx, input) => {
          const found = await loadPost(ctx, input.id);
          if (!found) return { error: POST_NOT_FOUND };
          if (found.post.author !== ctx.user.id && !found.a.canModerate)
            return { error: "Możesz usuwać tylko swoje posty." };
          await ctx.db.posts.delete(found.post.id);
          return {
            toast: "Post usunięty.",
            navigate: ui.navigate("group", { id: found.post.group }),
            data: { id: input.id },
          };
        },
      },

      pinPost: {
        description: "Przypnij albo odepnij post na górze grupy (moderatorzy grupy).",
        input: z.object({ id, pinned: z.boolean() }),
        handler: async (ctx, input) => {
          const found = await loadPost(ctx, input.id);
          if (!found) return { error: POST_NOT_FOUND };
          if (!found.a.canModerate) return { error: MODERATORS_ONLY };
          await ctx.db.posts.update(found.post.id, { pinned: input.pinned });
          return { toast: input.pinned ? "Post przypięty." : "Post odpięty.", refresh: true };
        },
      },

      comment: {
        description: "Skomentuj post w grupie.",
        input: z.object({ post: id, text: commentText }),
        handler: async (ctx, input) => {
          const found = await loadPost(ctx, input.post);
          if (!found) return { error: POST_NOT_FOUND };
          if (!found.a.canPost) return { error: found.a.me?.status === "banned" ? BANNED : JOIN_FIRST };
          const c = await ctx.db.comments.insert({ post: found.post.id, author: ctx.user.id, text: input.text });
          await touch(ctx, found.post.group, found.post.id);
          return { refresh: true, data: { id: c.id } };
        },
      },

      deleteComment: {
        description: "Usuń komentarz (autor, moderatorzy grupy albo administrator).",
        input: z.object({ id }),
        handler: async (ctx, input) => {
          const c = await ctx.db.comments.get(input.id);
          const found = c ? await loadPost(ctx, c.post) : null;
          if (!c || !found) return { error: "Ten komentarz nie istnieje." };
          if (c.author !== ctx.user.id && !found.a.canModerate)
            return { error: "Możesz usuwać tylko swoje komentarze." };
          await ctx.db.comments.delete(c.id);
          return { toast: "Komentarz usunięty.", refresh: true };
        },
      },

      like: {
        description: "Polub post albo cofnij polubienie.",
        input: z.object({ post: id }),
        handler: async (ctx, input) => {
          const found = await loadPost(ctx, input.post);
          if (!found) return { error: POST_NOT_FOUND };
          if (!found.a.canPost) return { error: found.a.me?.status === "banned" ? BANNED : JOIN_FIRST };
          const [existing] = await ctx.db.likes.findMany({ where: { post: input.post, user: ctx.user.id }, limit: 1 });
          if (existing) await ctx.db.likes.delete(existing.id);
          else await ctx.db.likes.insert({ post: input.post, user: ctx.user.id });
          return { refresh: true, data: { liked: !existing } };
        },
      },

      listGroups: {
        description: "Lista grup społeczności z widocznością i liczbą członków (dla asystentów AI).",
        input: z.object({}),
        readOnly: true,
        handler: async (ctx) => {
          const all = await ctx.db.groups.findMany({ orderBy: { lastActivityAt: "desc" }, limit: 200 });
          const counts = await Promise.all(
            all.map((g) => ctx.db.members.count({ where: { group: g.id, status: "member" } })),
          );
          return {
            data: all.map((g, i) => ({
              id: g.id,
              name: g.name,
              description: g.description,
              visibility: g.visibility,
              members: counts[i],
            })),
          };
        },
      },

      listPosts: {
        description: "Najnowsze posty grupy, jeśli użytkownik może je czytać (dla asystentów AI).",
        input: z.object({ group: id }),
        readOnly: true,
        handler: async (ctx, input) => {
          const a = await access(ctx, input.group);
          if (!a) return { error: NOT_FOUND };
          if (!a.canRead) return { error: PRIVATE };
          const posts = await ctx.db.posts.findMany({
            where: { group: a.group.id },
            orderBy: { lastActivityAt: "desc" },
            with: { author: true },
            limit: 50,
          });
          return {
            data: posts.map((p) => ({
              id: p.id,
              author: p.author.name,
              text: p.text,
              pinned: p.pinned,
              createdAt: p.createdAt,
            })),
          };
        },
      },
    },

    streams: {
      posts: {
        description: "Posty grupy na żywo: najpierw aktualna lista, potem każda zmiana.",
        input: z.object({ group: id }),
        handler: async function* (ctx, input) {
          const a = await access(ctx, input.group);
          if (!a?.canRead) return;
          yield* ctx.db.posts.watch({
            where: { group: input.group },
            orderBy: { lastActivityAt: "desc" },
            with: { author: true },
          });
        },
      },
      comments: {
        description: "Komentarze posta na żywo: najpierw aktualna lista, potem każda zmiana.",
        input: z.object({ post: id }),
        handler: async function* (ctx, input) {
          const found = await loadPost(ctx, input.post);
          if (!found?.a.canRead) return;
          yield* ctx.db.comments.watch({
            where: { post: input.post },
            orderBy: { createdAt: "asc" },
            with: { author: true },
          });
        },
      },
    },
  });
};

export default groups;
