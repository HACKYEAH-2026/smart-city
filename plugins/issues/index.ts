import type { CardTag, Context, FileId, GeoLocation, MetaItem, PluginModule, Tone } from "@app/plugin-sdk";

/**
 * REFERENCE PLUGIN: issue reports ("Zgłoszenia").
 * - A resident reports a problem: photos (up to 3) → title, description, place, optionally anonymous. Before saving,
 *   ctx.ai.findSimilar looks for the same problem among the place's active reports; if it finds one, a sheet asks
 *   "Czy to ten sam problem?" and joining adds the resident's photos, vote and follow to the earlier report.
 * - Residents vote reports up (a toggle; the author's vote is automatic) and comment on them.
 * - Admins reply, keep an internal note, close and reopen reports and change their category; the author and the
 *   residents who joined get a notification. Categories are only for admins: the AI picks one after a report is made.
 * - Per-place settings (voting, comments, who comments, visibility, anonymous reports, required photo) live in the
 *   `settings` table, as the SDK has no settings of its own.
 * The module imports nothing at runtime (only `import type`) — the host provides the SDK.
 */

/** The category every report falls back to: not a row, so it can never be removed (`categoryId: null`). */
const OTHER = "Inne";
/** How long the report tool waits for the AI's category before it gives up (the report goes in either way). */
const CATEGORY_TIMEOUT_MS = 3000;
const OTHER_ID = "other";
const DEFAULT_CATEGORIES = ["Drogi i chodniki", "Oświetlenie", "Czystość", "Zieleń"];
/** Categories besides "Inne": the admin's category menu shows at most 30 options. */
const CATEGORIES_MAX = 29;
const PHOTOS_MAX = 3;
/** Photos a Gallery shows at most (the catalog's limit); a report may collect more as residents join it. */
const GALLERY_MAX = 10;
/** The admins' reply is shown in the report's Timeline, whose notes hold at most 500 characters. */
const REPLY_MAX = 500;
/** Recipients of one ctx.notify call at most. */
const AUDIENCE_MAX = 1000;
/** History steps (closing, reopening) shown at most: the latest ones. */
const HISTORY_MAX = 40;
const SETTINGS_KEY = "main";

/** The Polish form of a noun for a count: 1 → `one`; 2–4 (but not 12–14) → `few`; the rest → `many`. */
const plural = (n: number, one: string, few: string, many: string) => {
  if (n === 1) return one;
  const isFew = [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100);
  return isFew ? few : many;
};
const votesText = (n: number) => `${n} ${plural(n, "głos", "głosy", "głosów")}`;
const commentsText = (n: number) => `${n} ${plural(n, "komentarz", "komentarze", "komentarzy")}`;

const WARSAW = "Europe/Warsaw";
/** "2 paź". */
const formatDay = (d: Date) =>
  new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short", timeZone: WARSAW }).format(d);
/** "30 wrz, 18:40" (built from parts: ICU versions join a date and a time differently, e.g. "30 wrz o 18:40"). */
const formatDateTime = (d: Date) =>
  `${formatDay(d)}, ${new Intl.DateTimeFormat("pl-PL", { hour: "2-digit", minute: "2-digit", timeZone: WARSAW }).format(d)}`;

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

/** Metres between two points (haversine). */
const metresBetween = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
};
/** "15 m od Ciebie", "1,2 km od Ciebie". */
const distanceText = (metres: number) =>
  metres < 1000
    ? `${Math.max(5, Math.round(metres / 5) * 5)} m od Ciebie`
    : `${(metres / 1000).toFixed(1).replace(".", ",")} km od Ciebie`;

/** Splits a list into rows of `size` (a Tags row holds at most 4). */
const chunks = <T>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, i * size + size));

const issues: PluginModule = ({ definePlugin, ui, z, fileRef, geoLocation, t }) => {
  const tables = {
    issues: t.table(
      {
        title: t.text(),
        description: t.text().default(""),
        /** Legacy (v3, picked by the author): kept optional because a required column cannot be dropped at once. */
        category: t.enum(["lighting", "roads", "greenery", "cleanliness", "other"]).optional(),
        /** Legacy (v3, problem or suggestion): kept optional for the same reason. */
        kind: t.enum(["problem", "suggestion"]).optional(),
        /** Active or closed; `accepted` and `fixed` are v3 values (active and closed), never written again. */
        status: t.enum(["open", "accepted", "fixed", "closed"]).default("open"),
        /** Reported without the name: members see "Zgłoszenie anonimowe", admins see who. */
        anonymous: t.boolean().default(false),
        /** Legacy (v3, one photo per report): still shown first; new photos go to `photos`. */
        photo: t.ref("file").optional(),
        /** Where the problem is (picked on the app's map), with its address. */
        location: t.json<GeoLocation>().optional(),
        reporter: t.ref("user"),
        /** Only admins see it; `null` = "Inne" (also where reports of a removed category land). */
        categoryId: t.ref("categories").optional(),
        /** `admin` once an admin picked the category: the AI never changes it then. */
        categorySource: t.enum(["ai", "admin"]).default("ai"),
        /** The admins' answer, shown to members in the report's history. */
        reply: t.text().default(""),
        replyAt: t.timestamp().optional(),
        /** Only for admins. */
        note: t.text().default(""),
      },
      { indexes: [["status"]] },
    ),
    /** Closing and reopening, in order (the report's history). */
    statusLog: t.table({
      issue: t.ref("issues"),
      status: t.enum(["open", "accepted", "fixed", "closed"]),
      note: t.text().default(""),
    }),
    comments: t.table({
      issue: t.ref("issues"),
      author: t.ref("user"),
      text: t.text(),
    }),
    /**
     * A resident's report joined to an earlier one (the AI found the same problem): they follow it from then on and
     * get its notifications. One per person per report.
     */
    reports: t.table(
      {
        issue: t.ref("issues"),
        author: t.ref("user"),
        description: t.text().default(""),
        photo: t.ref("file").optional(),
        anonymous: t.boolean().default(false),
      },
      { unique: [["issue", "author"]] },
    ),
    votes: t.table({ issue: t.ref("issues"), voter: t.ref("user") }, { unique: [["issue", "voter"]] }),
    photos: t.table(
      { issue: t.ref("issues"), file: t.ref("file"), author: t.ref("user"), position: t.integer().default(0) },
      { indexes: [["issue", "position"]], unique: [["issue", "file"]] },
    ),
    categories: t.table({ name: t.text() }, { unique: [["name"]] }),
    /** One row per place (`key` = "main"); a place installed before v4 has none and gets the defaults. */
    settings: t.table(
      {
        key: t.text().default(SETTINGS_KEY),
        votingEnabled: t.boolean().default(true),
        commentsEnabled: t.boolean().default(true),
        commentPermission: t.enum(["members", "admins"]).default("members"),
        visibility: t.enum(["members", "adminsAndAuthor"]).default("members"),
        allowAnonymous: t.boolean().default(true),
        requirePhoto: t.boolean().default(false),
      },
      { unique: [["key"]] },
    ),
    /** An admin opened the report's admin detail: it is no longer unread for them. */
    seen: t.table({ issue: t.ref("issues"), viewer: t.ref("user") }, { unique: [["issue", "viewer"]] }),
  };
  type Ctx = Context<typeof tables>;
  type Issue = Awaited<ReturnType<Ctx["db"]["issues"]["insert"]>>;
  type Category = Awaited<ReturnType<Ctx["db"]["categories"]["insert"]>>;

  const settingsSchema = z.object({
    votingEnabled: z.boolean(),
    commentsEnabled: z.boolean(),
    commentPermission: z.enum(["members", "admins"]),
    visibility: z.enum(["members", "adminsAndAuthor"]),
    allowAnonymous: z.boolean(),
    requirePhoto: z.boolean(),
  });
  type Settings = ReturnType<typeof settingsSchema.parse>;
  const DEFAULT_SETTINGS: Settings = {
    votingEnabled: true,
    commentsEnabled: true,
    commentPermission: "members",
    visibility: "members",
    allowAnonymous: true,
    requirePhoto: false,
  };

  const id = z.string().min(1);
  const photosSchema = z.array(fileRef()).max(PHOTOS_MAX, "Dodaj najwyżej 3 zdjęcia").default([]);
  const draftSchema = z.object({
    title: z.string().trim().min(3, "Opisz problem w kilku słowach").max(120),
    description: z.string().trim().max(2000).default(""),
    photos: photosSchema,
    location: geoLocation().optional(),
    anonymous: z.boolean().default(false),
  });
  type Draft = ReturnType<typeof draftSchema.parse>;
  const jsonSchema = z.string().transform((s, ctx): unknown => {
    try {
      return JSON.parse(s);
    } catch {
      ctx.addIssue({ code: "custom", message: "Invalid JSON" });
      return z.NEVER;
    }
  });
  /** The draft passed to the similar-report sheet as a JSON param or argument; invalid = null. */
  const parseDraft = (json: string | undefined): Draft | null => {
    const parsed = jsonSchema.pipe(draftSchema).safeParse(json ?? "");
    return parsed.success ? parsed.data : null;
  };
  /** The photos of step 1, passed to the form as a JSON param; invalid = none. */
  const parsePhotos = (json: string | undefined): FileId[] => {
    const parsed = jsonSchema.pipe(photosSchema).safeParse(json ?? "");
    return parsed.success ? parsed.data : [];
  };

  const isAdmin = (ctx: Ctx) => ctx.user.role === "admin";
  const isClosed = (issue: Pick<Issue, "status">) => issue.status === "closed" || issue.status === "fixed";
  const ACTIVE = { in: ["open", "accepted"] } satisfies { in: Issue["status"][] };
  const CLOSED = { in: ["closed", "fixed"] } satisfies { in: Issue["status"][] };

  const settingsOf = async (ctx: Ctx): Promise<Settings> => {
    const row = await ctx.db.settings.findFirst({ where: { key: SETTINGS_KEY } });
    return row ? settingsSchema.parse(row) : DEFAULT_SETTINGS;
  };
  /** Private mode for this viewer: only their own reports. */
  const ownOnly = (ctx: Ctx, settings: Settings) => settings.visibility === "adminsAndAuthor" && !isAdmin(ctx);
  const canSee = (ctx: Ctx, settings: Settings, issue: Pick<Issue, "reporter">) =>
    !ownOnly(ctx, settings) || issue.reporter === ctx.user.id;
  const canComment = (ctx: Ctx, settings: Settings) =>
    settings.commentsEnabled && (settings.commentPermission === "members" || isAdmin(ctx));

  /** The report if this viewer may see it (private mode: only their own), else null. */
  const visibleIssue = async (ctx: Ctx, settings: Settings, issueId: string | undefined) => {
    const issue = issueId ? await ctx.db.issues.get(issueId) : null;
    return issue && canSee(ctx, settings, issue) ? issue : null;
  };

  /** Who reported it, as this viewer may see it: members never see an anonymous author's name. */
  const authorName = (ctx: Ctx, issue: Pick<Issue, "anonymous">, reporter: { id: string; name: string }) => {
    if (!issue.anonymous) return reporter.name;
    if (reporter.id === ctx.user.id || isAdmin(ctx)) return `${reporter.name} (anonimowo)`;
    return "Zgłoszenie anonimowe";
  };

  /** A commenter's name: an anonymous report's author stays anonymous in its comments too (but to admins and themself). */
  const commenterName = (
    ctx: Ctx,
    issue: Pick<Issue, "anonymous" | "reporter">,
    author: { id: string; name: string },
  ) =>
    author.id === issue.reporter && issue.anonymous && author.id !== ctx.user.id && !isAdmin(ctx)
      ? "Autor zgłoszenia"
      : author.id === issue.reporter && issue.anonymous
        ? `${author.name} (anonimowo)`
        : author.name;

  /**
   * What the AI compares: the title and the description, without the address. The place is the scope: the same
   * problem reported at two addresses of one place is offered for joining (the model judges "same object and place"
   * and would reject two addresses).
   */
  const describe = (i: { title: string; description: string }) => [i.title, i.description].filter(Boolean).join(". ");

  /** Votes, comments and photos of the reports, and what this viewer voted, in a few queries. */
  const factsOf = async (ctx: Ctx, list: Issue[]) => {
    const ids = list.map((i) => i.id);
    const where = { issue: { in: ids } };
    const [votes, comments, photos] = ids.length
      ? await Promise.all([
          ctx.db.votes.findMany({ where, limit: 1000 }),
          ctx.db.comments.findMany({ where, limit: 1000 }),
          ctx.db.photos.findMany({ where, orderBy: { position: "asc" }, limit: 1000 }),
        ])
      : [[], [], []];
    const countBy = (rows: { issue: string }[]) =>
      rows.reduce((m, r) => m.set(r.issue, (m.get(r.issue) ?? 0) + 1), new Map<string, number>());
    const voteCounts = countBy(votes);
    const commentCounts = countBy(comments);
    const voted = new Set(votes.filter((v) => v.voter === ctx.user.id).map((v) => v.issue));
    return {
      votes: (issue: Issue) => voteCounts.get(issue.id) ?? 0,
      voted: (issue: Issue) => voted.has(issue.id),
      comments: (issue: Issue) => commentCounts.get(issue.id) ?? 0,
      photos: (issue: Issue): FileId[] => [
        ...(issue.photo ? [issue.photo] : []),
        ...photos.filter((p) => p.issue === issue.id).map((p) => p.file),
      ],
    };
  };
  type Facts = Awaited<ReturnType<typeof factsOf>>;

  type HistoryEvent = { at: Date; title: string; text: string; tone: Tone };
  type WidgetOptions = Parameters<typeof ui.widget>[2];
  const CLOSED_BADGE: { text: string; tone: Tone } = { text: "Zamknięte", tone: "neutral" };
  const commentsMeta = (n: number): MetaItem => ({ text: String(n), icon: "chat", label: `Komentarze: ${n}` });

  const photoAlt = "Zdjęcie zgłoszenia";
  /** A card's thumbnail: the first photo, with "+N" for the rest (`withMore: false` in private mode, design 16). */
  const thumbnail = (photos: FileId[], withMore: boolean) => {
    const [first] = photos;
    if (!first) return {};
    const more = Math.min(photos.length - 1, 99);
    return { image: { file: first, alt: photoAlt, ...(withMore && more > 0 ? { more } : {}) } };
  };

  const voteLabel = (n: number) => `Podbij zgłoszenie, ${votesText(n)}`;

  /** A report on the list (design 03): photo, title, when, comments, the vote pill; closed ones are marked. */
  const listCard = (ctx: Ctx, settings: Settings, facts: Facts, issue: Issue) => {
    const closed = isClosed(issue);
    const privateView = ownOnly(ctx, settings);
    const comments = facts.comments(issue);
    const meta: MetaItem[] = [
      { at: issue.createdAt.toISOString() },
      ...(settings.commentsEnabled && !privateView ? [commentsMeta(comments)] : []),
    ];
    const votes = facts.votes(issue);
    const pressed = facts.voted(issue);
    const counter =
      settings.votingEnabled && !privateView
        ? {
            counter: {
              label: voteLabel(votes),
              value: votes,
              pressed,
              ...(closed ? {} : { action: ui.tool("vote", { id: issue.id }) }),
            },
          }
        : {};
    return ui.card({
      title: issue.title,
      ...thumbnail(facts.photos(issue), !privateView),
      meta,
      ...counter,
      ...(closed ? { badge: CLOSED_BADGE } : {}),
      onPress: ui.navigate("detail", { id: issue.id }),
    });
  };

  const notFound = () =>
    ui.screen("Nie znaleziono", [ui.empty("To zgłoszenie nie istnieje albo nie masz do niego dostępu.")], {
      back: ui.navigate("list"),
    });
  const adminsOnly = () =>
    ui.screen("Brak dostępu", [ui.empty("Ten widok jest tylko dla administratorów miejsca.")], {
      back: ui.navigate("list"),
    });

  /** The report's address opens a dedicated map view without displacing its history or reply form. */
  const placeOf = (issue: Issue) =>
    issue.location
      ? [ui.place(issue.location.address || "Lokalizacja na mapie", ui.navigate("map", { id: issue.id }))]
      : [];

  /** Reports this user made or joined (newest first). */
  const mineOf = async (ctx: Ctx) => {
    const joined = await ctx.db.reports.findMany({ where: { author: ctx.user.id }, limit: 1000 });
    const [own, others] = await Promise.all([
      ctx.db.issues.findMany({ where: { reporter: ctx.user.id }, orderBy: { createdAt: "desc" }, limit: 1000 }),
      ctx.db.issues.findMany({
        where: { id: { in: joined.map((r) => r.issue) } },
        orderBy: { createdAt: "desc" },
        limit: 1000,
      }),
    ]);
    const ids = new Set(own.map((i) => i.id));
    return [...own, ...others.filter((i) => !ids.has(i.id))].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  };

  const byVotes = (facts: Facts) => (a: Issue, b: Issue) => facts.votes(b) - facts.votes(a);

  /** The reports of a list tab (closed ones only in "Moje" and "Zamknięte"). */
  const tabIssues = async (ctx: Ctx, tab: string) => {
    if (tab === "mine") return mineOf(ctx);
    return ctx.db.issues.findMany({
      where: { status: tab === "closed" ? CLOSED : ACTIVE },
      orderBy: { createdAt: "desc" },
      limit: 1000,
    });
  };

  const LIST_EMPTY = {
    all: {
      title: "Na razie cisza",
      text: "Nikt jeszcze niczego nie zgłosił. Widzisz usterkę albo masz pomysł? Daj znać jako pierwszy.",
    },
    mine: { title: "Na razie cisza", text: "Nie masz jeszcze żadnych zgłoszeń." },
    closed: { title: "Na razie cisza", text: "Nie ma jeszcze zamkniętych zgłoszeń." },
  };
  const listEmpty = (tab: string) => {
    const copy = tab === "mine" ? LIST_EMPTY.mine : tab === "closed" ? LIST_EMPTY.closed : LIST_EMPTY.all;
    return ui.empty(copy.text, { title: copy.title, icon: "megaphone" });
  };

  /** Private mode for a member (design 16): only their own reports, a lock banner, no tabs, votes or comments. */
  const privateList = async (ctx: Ctx, settings: Settings) => {
    const own = await ctx.db.issues.findMany({
      where: { reporter: ctx.user.id },
      orderBy: { createdAt: "desc" },
      limit: 1000,
    });
    const facts = await factsOf(ctx, own);
    return ui.screen(
      "Moje zgłoszenia",
      [
        ui.notice("W tym miejscu zgłoszenia widzą tylko administratorzy i ich autorzy.", { icon: "lock" }),
        own.length
          ? ui.list(
              "Lista zgłoszeń",
              own.map((i) => listCard(ctx, settings, facts, i)),
            )
          : listEmpty("all"),
        ui.fab({ label: "Zgłoś", icon: "plus", action: ui.navigate("new") }),
      ],
      { eyebrow: ctx.community.name },
    );
  };

  /** The history members see (design 04): reported, the admins' reply, closing and reopening, by date. */
  const historyOf = async (ctx: Ctx, issue: Issue) => {
    const latest = await ctx.db.statusLog.findMany({
      where: { issue: issue.id },
      orderBy: { createdAt: "desc" },
      limit: HISTORY_MAX,
    });
    const log = [...latest].reverse();
    const reply: HistoryEvent[] =
      issue.reply && issue.replyAt
        ? [{ at: issue.replyAt, title: "Odpowiedź administratora", text: issue.reply, tone: "info" }]
        : [];
    // v3 logged every status ("open", "accepted"); only a reopening after a close is a step of the history now.
    const shown = log.filter((step, i) => isClosed(step) || (step.status === "open" && log.slice(0, i).some(isClosed)));
    const steps = shown.map(
      (step): HistoryEvent => ({
        at: step.createdAt,
        title: isClosed(step) ? "Zamknięte" : "Otwarte ponownie",
        text: step.note,
        tone: isClosed(step) ? "success" : "neutral",
      }),
    );
    const events = [...reply, ...steps].sort((a, b) => a.at.getTime() - b.at.getTime());
    return ui.timeline([
      { title: "Zgłoszone", at: formatDateTime(issue.createdAt), tone: "neutral" },
      ...events.map((e) => ({
        title: e.title,
        at: formatDay(e.at),
        tone: e.tone,
        ...(e.text ? { text: e.text } : {}),
      })),
    ]);
  };

  const commentsOf = async (ctx: Ctx, settings: Settings, issue: Issue) => {
    if (!settings.commentsEnabled) return [];
    const comments = await ctx.db.comments.findMany({
      where: { issue: issue.id },
      orderBy: { createdAt: "asc" },
      with: { author: true },
      limit: 500,
    });
    const box = canComment(ctx, settings)
      ? ui.form({
          submitLabel: "Wyślij komentarz",
          submit: ui.tool("comment", { id: issue.id }),
          inline: true,
          children: [ui.textInput({ name: "text", label: "Dodaj komentarz", placeholder: "Dodaj komentarz…" })],
        })
      : ui.text("Komentować mogą tylko administratorzy.", "soft");
    return [
      ui.heading(`Komentarze (${comments.length})`, 3),
      ...(comments.length
        ? [
            ui.list(
              "Komentarze",
              comments.map((c) => {
                const name = commenterName(ctx, issue, c.author);
                return ui.activity({ title: name, text: c.text, person: name, at: c.createdAt.toISOString() });
              }),
            ),
          ]
        : []),
      box,
    ];
  };

  /** The admins' category list, by name ("Inne" is added after it). */
  const categoriesOf = (ctx: Ctx) => ctx.db.categories.findMany({ orderBy: { name: "asc" }, limit: 100 });

  /**
   * Picks the report's category with the AI (title and description), after the report is saved. A failure or an
   * unknown name leave it in "Inne"; a category an admin picked is never changed. It runs before the tool answers
   * (nothing may outlive its handler), so the host bounds it with `timeoutMs` (a plugin has no timers of its own).
   */
  const categorize = async (ctx: Ctx, issue: Issue) => {
    const categories = await categoriesOf(ctx);
    if (!categories.length) return;
    const names = [...categories.map((c) => c.name), OTHER];
    const ask = ctx.ai.call({
      prompt: [
        "Pick the category of this report about a problem in a place (a building, an estate, a district).",
        `Answer with exactly one of: ${names.map((n) => `"${n}"`).join(", ")}. If none fits, answer "${OTHER}".`,
        `Title: ${issue.title}`,
        `Description: ${issue.description || "-"}`,
      ].join("\n"),
      schema: z.object({ category: z.string() }),
      // A slow model must not hold up the report: past this the call fails and the report stays in "Inne".
      timeoutMs: CATEGORY_TIMEOUT_MS,
    });
    const answer = await ask.catch(() => null);
    const picked = answer?.category.trim().toLowerCase();
    // Looked up again after the answer: an admin may have removed the category meanwhile (then it stays "Inne").
    const category = picked ? (await categoriesOf(ctx)).find((c) => c.name.toLowerCase() === picked) : undefined;
    if (!category) return;
    // Removed between that lookup and this write: the reference is refused; the report, already saved, stays in "Inne".
    await ctx.db.issues.updateMany({ id: issue.id, categorySource: "ai" }, { categoryId: category.id }).catch(() => 0);
  };

  /** Saves the user's photos under a report, after the ones it already has; a photo it has is skipped (a retry). */
  const addPhotos = async (ctx: Ctx, issueId: string, photos: FileId[]) => {
    const existing = await ctx.db.photos.findMany({ where: { issue: issueId }, limit: 1000 });
    const had = new Set<string>(existing.map((p) => p.file));
    const fresh = [...new Set(photos)].filter((file) => !had.has(file));
    for (const [i, file] of fresh.entries()) {
      await ctx.db.photos.insert({ issue: issueId, file, author: ctx.user.id, position: existing.length + i });
    }
  };

  /**
   * What the place's rules and the photos say about a draft, before anything is saved (a report or joining one):
   * a required photo, anonymity, and photos that exist here and were uploaded by this user (the engine lets a row
   * reference any kept file, e.g. a photo of someone else's report). The error for the resident, or null.
   */
  const draftError = async (ctx: Ctx, settings: Settings, draft: Draft) => {
    if (settings.requirePhoto && !draft.photos.length) return "W tym miejscu zgłoszenie musi mieć zdjęcie.";
    if (draft.anonymous && !settings.allowAnonymous) return "Zgłoszenia anonimowe są wyłączone w tym miejscu.";
    const own = await Promise.all(draft.photos.map((file) => isOwnPhoto(ctx, file)));
    return own.every(Boolean) ? null : "Nie można dodać tego zdjęcia. Dodaj je jeszcze raz.";
  };
  /** The file is an upload of this installation by the acting user. */
  const isOwnPhoto = async (ctx: Ctx, file: FileId) => {
    const info = await ctx.files.info(file).catch(() => null);
    return info?.uploadedBy === ctx.user.id;
  };

  /** A new report with its photos and the author's own vote. */
  const createIssue = async (ctx: Ctx, draft: Draft) => {
    const issue = await ctx.db.issues.insert({
      title: draft.title,
      description: draft.description,
      anonymous: draft.anonymous,
      location: draft.location ?? null,
      reporter: ctx.user.id,
    });
    await addPhotos(ctx, issue.id, draft.photos);
    await ctx.db.votes.insert({ issue: issue.id, voter: ctx.user.id });
    if (isAdmin(ctx)) await ctx.db.seen.insert({ issue: issue.id, viewer: ctx.user.id });
    return issue;
  };

  /** The place's active report describing the same problem (AI), or null; a failed check never blocks a report. */
  const findMatch = async (ctx: Ctx, draft: Draft) => {
    const active = await ctx.db.issues.findMany({ where: { status: ACTIVE }, limit: 50 });
    const facts = await factsOf(ctx, active);
    const [match] = await ctx.ai
      .findSimilar({ text: describe(draft), image: draft.photos[0] ?? null }, active, {
        text: describe,
        image: (i) => facts.photos(i)[0],
        limit: 1,
      })
      .catch(() => []);
    return match ?? null;
  };

  /**
   * Who hears about replies and closing: the author, and the residents who joined while the place's reports are
   * visible to members (in private mode they no longer see it). At most AUDIENCE_MAX, the author first.
   */
  const tellFollowers = async (
    ctx: Ctx,
    issue: Issue,
    message: { title: string; body: string; tone: "info" | "success" },
  ) => {
    const settings = await settingsOf(ctx);
    const joined =
      settings.visibility === "members"
        ? await ctx.db.reports.findMany({ where: { issue: issue.id }, limit: AUDIENCE_MAX })
        : [];
    const users = [...new Set([issue.reporter, ...joined.map((r) => r.author)])].slice(0, AUDIENCE_MAX);
    await ctx.notify({
      to: { users },
      title: clip(message.title, 120),
      body: clip(message.body, 500),
      tone: message.tone,
      open: ui.navigate("detail", { id: issue.id }),
    });
  };

  /** Active and closed reports, and how many active ones this admin has not opened yet. */
  const adminCounts = async (ctx: Ctx) => {
    const [active, closed, seen] = await Promise.all([
      ctx.db.issues.findMany({ where: { status: ACTIVE }, limit: 1000 }),
      ctx.db.issues.count({ where: { status: CLOSED } }),
      ctx.db.seen.findMany({ where: { viewer: ctx.user.id }, limit: 1000 }),
    ]);
    const seenIds = new Set(seen.map((s) => s.issue));
    return { active: active.length, closed, unread: active.filter((i) => !seenIds.has(i.id)).length };
  };

  /** When each closed report was last closed (the admin panel's "zamknięte 25 wrz"; v3 rows: their last change). */
  const closedAt = async (ctx: Ctx, list: Issue[]) => {
    const log = list.length
      ? await ctx.db.statusLog.findMany({
          where: { issue: { in: list.map((i) => i.id) }, status: CLOSED },
          orderBy: { createdAt: "asc" },
          limit: 1000,
        })
      : [];
    return new Map([
      ...list.map((i): [string, Date] => [i.id, i.updatedAt]),
      ...log.map((step): [string, Date] => [step.issue, step.createdAt]),
    ]);
  };

  const settingSwitch = (
    settings: Settings,
    name: "votingEnabled" | "commentsEnabled" | "allowAnonymous" | "requirePhoto",
    label: string,
    hint: string,
  ) => ui.switch({ name, label, hint, value: settings[name], action: ui.tool("configure") });

  /** The settings' category chips (design 13): rows of 4, each removable but "Inne". */
  const categoryTags = (categories: Category[]) =>
    chunks<CardTag>(
      [
        ...categories.map((c) => ({ text: c.name, onRemove: ui.tool("removeCategory", { id: c.id }) })),
        { text: OTHER, variant: "pill" },
      ],
      4,
    ).map((row) => ui.tags(row));

  const shareOf = (ctx: Ctx, issue: Issue, variant: "icon" | "button") =>
    ui.share(
      variant === "button" ? "Udostępnij sąsiadom" : "Udostępnij",
      `/app/c/${ctx.community.slug}/issues/detail?id=${issue.id}`,
      {
        variant,
      },
    );

  return definePlugin({
    id: "issues",
    name: "Zgłoszenia",
    version: "4.0.1",
    icon: "🛠️",
    description:
      "Zgłaszanie usterek ze zdjęciem i miejscem na mapie, podbijanie i odpowiedzi administratorów; AI łączy zgłoszenia tego samego problemu.",
    permissions: ["db", "files", "ai", "notify"],
    nav: [{ view: "list", label: "Zgłoszenia" }],
    adminView: "admin",
    tables,

    onInstall: async (ctx) => {
      await ctx.db.settings.upsert({ key: SETTINGS_KEY }, { on: ["key"] });
      for (const name of DEFAULT_CATEGORIES) await ctx.db.categories.upsert({ name }, { on: ["name"] });
    },

    views: {
      /**
       * Active reports by votes or newest, and the viewer's own (closed ones marked); with voting off: newest, mine
       * and closed. Admins get "Panel" in the header. Private mode for members: `privateList`.
       */
      list: async (ctx, params) => {
        const settings = await settingsOf(ctx);
        if (ownOnly(ctx, settings)) return privateList(ctx, settings);
        const tabs = settings.votingEnabled ? ["popular", "newest", "mine"] : ["newest", "mine", "closed"];
        const tab = tabs.find((value) => value === params.tab) ?? tabs[0] ?? "newest";
        const list = await tabIssues(ctx, tab);
        const facts = await factsOf(ctx, list);
        const ordered = tab === "popular" ? [...list].sort(byVotes(facts)) : list;
        const TAB_LABELS: Record<string, string> = {
          popular: "Popularne",
          newest: "Najnowsze",
          mine: "Moje",
          closed: "Zamknięte",
        };
        return ui.screen(
          "Zgłoszenia",
          [
            ui.tabs({
              label: "Sortowanie",
              variant: "segmented",
              options: tabs.map((value) => ({
                label: TAB_LABELS[value] ?? value,
                selected: value === tab,
                action: ui.navigate("list", { tab: value }, { replace: true }),
              })),
            }),
            ordered.length
              ? ui.list(
                  "Lista zgłoszeń",
                  ordered.map((i) => listCard(ctx, settings, facts, i)),
                )
              : listEmpty(tab),
            ui.fab({ label: "Zgłoś", icon: "plus", action: ui.navigate("new") }),
          ],
          {
            eyebrow: ctx.community.name,
            ...(isAdmin(ctx) ? { actions: [{ label: "Panel", icon: "shield", action: ui.navigate("panel") }] } : {}),
          },
        );
      },

      /** Step 1 (design 06): up to 3 photos from the camera or the gallery; skippable unless the place requires one. */
      new: async (ctx) => {
        const settings = await settingsOf(ctx);
        return ui.screen(
          "Zrób zdjęcie",
          [
            ui.form({
              submitLabel: "Dalej",
              submit: ui.tool("photos"),
              children: [
                ui.imagePicker({ name: "photos", label: "Pokaż problem z bliska — do 3 zdjęć", max: PHOTOS_MAX }),
              ],
            }),
            ...(settings.requirePhoto
              ? [ui.text("W tym miejscu zgłoszenie musi mieć zdjęcie.", "soft")]
              : [ui.button("Pomiń zdjęcie", ui.navigate("form", undefined, { replace: true }), "quiet")]),
          ],
          { eyebrow: "Nowe zgłoszenie", back: ui.navigate("list") },
        );
      },

      /** Step 2 (design 07): the photos from step 1, the title, the description, the place, anonymity. */
      form: async (ctx, params) => {
        const settings = await settingsOf(ctx);
        // Only the user's own uploads: the param is anyone's to write (the host signs nothing foreign either).
        const named = parsePhotos(params.photos);
        const own = await Promise.all(named.map((file) => isOwnPhoto(ctx, file)));
        const photos = named.filter((_, i) => own[i]);
        return ui.screen(
          "Nowe zgłoszenie",
          [
            ui.form({
              submitLabel: "Wyślij zgłoszenie",
              submitIcon: "send",
              submit: ui.tool("report"),
              children: [
                ui.imagePicker({
                  name: "photos",
                  label: "Zdjęcia",
                  hideLabel: true,
                  max: PHOTOS_MAX,
                  value: photos.map((file) => ({ file, alt: photoAlt })),
                }),
                ui.textInput({ name: "title", label: "Tytuł" }),
                ui.textInput({
                  name: "description",
                  label: "Opis",
                  multiline: true,
                  placeholder: "Opisz, co się dzieje i od kiedy.",
                }),
                ui.locationInput({ name: "location", label: "Lokalizacja" }),
                ...(settings.allowAnonymous
                  ? [
                      ui.switch({
                        name: "anonymous",
                        label: "Zgłoś anonimowo",
                        hint: "Członkowie nie zobaczą Twojego imienia",
                        value: false,
                      }),
                    ]
                  : []),
              ],
            }),
          ],
          { back: ui.navigate("new") },
        );
      },

      /** The AI found the same problem (design 08, a sheet over the form): join it, or report a different one. */
      merge: async (ctx, params) => {
        const settings = await settingsOf(ctx);
        const target = await visibleIssue(ctx, settings, params.target);
        const draft = parseDraft(params.draft);
        if (!target || !draft || isClosed(target) || settings.visibility !== "members") return notFound();
        const facts = await factsOf(ctx, [target]);
        const votes = facts.votes(target);
        const distance =
          draft.location && target.location
            ? [{ text: distanceText(metresBetween(draft.location, target.location)) }]
            : [];
        return ui.screen(
          "Czy to ten sam problem?",
          [
            ui.text(
              settings.votingEnabled
                ? "Ktoś zgłosił już coś podobnego w tym miejscu. Dołącz, a Twój głos podbije zgłoszenie."
                : "Ktoś zgłosił już coś podobnego w tym miejscu. Dołącz do tego zgłoszenia.",
              "soft",
            ),
            ui.card({
              title: target.title,
              ...thumbnail(facts.photos(target), false),
              meta: [{ at: target.createdAt.toISOString() }, ...distance],
              ...(settings.votingEnabled ? { counter: { label: votesText(votes), value: votes } } : {}),
            }),
            ui.button(
              settings.votingEnabled ? "Tak, dołącz i podbij" : "Tak, dołącz",
              ui.tool("join", { target: target.id, draft: params.draft ?? "" }),
              "primary",
              "arrowUp",
            ),
            ui.button("Nie, to inny problem", ui.tool("report", { ...draft, force: true }), "quiet"),
          ],
          { eyebrow: "Wykryliśmy podobne zgłoszenie", back: ui.navigate("list") },
        );
      },

      /** After joining (design 08, success state in the sheet). */
      joined: async (ctx, params) => {
        const settings = await settingsOf(ctx);
        const issue = await visibleIssue(ctx, settings, params.id);
        if (!issue) return notFound();
        const votes = await ctx.db.votes.count({ where: { issue: issue.id } });
        const photos = Number(params.photos ?? "0");
        const tail = settings.votingEnabled ? `, które ma teraz ${votesText(votes)}` : "";
        const lead =
          photos > 1
            ? `Twoje zdjęcia trafiły do zgłoszenia${tail}.`
            : photos === 1
              ? `Twoje zdjęcie trafiło do zgłoszenia${tail}.`
              : settings.votingEnabled
                ? `Zgłoszenie ma teraz ${votesText(votes)}.`
                : "";
        return ui.screen(
          settings.votingEnabled ? "Dołączono i podbito" : "Dołączono",
          [
            ui.text([lead, "Powiadomimy Cię o zmianach."].filter(Boolean).join(" ")),
            ui.button("Zobacz zgłoszenie", ui.navigate("detail", { id: issue.id })),
            ui.button("Wróć do pulpitu", ui.app("dashboard"), "quiet"),
          ],
          { back: ui.navigate("list") },
        );
      },

      /** Confirmation after a report went in (design 09). */
      sent: async (ctx, params) => {
        const settings = await settingsOf(ctx);
        const issue = await visibleIssue(ctx, settings, params.id);
        if (!issue) return notFound();
        const facts = await factsOf(ctx, [issue]);
        return ui.screen(
          "Zgłoszenie wysłane",
          [
            ui.hero({
              title: "Dziękujemy za zgłoszenie",
              text: "Administratorzy miejsca już je widzą. Powiadomimy Cię o odpowiedzi administratora.",
            }),
            ui.card({
              title: issue.title,
              variant: "compact",
              ...thumbnail(facts.photos(issue), false),
              onPress: ui.navigate("detail", { id: issue.id }),
            }),
            ...(settings.visibility === "members" ? [shareOf(ctx, issue, "button")] : []),
            ui.button("Wróć do pulpitu", ui.app("dashboard"), "quiet"),
          ],
          { back: ui.navigate("list"), chrome: false },
        );
      },

      /** A report (designs 04, 15): photos, who and when, the vote, the history, comments. */
      detail: async (ctx, params) => {
        const settings = await settingsOf(ctx);
        const issue = await visibleIssue(ctx, settings, params.id);
        if (!issue) return notFound();
        const [facts, withReporter] = await Promise.all([
          factsOf(ctx, [issue]),
          ctx.db.issues.get(issue.id, { with: { reporter: true } }),
        ]);
        const reporter = withReporter?.reporter ?? { id: issue.reporter, name: "" };
        const photos = facts.photos(issue);
        const closed = isClosed(issue);
        const votes = facts.votes(issue);
        const pressed = facts.voted(issue);
        const vote =
          settings.votingEnabled && !closed
            ? [
                ui.button(
                  `${pressed ? "Podbite" : "Podbij"} ${votes}`,
                  ui.tool("vote", { id: issue.id }),
                  undefined,
                  "arrowUp",
                  { pressed },
                ),
              ]
            : [];
        const share = settings.visibility === "members" ? [shareOf(ctx, issue, "icon")] : [];
        const actions = [...vote, ...share];
        return ui.screen(
          issue.title,
          [
            ...(photos.length
              ? [ui.gallery(photos.slice(0, GALLERY_MAX).map((file) => ({ file, alt: photoAlt })))]
              : []),
            ...(closed ? [ui.tags([{ text: "Zamknięte", tone: "neutral", dot: true }])] : []),
            ui.meta([{ text: authorName(ctx, issue, reporter) }, { at: issue.createdAt.toISOString() }]),
            ...(issue.description ? [ui.text(issue.description)] : []),
            ...placeOf(issue),
            ...(actions.length ? [ui.row(actions, { grow: true })] : []),
            ui.heading("Historia", 3),
            await historyOf(ctx, issue),
            ...(await commentsOf(ctx, settings, issue)),
          ],
          {
            back: ui.navigate("list"),
            ...(isAdmin(ctx)
              ? { actions: [{ label: "Obsłuż", icon: "shield", action: ui.navigate("adminDetail", { id: issue.id }) }] }
              : {}),
          },
        );
      },

      map: async (ctx, params) => {
        const settings = await settingsOf(ctx);
        const issue = await visibleIssue(ctx, settings, params.id);
        if (!issue?.location) return notFound();
        return ui.screen(
          "Miejsce zgłoszenia",
          [
            ui.map({
              label: "Miejsce zgłoszenia",
              layers: [
                ui.map.pins("Zgłoszenie", [
                  {
                    id: issue.id,
                    title: issue.title,
                    at: { lat: issue.location.lat, lng: issue.location.lng },
                    ...(issue.location.address ? { subtitle: issue.location.address } : {}),
                  },
                ]),
              ],
            }),
          ],
          { back: ui.navigate(params.admin === "true" && isAdmin(ctx) ? "adminDetail" : "detail", { id: issue.id }) },
        );
      },

      /** The admins' part of the plugin's page in "Zarządzaj miejscem" (design 10): counts, the panel, settings. */
      admin: async (ctx) => {
        if (!isAdmin(ctx)) return adminsOnly();
        const counts = await adminCounts(ctx);
        return ui.screen(
          "Zgłoszenia",
          [
            ui.row(
              [
                ui.stat(plural(counts.active, "aktywne", "aktywne", "aktywnych"), String(counts.active), "success"),
                ui.stat(plural(counts.closed, "zamknięte", "zamknięte", "zamkniętych"), String(counts.closed)),
              ],
              { grow: true },
            ),
            ui.list(
              "Obsługa zgłoszeń",
              [
                ui.card({
                  icon: "shield",
                  title: "Panel zgłoszeń",
                  subtitle: "Odpowiedzi, zamykanie, notatki",
                  count: Math.min(counts.unread, 999),
                  onPress: ui.navigate("panel"),
                }),
                ui.card({
                  icon: "sliders",
                  title: "Ustawienia rozszerzenia",
                  subtitle: "Głosowanie, komentarze, widoczność",
                  onPress: ui.navigate("settings"),
                }),
              ],
              { variant: "grouped" },
            ),
          ],
          { eyebrow: "Rozszerzenie" },
        );
      },

      /** The admin panel (design 11): active or closed, by votes or newest, unread ones marked. */
      panel: async (ctx, params) => {
        if (!isAdmin(ctx)) return adminsOnly();
        const settings = await settingsOf(ctx);
        const state = params.state === "closed" ? "closed" : "active";
        const sort = settings.votingEnabled && params.sort !== "newest" ? "votes" : "newest";
        const [list, counts, seen] = await Promise.all([
          ctx.db.issues.findMany({
            where: { status: state === "closed" ? CLOSED : ACTIVE },
            orderBy: { createdAt: "desc" },
            limit: 1000,
          }),
          adminCounts(ctx),
          ctx.db.seen.findMany({ where: { viewer: ctx.user.id }, limit: 1000 }),
        ]);
        const facts = await factsOf(ctx, list);
        const closings = state === "closed" ? await closedAt(ctx, list) : new Map<string, Date>();
        const seenIds = new Set(seen.map((s) => s.issue));
        const ordered = sort === "votes" ? [...list].sort(byVotes(facts)) : list;
        const go = (next: { state?: string; sort?: string }) =>
          ui.navigate("panel", { state, sort, ...next }, { replace: true });
        const metaOf = (issue: Issue): MetaItem[] => {
          const closedOn = closings.get(issue.id);
          if (closedOn) return [{ text: `zamknięte ${formatDay(closedOn)}` }];
          return [
            { at: issue.createdAt.toISOString() },
            ...(settings.commentsEnabled ? [{ text: `${facts.comments(issue)} kom.` }] : []),
          ];
        };
        const row = (issue: Issue) =>
          ui.card({
            title: issue.title,
            unread: !seenIds.has(issue.id),
            ...thumbnail(facts.photos(issue), true),
            meta: metaOf(issue),
            ...(settings.votingEnabled
              ? { counter: { label: votesText(facts.votes(issue)), value: facts.votes(issue) } }
              : {}),
            onPress: ui.navigate("adminDetail", { id: issue.id }),
          });
        const stateLabel = state === "closed" ? "Zamknięte" : "Aktywne";
        const count = state === "closed" ? counts.closed : counts.active;
        return ui.screen(
          "Zgłoszenia",
          [
            ui.tabs({
              label: "Stan zgłoszeń",
              variant: "tiles",
              options: [
                {
                  label: "Aktywne",
                  count: counts.active,
                  selected: state === "active",
                  action: go({ state: "active" }),
                },
                {
                  label: "Zamknięte",
                  count: counts.closed,
                  selected: state === "closed",
                  action: go({ state: "closed" }),
                },
              ],
            }),
            ui.row([
              ui.heading(`${stateLabel} (${count})`, 3),
              ...(settings.votingEnabled
                ? [
                    ui.menu({
                      label: "Sortowanie",
                      variant: "text",
                      options: [
                        { label: "Najwięcej głosów", selected: sort === "votes", action: go({ sort: "votes" }) },
                        { label: "Najnowsze", selected: sort === "newest", action: go({ sort: "newest" }) },
                      ],
                    }),
                  ]
                : []),
            ]),
            ordered.length
              ? ui.list("Zgłoszenia do obsługi", ordered.map(row), { variant: "grouped" })
              : ui.empty(state === "closed" ? "Nie ma zamkniętych zgłoszeń." : "Nie ma aktywnych zgłoszeń."),
          ],
          {
            eyebrow: "Panel administratora",
            back: ui.app("pluginPage"),
            actions: [
              { label: "Ustawienia rozszerzenia", icon: "settings", variant: "icon", action: ui.navigate("settings") },
            ],
          },
        );
      },

      /** One report for admins (design 12): category, reply, internal note, close or reopen. Opening it marks it read. */
      adminDetail: async (ctx, params) => {
        if (!isAdmin(ctx)) return adminsOnly();
        const issue = params.id ? await ctx.db.issues.get(params.id, { with: { reporter: true } }) : null;
        if (!issue) return notFound();
        await ctx.db.seen.upsert({ issue: issue.id, viewer: ctx.user.id }, { on: ["issue", "viewer"] });
        const plain: Issue = { ...issue, reporter: issue.reporter.id };
        const [facts, categories] = await Promise.all([factsOf(ctx, [plain]), categoriesOf(ctx)]);
        const closed = isClosed(issue);
        const options = [...categories.map((c) => ({ id: c.id, name: c.name })), { id: OTHER_ID, name: OTHER }].map(
          (c) => ({
            label: c.name,
            selected: (issue.categoryId ?? OTHER_ID) === c.id,
            action: ui.tool("setCategory", { id: issue.id, category: c.id }),
          }),
        );
        const category =
          options.length >= 2
            ? ui.menu({ label: "Zmień kategorię", variant: "chip", icon: "sparkles", options })
            : ui.tags([{ text: OTHER }]);
        return ui.screen(
          "Szczegóły i obsługa",
          [
            ui.card({
              title: issue.title,
              variant: "featured",
              ...thumbnail(facts.photos(plain), true),
              meta: [{ text: authorName(ctx, issue, issue.reporter) }, { at: issue.createdAt.toISOString() }],
              ...(closed ? { badge: CLOSED_BADGE } : {}),
              children: [
                category,
                ...(issue.description ? [ui.text(issue.description)] : []),
                ui.row([
                  ui.meta([
                    { text: votesText(facts.votes(plain)), icon: "arrowUp" },
                    { text: commentsText(facts.comments(plain)), icon: "chat" },
                  ]),
                  ...(issue.location ? [ui.place("Mapa", ui.navigate("map", { id: issue.id, admin: "true" }))] : []),
                ]),
              ],
            }),
            ui.form({
              submitLabel: "Zapisz i powiadom autora",
              submitIcon: "send",
              submit: ui.tool("respond", { id: issue.id }),
              children: [
                ui.textInput({
                  name: "reply",
                  label: "Odpowiedź dla członków",
                  multiline: true,
                  value: issue.reply,
                  hint: "Widoczna dla członków pod zgłoszeniem",
                }),
                ui.textInput({
                  name: "note",
                  variant: "muted",
                  label: "Notatka wewnętrzna",
                  multiline: true,
                  value: issue.note,
                  hint: "Tylko dla administratorów",
                  placeholder: "Widzą ją tylko administratorzy",
                }),
              ],
            }),
            ui.button(
              closed ? "Otwórz ponownie" : "Zamknij zgłoszenie",
              ui.tool("setClosed", { id: issue.id, closed: !closed }),
              "quiet",
              closed ? "refresh" : "check",
            ),
          ],
          { eyebrow: "Zgłoszenie", back: ui.navigate("panel") },
        );
      },

      /** The plugin's settings (design 13): every change saves at once. */
      settings: async (ctx) => {
        if (!isAdmin(ctx)) return adminsOnly();
        const [settings, categories] = await Promise.all([settingsOf(ctx), categoriesOf(ctx)]);
        return ui.screen(
          "Zgłoszenia",
          [
            ui.heading("Funkcje", 3),
            ui.list(
              "Funkcje",
              [
                settingSwitch(settings, "votingEnabled", "Podbijanie", "Głosowanie strzałką w górę na zgłoszenia"),
                settingSwitch(settings, "commentsEnabled", "Komentarze", "Dyskusja pod każdym zgłoszeniem"),
                settingSwitch(
                  settings,
                  "allowAnonymous",
                  "Zgłoszenia anonimowe",
                  "Autor może ukryć swoje imię przed członkami",
                ),
                settingSwitch(settings, "requirePhoto", "Wymagaj zdjęcia", "Każde zgłoszenie musi mieć zdjęcie"),
              ],
              { variant: "grouped" },
            ),
            ...(settings.commentsEnabled
              ? [
                  ui.select({
                    name: "commentPermission",
                    label: "Kto może komentować",
                    variant: "segmented",
                    options: [
                      { value: "members", label: "Wszyscy członkowie" },
                      { value: "admins", label: "Tylko administratorzy" },
                    ],
                    value: settings.commentPermission,
                    action: ui.tool("configure"),
                  }),
                ]
              : []),
            ui.select({
              name: "visibility",
              label: "Widoczność zgłoszeń",
              variant: "radio",
              options: [
                {
                  value: "members",
                  label: "Wszyscy członkowie",
                  hint: "Zgłoszenia są publiczne w obrębie miejsca",
                },
                {
                  value: "adminsAndAuthor",
                  label: "Tylko administratorzy i autor",
                  hint: "Członkowie widzą tylko swoje zgłoszenia",
                },
              ],
              value: settings.visibility,
              action: ui.tool("configure"),
            }),
            ui.heading("Kategorie", 3),
            ui.notice(
              "Zgłoszenia są przypisywane do kategorii automatycznie na podstawie tytułu i opisu. Możesz to poprawić w obsłudze zgłoszenia.",
              { icon: "sparkles", variant: "plain" },
            ),
            ...categoryTags(categories),
            ui.form({
              submitLabel: "Dodaj",
              submit: ui.tool("addCategory"),
              inline: true,
              children: [ui.textInput({ name: "name", label: "Nowa kategoria" })],
            }),
          ],
          { eyebrow: "Rozszerzenie", back: ui.app("pluginPage") },
        );
      },
    },

    dashboardWidgets: {
      /**
       * The most voted active reports (3 rows at 3×2, 6 at 3×3; newest without counts when voting is off), the count of
       * active ones and "Zgłoś problem". Private mode for members: only the count of their own reports and the button.
       */
      summary: {
        title: "Zgłoszenia",
        size: { w: 3, h: 2 },
        sizes: [{ w: 3, h: 3 }],
        render: async (ctx, frame) => {
          const settings = await settingsOf(ctx);
          const report = ui.button("Zgłoś problem", ui.navigate("new"), "ink", "camera");
          const header = (count: number, label: string): WidgetOptions => ({
            icon: "megaphone",
            link: { label, count, action: ui.navigate("list") },
            onPress: ui.navigate("list"),
          });
          if (ownOnly(ctx, settings)) {
            const own = await ctx.db.issues.count({ where: { reporter: ctx.user.id } });
            return ui.widget(
              "Zgłoszenia",
              [report],
              header(own, plural(own, "Twoje zgłoszenie", "Twoje zgłoszenia", "Twoich zgłoszeń")),
            );
          }
          const active = await ctx.db.issues.findMany({
            where: { status: ACTIVE },
            orderBy: { createdAt: "desc" },
            limit: 1000,
          });
          const facts = await factsOf(ctx, active);
          const rows = frame.size.h >= 3 ? 6 : 3;
          const top = (settings.votingEnabled ? [...active].sort(byVotes(facts)) : active).slice(0, rows);
          const row = (issue: Issue) =>
            ui.card({
              title: issue.title,
              ...(settings.votingEnabled
                ? { counter: { label: votesText(facts.votes(issue)), value: facts.votes(issue) } }
                : {}),
              onPress: ui.navigate("detail", { id: issue.id }),
            });
          return ui.widget(
            "Zgłoszenia",
            [
              top.length
                ? ui.list(
                    settings.votingEnabled ? "Najpopularniejsze zgłoszenia" : "Najnowsze zgłoszenia",
                    top.map(row),
                  )
                : ui.empty("Nikt jeszcze niczego nie zgłosił.", { title: "Na razie cisza" }),
              report,
            ],
            header(active.length, plural(active.length, "aktywne", "aktywne", "aktywnych")),
          );
        },
      },
    },

    tools: {
      /** Step 1 → step 2: the photos travel to the form as a JSON param. */
      photos: {
        description: "Dodaj zdjęcia do nowego zgłoszenia (krok 1 z 2).",
        input: z.object({ photos: photosSchema }),
        handler: async (ctx, { photos }) => {
          const settings = await settingsOf(ctx);
          if (settings.requirePhoto && !photos.length) return { error: "Dodaj co najmniej jedno zdjęcie." };
          const params = photos.length ? { photos: JSON.stringify(photos) } : undefined;
          // Replaced: once a report is sent (it replaces the form too), back leads to the list.
          return { navigate: ui.navigate("form", params, { replace: true }) };
        },
      },

      report: {
        description:
          "Zgłoś problem w miejscu (zdjęcia, opis i miejsce: lat, lng, adres). Jeśli AI znajdzie ten sam problem, pyta o dołączenie.",
        input: draftSchema.extend({ force: z.boolean().default(false) }),
        handler: async (ctx, { force, ...draft }) => {
          const settings = await settingsOf(ctx);
          const error = await draftError(ctx, settings, draft);
          if (error) return { error };
          // Joining someone else's report would show it to the author, so private places never offer it.
          const match = !force && settings.visibility === "members" ? await findMatch(ctx, draft) : null;
          if (match) {
            return {
              navigate: ui.navigate(
                "merge",
                { target: match.item.id, draft: JSON.stringify(draft) },
                { present: "sheet" },
              ),
              data: { similar: match.item.id, reason: match.reason },
            };
          }
          const issue = await createIssue(ctx, draft);
          await categorize(ctx, issue);
          return { navigate: ui.navigate("sent", { id: issue.id }, { replace: true }), data: { id: issue.id } };
        },
      },

      /** "Tak, dołącz i podbij": the user's photos go to the earlier report, with their vote and follow. */
      join: {
        description: "Dołącz swoje zgłoszenie (zdjęcia, głos) do istniejącego zgłoszenia tego samego problemu.",
        input: z.object({ target: id, draft: z.string() }),
        handler: async (ctx, input) => {
          const settings = await settingsOf(ctx);
          const draft = parseDraft(input.draft);
          const issue = await visibleIssue(ctx, settings, input.target);
          if (!issue || !draft || settings.visibility !== "members")
            return { error: "To zgłoszenie już nie istnieje." };
          if (isClosed(issue)) return { error: "To zgłoszenie jest już zamknięte." };
          const error = await draftError(ctx, settings, draft);
          if (error) return { error };
          await addPhotos(ctx, issue.id, draft.photos);
          const voted = await ctx.db.votes.count({ where: { issue: issue.id, voter: ctx.user.id } });
          if (settings.votingEnabled && !voted) await ctx.db.votes.insert({ issue: issue.id, voter: ctx.user.id });
          await ctx.db.reports.upsert(
            { issue: issue.id, author: ctx.user.id, description: draft.description, anonymous: draft.anonymous },
            { on: ["issue", "author"] },
          );
          return {
            navigate: ui.navigate(
              "joined",
              { id: issue.id, photos: String(draft.photos.length) },
              { present: "sheet" },
            ),
            data: { id: issue.id },
          };
        },
      },

      /** Votes a report up, or takes the vote back. */
      vote: {
        description: "Podbij zgłoszenie albo cofnij swój głos.",
        input: z.object({ id }),
        handler: async (ctx, input) => {
          const settings = await settingsOf(ctx);
          if (!settings.votingEnabled) return { error: "Podbijanie jest wyłączone w tym miejscu." };
          const issue = await visibleIssue(ctx, settings, input.id);
          if (!issue) return { error: "To zgłoszenie już nie istnieje." };
          if (isClosed(issue)) return { error: "To zgłoszenie jest już zamknięte." };
          const removed = await ctx.db.votes.deleteMany({ issue: issue.id, voter: ctx.user.id });
          if (!removed) await ctx.db.votes.insert({ issue: issue.id, voter: ctx.user.id });
          const votes = await ctx.db.votes.count({ where: { issue: issue.id } });
          return { refresh: true, data: { voted: !removed, votes } };
        },
      },

      comment: {
        description: "Dodaj komentarz pod zgłoszeniem.",
        input: z.object({
          id,
          text: z.string({ error: "Napisz komentarz." }).trim().min(1, "Napisz komentarz.").max(500),
        }),
        handler: async (ctx, input) => {
          const settings = await settingsOf(ctx);
          if (!settings.commentsEnabled) return { error: "Komentarze są wyłączone w tym miejscu." };
          if (!canComment(ctx, settings)) return { error: "Komentować mogą tylko administratorzy." };
          const issue = await visibleIssue(ctx, settings, input.id);
          if (!issue) return { error: "To zgłoszenie już nie istnieje." };
          await ctx.db.comments.insert({ issue: issue.id, author: ctx.user.id, text: input.text });
          return { toast: "Komentarz dodany.", refresh: true };
        },
      },

      /** "Zapisz i powiadom autora": a changed reply goes to the author and the residents who joined. */
      respond: {
        description: "Zapisz odpowiedź dla członków i notatkę wewnętrzną (tylko administrator).",
        input: z.object({
          id,
          reply: z.string().trim().max(REPLY_MAX, `Odpowiedź może mieć najwyżej ${REPLY_MAX} znaków.`).default(""),
          note: z.string().trim().max(2000).default(""),
        }),
        requires: "admin",
        handler: async (ctx, input) => {
          const issue = await ctx.db.issues.get(input.id);
          if (!issue) return { error: "To zgłoszenie już nie istnieje." };
          const replied = input.reply !== "" && input.reply !== issue.reply;
          const updated = await ctx.db.issues.update(issue.id, {
            reply: input.reply,
            note: input.note,
            ...(input.reply === "" ? { replyAt: null } : replied ? { replyAt: ctx.now() } : {}),
          });
          if (replied && updated) {
            await tellFollowers(ctx, updated, {
              title: "Administrator odpowiedział na zgłoszenie",
              body: `${updated.title}: ${input.reply}`,
              tone: "info",
            });
          }
          return { toast: replied ? "Zapisano i powiadomiono autora." : "Zapisano.", refresh: true };
        },
      },

      /** Closes or reopens a report; the author and the residents who joined hear about it. */
      setClosed: {
        description: "Zamknij albo otwórz ponownie zgłoszenie (tylko administrator).",
        input: z.object({ id, closed: z.boolean() }),
        requires: "admin",
        handler: async (ctx, input) => {
          const issue = await ctx.db.issues.get(input.id);
          if (!issue) return { error: "To zgłoszenie już nie istnieje." };
          if (isClosed(issue) === input.closed) return { refresh: true };
          const status = input.closed ? "closed" : "open";
          const updated = await ctx.db.issues.update(issue.id, { status });
          await ctx.db.statusLog.insert({ issue: issue.id, status });
          if (updated) {
            await tellFollowers(
              ctx,
              updated,
              input.closed
                ? { title: "Zgłoszenie zamknięte", body: updated.title, tone: "success" }
                : { title: "Zgłoszenie otwarte ponownie", body: updated.title, tone: "info" },
            );
          }
          return {
            toast: input.closed ? "Zgłoszenie zamknięte." : "Zgłoszenie otwarte ponownie.",
            refresh: true,
          };
        },
      },

      /** An admin picks the category: the AI never changes it after that. */
      setCategory: {
        description: "Zmień kategorię zgłoszenia (tylko administrator).",
        input: z.object({ id, category: id }),
        requires: "admin",
        handler: async (ctx, input) => {
          const category = input.category === OTHER_ID ? null : await ctx.db.categories.get(input.category);
          if (input.category !== OTHER_ID && !category) return { error: "Tej kategorii już nie ma." };
          const updated = await ctx.db.issues.update(input.id, {
            categoryId: category?.id ?? null,
            categorySource: "admin",
          });
          if (!updated) return { error: "To zgłoszenie już nie istnieje." };
          return { toast: `Kategoria: ${category?.name ?? OTHER}`, refresh: true };
        },
      },

      /** A setting changed on the settings screen (each switch and choice saves at once). */
      configure: {
        description: "Zmień ustawienia zgłoszeń w miejscu (tylko administrator).",
        input: settingsSchema.partial(),
        requires: "admin",
        handler: async (ctx, patch) => {
          // Only the fields sent change: another admin's change to another setting is never written back. (Not an
          // upsert: its update writes every column, the omitted ones with their defaults.)
          const exists = await ctx.db.settings.count({ where: { key: SETTINGS_KEY } });
          if (!exists) await ctx.db.settings.insert({ key: SETTINGS_KEY });
          await ctx.db.settings.updateMany({ key: SETTINGS_KEY }, patch);
          return { refresh: true };
        },
      },

      addCategory: {
        description: "Dodaj kategorię zgłoszeń (tylko administrator).",
        input: z.object({
          name: z
            .string({ error: "Wpisz nazwę kategorii." })
            .trim()
            .min(1, "Wpisz nazwę kategorii.")
            .max(40, "Nazwa jest za długa."),
        }),
        requires: "admin",
        handler: async (ctx, { name }) => {
          const categories = await categoriesOf(ctx);
          const taken = [...categories.map((c) => c.name), OTHER].some((n) => n.toLowerCase() === name.toLowerCase());
          if (taken) return { error: "Taka kategoria już jest." };
          if (categories.length >= CATEGORIES_MAX)
            return { error: "To już wszystkie kategorie, na jakie jest miejsce." };
          await ctx.db.categories.insert({ name });
          return { toast: "Dodano kategorię.", refresh: true };
        },
      },

      /** Removing a category moves its reports to "Inne" (the reference is cleared). */
      removeCategory: {
        description: "Usuń kategorię zgłoszeń; jej zgłoszenia trafią do „Inne” (tylko administrator).",
        input: z.object({ id }),
        requires: "admin",
        handler: async (ctx, input) => {
          if (!(await ctx.db.categories.delete(input.id))) return { error: "Tej kategorii już nie ma." };
          return { toast: "Usunięto kategorię. Jej zgłoszenia są teraz w „Inne”.", refresh: true };
        },
      },

      list: {
        description: "Lista aktywnych zgłoszeń w miejscu (dla asystentów AI).",
        input: z.object({}),
        readOnly: true,
        handler: async (ctx) => {
          const settings = await settingsOf(ctx);
          const active = await ctx.db.issues.findMany({
            where: { status: ACTIVE, ...(ownOnly(ctx, settings) ? { reporter: ctx.user.id } : {}) },
            orderBy: { createdAt: "desc" },
            limit: 1000,
          });
          const facts = await factsOf(ctx, active);
          return {
            data: active.map((i) => ({
              id: i.id,
              title: i.title,
              createdAt: i.createdAt.toISOString(),
              ...(settings.votingEnabled ? { votes: facts.votes(i) } : {}),
            })),
          };
        },
      },
    },
  });
};

export default issues;
