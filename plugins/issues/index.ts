import type {
  Context,
  FileId,
  GeoLocation,
  PluginModule,
} from '@app/plugin-sdk';

/**
 * REFERENCE PLUGIN: issue reports.
 * Flow: form (optional photo and place on the map) → ctx.ai.findSimilar checks open issues →
 * if one is similar, we ask "is this the same problem?" → merging attaches the resident's report
 * (description + photo) to the earlier issue. Only the community admin changes the status.
 * Data lives in declared tables (`issues`, `reports`) with foreign keys to platform users and files.
 * The module imports nothing at runtime (only `import type`) — the host provides the SDK.
 */
const CATEGORY_VALUES = [
  'lighting',
  'roads',
  'greenery',
  'cleanliness',
  'other',
] as const;
/** A problem to fix, or an idea for the place (design: "Rodzaj" in the new report form). */
const KIND_VALUES = ['problem', 'suggestion'] as const;
const KINDS: {
  value: (typeof KIND_VALUES)[number];
  label: string;
  icon: 'alert' | 'idea';
}[] = [
  { value: 'problem', label: 'Problem', icon: 'alert' },
  { value: 'suggestion', label: 'Sugestia', icon: 'idea' },
];
type Category = (typeof CATEGORY_VALUES)[number];
const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'lighting', label: 'Oświetlenie' },
  { value: 'roads', label: 'Drogi i chodniki' },
  { value: 'greenery', label: 'Zieleń' },
  { value: 'cleanliness', label: 'Czystość' },
  { value: 'other', label: 'Inne' },
];
const STATUS = {
  open: { text: 'Nowe', tone: 'info' },
  accepted: { text: 'Przyjęte', tone: 'warning' },
  fixed: { text: 'Naprawione', tone: 'success' },
} as const;

const categoryLabel = (v: string) =>
  CATEGORIES.find((c) => c.value === v)?.label ?? v;
/** "1 osoba zgłasza", "3 osoby zgłaszają", "5 osób zgłasza" (Polish plural: 2–4 except 12–14 take "osoby"). */
const supporters = (n: number) => {
  const few = [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100);
  return n === 1
    ? '1 osoba zgłasza'
    : few
      ? `${n} osoby zgłaszają`
      : `${n} osób zgłasza`;
};

/** The Polish form of a noun for a count: 1 → `one`; 2–4 (but not 12–14) → `few`; the rest → `many`. */
const plural = (n: number, one: string, few: string, many: string) => {
  if (n === 1) return one;
  const isFew = [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100);
  return isFew ? few : many;
};

type Draft = {
  title: string;
  description: string;
  category: Category;
  kind: (typeof KIND_VALUES)[number];
  anonymous: boolean;
  photo?: FileId;
  location?: GeoLocation;
};

const issues: PluginModule = ({
  definePlugin,
  ui,
  z,
  fileRef,
  geoLocation,
  t,
}) => {
  const tables = {
    issues: t.table(
      {
        title: t.text(),
        description: t.text().default(''),
        category: t.enum(CATEGORY_VALUES).default('other'),
        kind: t.enum(KIND_VALUES).default('problem'),
        status: t.enum(['open', 'accepted', 'fixed']).default('open'),
        /** Reported without the name: members see "Zgłoszenie anonimowe", the admin sees who. */
        anonymous: t.boolean().default(false),
        photo: t.ref('file').optional(),
        /** Where the problem is (picked on the app's map), with its address. */
        location: t.json<GeoLocation>().optional(),
        reporter: t.ref('user'),
      },
      { indexes: [['status']] },
    ),
    /** A resident's report under an issue (including the first reporter's); one per person per issue. */
    reports: t.table(
      {
        issue: t.ref('issues'),
        author: t.ref('user'),
        description: t.text().default(''),
        photo: t.ref('file').optional(),
        anonymous: t.boolean().default(false),
      },
      { unique: [['issue', 'author']] },
    ),
  };
  type Ctx = Context<typeof tables>;

  const draftSchema = z.object({
    title: z.string().trim().min(3, 'Opisz problem w kilku słowach').max(120),
    category: z.enum(CATEGORY_VALUES).default('other'),
    kind: z.enum(KIND_VALUES).default('problem'),
    anonymous: z.boolean().default(false),
    description: z.string().trim().max(2000).default(''),
    photo: fileRef().optional(),
    location: geoLocation().optional(),
  });
  const jsonSchema = z.string().transform((s, ctx) => {
    try {
      return JSON.parse(s);
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Invalid JSON' });
      return z.NEVER;
    }
  });
  /** Form draft passed as a JSON param/argument; invalid = null. */
  const parseDraft = (json: string | undefined): Draft | null => {
    const parsed = jsonSchema.pipe(draftSchema).safeParse(json ?? '');
    return parsed.success ? parsed.data : null;
  };

  /** Attaches the user's report to an issue (updates it if they already reported this issue). */
  const addReport = (
    ctx: Ctx,
    issue: string,
    draft: Pick<Draft, 'description' | 'photo' | 'anonymous'>,
  ) =>
    ctx.db.reports.upsert(
      {
        issue,
        author: ctx.user.id,
        description: draft.description,
        photo: draft.photo ?? null,
        anonymous: draft.anonymous,
      },
      { on: ['issue', 'author'] },
    );

  /** A resident's name on a report: members never see an anonymous one's; the admin sees it marked as anonymous. */
  const reporterName = (
    viewer: { id: string; role: string },
    r: { anonymous: boolean; author: { id: string; name: string } },
  ) => {
    if (!r.anonymous) return r.author.name;
    if (r.author.id === viewer.id || viewer.role === 'admin')
      return `${r.author.name} (anonimowo)`;
    return 'Zgłoszenie anonimowe';
  };

  /** How many residents report each of the issues (the first reporter included): issue id → count. */
  const supportOf = async (ctx: Ctx, ids: string[]) => {
    const reports = await ctx.db.reports.findMany({
      where: { issue: { in: ids } },
      limit: 1000,
    });
    const counts = reports.reduce(
      (m, r) => m.set(r.issue, (m.get(r.issue) ?? 0) + 1),
      new Map<string, number>(),
    );
    return (id: string) => counts.get(id) ?? 0;
  };

  /** What the AI compares: the title, the description and the address (the same lamp post is at the same address). */
  const describe = (i: {
    title: string;
    description: string;
    location?: GeoLocation | null;
  }) =>
    [i.title, i.description, i.location?.address].filter(Boolean).join('. ');

  /** The open issues placed on the map, one layer per status (its tone colours the pins); nothing when none is. */
  const openIssuesMap = (
    items: {
      id: string;
      title: string;
      status: keyof typeof STATUS;
      location: GeoLocation | null;
    }[],
    count: (id: string) => number,
  ) => {
    const layer = (status: 'open' | 'accepted') =>
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
                  onPress: ui.navigate('detail', { id: i.id }),
                },
              ]
            : [],
        ),
        STATUS[status].tone,
      );
    const layers = [layer('open'), layer('accepted')].filter(
      (l) => l.items.length,
    );
    return layers.length ? [ui.map({ label: 'Mapa zgłoszeń', layers })] : [];
  };

  /** The issue's address and a map with its pin. */
  const issuePlace = (
    id: string,
    title: string,
    location: GeoLocation,
    tone: 'info' | 'warning' | 'success',
  ) => [
    ...(location.address ? [ui.text(location.address, 'soft')] : []),
    ui.map({
      label: 'Miejsce zgłoszenia',
      layers: [
        ui.map.pins(
          'Zgłoszenie',
          [
            {
              id,
              at: location,
              title,
              ...(location.address ? { subtitle: location.address } : {}),
            },
          ],
          tone,
        ),
      ],
    }),
  ];

  return definePlugin({
    id: 'issues',
    name: 'Zgłoszenia',
    version: '3.2.0',
    icon: '🛠️',
    description:
      'Zgłaszanie usterek ze zdjęciem i miejscem na mapie; AI łączy zgłoszenia tego samego problemu.',
    permissions: ['db', 'files', 'ai'],
    nav: [{ view: 'list', label: 'Zgłoszenia i sugestie' }],
    tables,

    views: {
      list: async (ctx) => {
        const items = await ctx.db.issues.findMany({
          orderBy: { createdAt: 'desc' },
        });
        const count = await supportOf(
          ctx,
          items.map((i) => i.id),
        );
        return ui.screen('Zgłoszenia i sugestie', [
          ui.text(
            `Usterki zgłoszone przez użytkowników: ${ctx.community.name}.`,
            'soft',
          ),
          ui.button('Nowe zgłoszenie', ui.navigate('new')),
          ...openIssuesMap(items, count),
          ui.list(
            'Lista zgłoszeń',
            items.length
              ? items.map((i) =>
                  ui.card({
                    title: i.title,
                    subtitle: `${categoryLabel(i.category)} · ${supporters(count(i.id))}`,
                    badge: STATUS[i.status],
                    onPress: ui.navigate('detail', { id: i.id }),
                  }),
                )
              : [ui.empty('Nie ma jeszcze zgłoszeń. Zgłoś pierwszą usterkę.')],
          ),
        ]);
      },

      /** "Sugestia" on the dashboard opens this form with the suggestion kind already picked. */
      new: (_ctx, params) =>
        ui.screen('Nowe zgłoszenie', [
          ui.form({
            submitLabel: 'Wyślij zgłoszenie',
            submit: ui.tool('report'),
            children: [
              ui.imagePicker({ name: 'photo', label: 'Zdjęcie (opcjonalnie)' }),
              ui.select({
                name: 'kind',
                label: 'Rodzaj',
                options: KINDS,
                value: params.kind === 'suggestion' ? 'suggestion' : 'problem',
              }),
              ui.select({
                name: 'category',
                label: 'Kategoria',
                variant: 'chips',
                options: CATEGORIES,
                value: 'other',
              }),
              ui.textInput({ name: 'title', label: 'Tytuł' }),
              ui.textInput({
                name: 'description',
                label: 'Opis',
                multiline: true,
              }),
              ui.locationInput({
                name: 'location',
                label: 'Lokalizacja (opcjonalnie)',
              }),
              ui.switch({
                name: 'anonymous',
                label: 'Zgłoś anonimowo',
                hint: 'Członkowie nie zobaczą Twojego imienia',
                value: false,
              }),
            ],
          }),
        ]),

      /** Confirmation after a report went in: the report as the residents see it, and a way back to the list. */
      sent: async (ctx, params) => {
        const issue = params.id ? await ctx.db.issues.get(params.id) : null;
        if (!issue)
          return ui.screen('Nie znaleziono', [
            ui.button('Wróć do listy', ui.navigate('list')),
          ]);
        const status = STATUS[issue.status];
        return ui.screen('Zgłoszenie wysłane', [
          ui.hero({
            title: 'Dziękujemy za zgłoszenie',
            text: 'Administratorzy miejsca już je widzą.',
          }),
          ui.card({
            title: issue.title,
            subtitle: categoryLabel(issue.category),
            badge: status,
            onPress: ui.navigate('detail', { id: issue.id }),
            ...(issue.photo
              ? { children: [ui.image(issue.photo, `Zdjęcie: ${issue.title}`)] }
              : {}),
          }),
          ui.button('Wróć do listy', ui.navigate('list')),
        ]);
      },

      /** Question before merging: the form data comes in the `draft` param. */
      merge: async (ctx, params) => {
        const target = params.target
          ? await ctx.db.issues.get(params.target)
          : null;
        const draft = parseDraft(params.draft);
        if (!target || !draft)
          return ui.screen('Nie znaleziono', [
            ui.button('Wróć', ui.navigate('list')),
          ]);
        return ui.screen('Czy to ten sam problem?', [
          ui.text(
            params.reason || 'Znaleźliśmy podobne zgłoszenie w okolicy.',
            'soft',
          ),
          ui.card({
            title: target.title,
            subtitle: categoryLabel(target.category),
            badge: STATUS[target.status],
            children: [
              ui.text(target.description || 'Brak opisu.'),
              ...(target.photo
                ? [ui.image(target.photo, `Zdjęcie: ${target.title}`)]
                : []),
            ],
          }),
          ui.button(
            'Tak, dołącz moje zgłoszenie',
            ui.tool('merge', { target: target.id, draft: params.draft }),
          ),
          ui.button(
            'Nie, to inny problem',
            ui.tool('report', { ...draft, force: true }),
            'quiet',
          ),
        ]);
      },

      detail: async (ctx, params) => {
        const issue = params.id ? await ctx.db.issues.get(params.id) : null;
        if (!issue)
          return ui.screen('Nie znaleziono', [
            ui.empty('To zgłoszenie nie istnieje.'),
          ]);
        const reports = await ctx.db.reports.findMany({
          where: { issue: issue.id },
          orderBy: { createdAt: 'asc' },
          with: { author: true },
        });
        const mine = reports.some((r) => r.author.id === ctx.user.id);
        const status = STATUS[issue.status];
        return ui.screen(issue.title, [
          ui.row([
            ui.badge(status.text, status.tone),
            ui.badge(categoryLabel(issue.category)),
          ]),
          ui.text(issue.description || 'Brak opisu.'),
          ...(issue.location
            ? issuePlace(issue.id, issue.title, issue.location, status.tone)
            : []),
          ...(issue.photo
            ? [ui.image(issue.photo, `Zdjęcie: ${issue.title}`)]
            : []),
          ui.stat('Poparcie', supporters(reports.length)),
          mine
            ? ui.badge('Zgłaszasz ten problem', 'success')
            : ui.button(
                'Ja też to widzę',
                ui.tool('support', { id: issue.id }),
              ),
          ...(ctx.user.role === 'admin'
            ? [
                ui.row([
                  ui.button(
                    'Przyjmij',
                    ui.tool('setStatus', { id: issue.id, status: 'accepted' }),
                    'quiet',
                  ),
                  ui.button(
                    'Oznacz jako naprawione',
                    ui.tool('setStatus', { id: issue.id, status: 'fixed' }),
                    'quiet',
                  ),
                ]),
              ]
            : []),
          ui.heading(`Zgłoszenia użytkowników (${reports.length})`, 3),
          ui.list(
            'Zgłoszenia użytkowników',
            reports.map((r) =>
              ui.card({
                title: reporterName(ctx.user, r),
                ...(r.description ? { subtitle: r.description } : {}),
                ...(r.photo
                  ? {
                      children: [
                        ui.image(r.photo, `Zdjęcie od: ${r.author.name}`),
                      ],
                    }
                  : {}),
              }),
            ),
          ),
          ui.button('Wróć do listy', ui.navigate('list'), 'quiet'),
        ]);
      },
    },

    dashboardWidgets: {
      /**
       * The open issue most residents support, with its photo; the header counts open and accepted issues. Tapping the
       * tile opens the full list, "Zgłoś problem" and "Sugestia" open the form.
       */
      summary: {
        size: { w: 2, h: 3 },
        render: async (ctx) => {
          const open = await ctx.db.issues.findMany({
            where: { status: { ne: 'fixed' } },
            limit: 1000,
          });
          const support = await supportOf(
            ctx,
            open.map((i) => i.id),
          );
          // A stable sort: equal support keeps the default order, newest first.
          const [top] = [...open].sort((a, b) => support(b.id) - support(a.id));
          const count = (status: keyof typeof STATUS) =>
            open.filter((i) => i.status === status).length;
          const reported = count('open');
          const accepted = count('accepted');
          return ui.widget(
            'Zgłoszenia i sugestie',
            [
              top
                ? ui.highlight({
                    eyebrow: 'Najczęściej podbijane',
                    title: top.title,
                    votes: support(top.id),
                    ...(top.photo
                      ? {
                          image: {
                            file: top.photo,
                            alt: `Zdjęcie: ${top.title}`,
                          },
                        }
                      : {}),
                    onPress: ui.navigate('detail', { id: top.id }),
                  })
                : ui.empty('Nie ma otwartych zgłoszeń.'),
              ui.row(
                [
                  ui.button(
                    'Zgłoś problem',
                    ui.navigate('new'),
                    'primary',
                    'camera',
                  ),
                  ui.button(
                    'Sugestia',
                    ui.navigate('new', { kind: 'suggestion' }),
                    'quiet',
                    'idea',
                  ),
                ],
                { grow: true },
              ),
            ],
            {
              icon: 'megaphone',
              subtitle: `${reported} ${plural(reported, 'otwarte', 'otwarte', 'otwartych')} · ${accepted} w realizacji`,
              link: { label: 'Wszystkie', action: ui.navigate('list') },
              onPress: ui.navigate('list'),
            },
          );
        },
      },
    },

    tools: {
      report: {
        description:
          'Zgłoś usterkę w społeczności (opcjonalnie ze zdjęciem i miejscem: lat, lng, adres). Jeśli AI znajdzie ten sam problem, pyta o połączenie.',
        input: draftSchema.extend({ force: z.boolean().default(false) }),
        handler: async (ctx, { force, ...draft }) => {
          const open = force
            ? []
            : await ctx.db.issues.findMany({
                where: { status: { ne: 'fixed' } },
                limit: 50,
              });
          const [match] = await ctx.ai.findSimilar(
            { text: describe(draft), image: draft.photo ?? null },
            open,
            {
              text: describe,
              image: (i) => i.photo,
              limit: 1,
            },
          );
          if (match) {
            return {
              navigate: ui.navigate('merge', {
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
            kind: draft.kind,
            anonymous: draft.anonymous,
            photo: draft.photo ?? null,
            location: draft.location ?? null,
            reporter: ctx.user.id,
          });
          await addReport(ctx, issue.id, draft);
          return {
            navigate: ui.navigate('sent', { id: issue.id }),
            data: { id: issue.id },
          };
        },
      },

      merge: {
        description:
          'Dołącz zgłoszenie mieszkańca (opis, zdjęcie) do istniejącego zgłoszenia tego samego problemu.',
        input: z.object({ target: z.string().min(1), draft: z.string() }),
        handler: async (ctx, { target, draft }) => {
          const parsed = parseDraft(draft);
          const issue = await ctx.db.issues.get(target);
          if (!issue || !parsed)
            return { error: 'To zgłoszenie już nie istnieje.' };
          await addReport(ctx, target, parsed);
          return {
            toast: 'Dołączyliśmy Twoje zgłoszenie. Dzięki!',
            navigate: ui.navigate('detail', { id: target }),
            data: { id: target },
          };
        },
      },

      support: {
        description:
          'Potwierdź, że widzisz ten sam problem (bez opisu i zdjęcia).',
        input: z.object({ id: z.string().min(1) }),
        handler: async (ctx, { id }) => {
          if (!(await ctx.db.issues.get(id)))
            return { error: 'To zgłoszenie już nie istnieje.' };
          const already = await ctx.db.reports.count({
            where: { issue: id, author: ctx.user.id },
          });
          if (!already)
            await ctx.db.reports.insert({ issue: id, author: ctx.user.id });
          return { toast: 'Dzięki za potwierdzenie!', refresh: true };
        },
      },

      setStatus: {
        description:
          'Zmień status zgłoszenia (tylko administrator społeczności).',
        input: z.object({
          id: z.string().min(1),
          status: z.enum(['open', 'accepted', 'fixed']),
        }),
        requires: 'admin',
        handler: async (ctx, { id, status }) => {
          const updated = await ctx.db.issues.update(id, { status });
          if (!updated) return { error: 'To zgłoszenie już nie istnieje.' };
          return { toast: `Status: ${STATUS[status].text}`, refresh: true };
        },
      },

      list: {
        description:
          'Lista otwartych zgłoszeń w społeczności (dla asystentów AI).',
        input: z.object({}),
        readOnly: true,
        handler: async (ctx) => {
          const open = await ctx.db.issues.findMany({
            where: { status: { ne: 'fixed' } },
          });
          return {
            data: open.map((i) => ({
              id: i.id,
              title: i.title,
              category: i.category,
              status: i.status,
            })),
          };
        },
      },
    },
  });
};

export default issues;
