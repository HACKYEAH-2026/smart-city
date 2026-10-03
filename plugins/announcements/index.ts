import type { Context, PluginModule } from '@app/plugin-sdk';

/**
 * Announcements from the community admins (e.g. the city office or the housing estate board) to residents.
 * - Admins publish and remove announcements; everyone reads them.
 * - Dashboard widget: what is new since the resident last opened announcements (`ctx.lastVisit`).
 * The module imports nothing at runtime (only `import type`) — the host provides the SDK.
 */
const announcements: PluginModule = ({ definePlugin, ui, z, t }) => {
  const tables = {
    announcements: t.table(
      {
        title: t.text(),
        body: t.text().default(''),
        author: t.ref('user').optional(),
      },
      { indexes: [['createdAt']] },
    ),
  };
  type Ctx = Context<typeof tables>;

  const id = z.string().min(1);
  const isAdmin = (ctx: Ctx) => ctx.user.role === 'admin';

  /** "1 nowe ogłoszenie", "3 nowe ogłoszenia", "5 nowych ogłoszeń" (Polish plural forms). */
  const newCount = (n: number) => {
    const few = n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14);
    const noun =
      n === 1 ? 'nowe ogłoszenie' : few ? 'nowe ogłoszenia' : 'nowych ogłoszeń';
    return `${n} ${noun} od Twojej ostatniej wizyty`;
  };

  const publishForm = () =>
    ui.form({
      submitLabel: 'Opublikuj ogłoszenie',
      submit: ui.tool('publish'),
      children: [
        ui.textInput({ name: 'title', label: 'Tytuł' }),
        ui.textInput({ name: 'body', label: 'Treść', multiline: true }),
      ],
    });

  return definePlugin({
    id: 'announcements',
    name: 'Ogłoszenia',
    version: '1.1.0',
    icon: '📢',
    description:
      'Ogłoszenia administratorów dla użytkowników, z podglądem nowości na pulpicie.',
    permissions: ['db'],
    nav: [{ view: 'list', label: 'Ogłoszenia' }],
    tables,

    views: {
      list: async (ctx) => {
        const items = await ctx.db.announcements.findMany({
          orderBy: { createdAt: 'desc' },
        });
        return ui.screen('Ogłoszenia', [
          ...(isAdmin(ctx) ? [publishForm()] : []),
          ui.list(
            'Lista ogłoszeń',
            items.length
              ? items.map((a) =>
                  ui.card({
                    title: a.title,
                    onPress: ui.navigate('item', { id: a.id }),
                  }),
                )
              : [ui.empty('Nie ma jeszcze ogłoszeń.')],
          ),
        ]);
      },
      item: async (ctx, params) => {
        const item = params.id
          ? await ctx.db.announcements.get(params.id)
          : null;
        if (!item)
          return ui.screen('Nie znaleziono', [
            ui.empty('To ogłoszenie nie istnieje.'),
          ]);
        return ui.screen(item.title, [
          ui.text(item.body || 'Brak treści.'),
          ...(isAdmin(ctx)
            ? [
                ui.button(
                  'Usuń ogłoszenie',
                  ui.tool('remove', { id: item.id }),
                  'danger',
                ),
              ]
            : []),
          ui.button('Wszystkie ogłoszenia', ui.navigate('list'), 'quiet'),
        ]);
      },
    },

    dashboardWidgets: {
      latest: {
        size: { w: 2, h: 3 },
        render: async (ctx) => {
          if (!(await ctx.db.announcements.count())) return null;
          const since = ctx.lastVisit
            ? { createdAt: { gt: ctx.lastVisit } }
            : {};
          const fresh = await ctx.db.announcements.findMany({
            where: since,
            orderBy: { createdAt: 'desc' },
            limit: 2,
          });
          const total = fresh.length
            ? await ctx.db.announcements.count({ where: since })
            : 0;
          return ui.widget(
            'Ogłoszenia',
            [
              ui.text(
                total
                  ? newCount(total)
                  : 'Nic nowego od Twojej ostatniej wizyty.',
                'soft',
              ),
              ...fresh.map((a) =>
                ui.card({
                  title: a.title,
                  onPress: ui.navigate('item', { id: a.id }),
                }),
              ),
              ui.button('Wszystkie ogłoszenia', ui.navigate('list'), 'quiet'),
            ],
            ui.navigate('list'),
          );
        },
      },
    },

    tools: {
      publish: {
        description:
          'Opublikuj ogłoszenie dla użytkowników (tylko administrator).',
        input: z.object({
          title: z
            .string()
            .trim()
            .min(3, 'Tytuł jest za krótki')
            .max(120, 'Tytuł jest za długi'),
          body: z.string().trim().max(5000, 'Treść jest za długa').default(''),
        }),
        requires: 'admin',
        handler: async (ctx, input) => {
          const item = await ctx.db.announcements.insert({
            ...input,
            author: ctx.user.id,
          });
          return {
            toast: 'Ogłoszenie opublikowane.',
            refresh: true,
            data: { id: item.id },
          };
        },
      },
      remove: {
        description: 'Usuń ogłoszenie (tylko administrator).',
        input: z.object({ id }),
        requires: 'admin',
        handler: async (ctx, input) => {
          if (!(await ctx.db.announcements.delete(input.id)))
            return { error: 'To ogłoszenie nie istnieje.' };
          return {
            toast: 'Ogłoszenie usunięte.',
            navigate: ui.navigate('list'),
          };
        },
      },
      listAnnouncements: {
        description: 'Lista ogłoszeń, najnowsze najpierw (dla asystentów AI).',
        input: z.object({}),
        readOnly: true,
        handler: async (ctx) => {
          const items = await ctx.db.announcements.findMany({
            orderBy: { createdAt: 'desc' },
          });
          return {
            data: items.map((a) => ({
              id: a.id,
              title: a.title,
              body: a.body,
              createdAt: a.createdAt,
            })),
          };
        },
      },
    },
  });
};

export default announcements;
