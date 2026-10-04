import type { Context, PluginModule } from "@app/plugin-sdk";

/**
 * Neighbourhood marketplace: "wymienię, oddam, przyjmę, sprzedam, kupię".
 * - Anyone posts a listing tagged with its kind (sell, buy, exchange, give away, take), optionally with a price
 *   (free text, e.g. "50 zł", "do negocjacji") and a photo. No payments here: the deal happens outside the app.
 * - Anyone can open a private chat with the author; the author sees all conversations about their listing.
 * - The author marks a listing as reserved or closed (optionally for/with a specific person from a chat),
 *   brings it back to active, or removes it. Closed listings drop off the public list.
 * - Moderation: residents flag listings; admins see the flagged list, remove listings or dismiss flags,
 *   and can change the status of any listing.
 * The module imports nothing at runtime (only `import type`); the host provides the SDK.
 */
const KIND_VALUES = ["sell", "buy", "exchange", "give", "take"] as const;
type Kind = (typeof KIND_VALUES)[number];
const KINDS = [
  { value: "sell", label: "Sprzedam", tone: "info" },
  { value: "buy", label: "Kupię", tone: "warning" },
  { value: "exchange", label: "Wymienię", tone: "neutral" },
  { value: "give", label: "Oddam", tone: "success" },
  { value: "take", label: "Przyjmę", tone: "neutral" },
] as const;
const STATUS = {
  active: { text: "Aktywne", tone: "success" },
  reserved: { text: "Zarezerwowane", tone: "warning" },
  closed: { text: "Zakończone", tone: "neutral" },
} as const;
type Status = keyof typeof STATUS;

const kindOf = (v: string) => KINDS.find((k) => k.value === v) ?? KINDS[0];
const kindBadge = (v: string) => ({ text: kindOf(v).label, tone: kindOf(v).tone });

const NOT_FOUND = "To ogłoszenie nie istnieje.";
const NO_ACCESS = "Nie masz dostępu do tej rozmowy.";
const CLOSED = "To ogłoszenie jest już zakończone.";
const PAYMENT_NOTE = "Płatność i przekazanie odbywają się poza aplikacją. Umówcie się na czacie.";

const market: PluginModule = ({ definePlugin, ui, z, fileRef, t }) => {
  const tables = {
    listings: t.table(
      {
        kind: t.enum(KIND_VALUES),
        title: t.text(),
        description: t.text().default(""),
        /** Free text, e.g. "50 zł", "do negocjacji"; empty = no price. */
        price: t.text().default(""),
        photo: t.ref("file").optional(),
        author: t.ref("user"),
        status: t.enum(["active", "reserved", "closed"]).default("active"),
        /** Who it is reserved for / who the deal was closed with (set from a conversation). */
        partner: t.ref("user").optional(),
      },
      { indexes: [["status", "createdAt"], ["kind", "status"], ["author"]] },
    ),
    /** One private conversation per (listing, interested person). */
    conversations: t.table(
      { listing: t.ref("listings"), buyer: t.ref("user"), lastMessageAt: t.timestamp() },
      { unique: [["listing", "buyer"]], indexes: [["buyer", "lastMessageAt"]] },
    ),
    messages: t.table(
      { conversation: t.ref("conversations"), author: t.ref("user"), text: t.text() },
      { indexes: [["conversation", "createdAt"]] },
    ),
    /** Residents' flags for moderators; one per person per listing. */
    flags: t.table(
      { listing: t.ref("listings"), author: t.ref("user"), reason: t.text().default("") },
      { unique: [["listing", "author"]] },
    ),
  };
  type Ctx = Context<typeof tables>;

  const id = z.string().min(1);
  const text = z.string().trim().min(1, "Wiadomość nie może być pusta").max(2000, "Wiadomość jest za długa");
  const isAdmin = (ctx: Ctx) => ctx.user.role === "admin";
  const canManage = (ctx: Ctx, authorId: string) => authorId === ctx.user.id || isAdmin(ctx);

  const myConversation = async (ctx: Ctx, listing: string) =>
    (await ctx.db.conversations.findMany({ where: { listing, buyer: ctx.user.id }, limit: 1 }))[0] ?? null;
  const loadConversation = async (ctx: Ctx, conversationId: string) => {
    const conversation = await ctx.db.conversations.get(conversationId);
    const listing = conversation ? await ctx.db.listings.get(conversation.listing) : null;
    if (!conversation || !listing) return null;
    if (conversation.buyer !== ctx.user.id && listing.author !== ctx.user.id) return null;
    return { conversation, listing };
  };

  const listingCard = (l: { id: string; kind: string; title: string; price: string; status: Status }, by?: string) =>
    ui.card({
      title: l.title,
      subtitle: [l.price, l.status === "reserved" ? "Zarezerwowane" : "", by].filter(Boolean).join(" · "),
      badge: kindBadge(l.kind),
      onPress: ui.navigate("listing", { id: l.id }),
    });

  const noAccess = (message: string) =>
    ui.screen("Brak dostępu", [ui.empty(message), ui.button("Wszystkie ogłoszenia", ui.navigate("list"), "quiet")]);

  return definePlugin({
    id: "market",
    name: "Giełda sąsiedzka",
    version: "1.0.0",
    icon: "🏷️",
    description: "Wymienię, oddam, przyjmę, sprzedam, kupię: ogłoszenia mieszkańców z czatem z autorem.",
    permissions: ["db", "files"],
    nav: [
      { view: "list", label: "Giełda" },
      { view: "chats", label: "Moje rozmowy" },
    ],
    tables,

    views: {
      list: async (ctx, params) => {
        const kind = KIND_VALUES.find((k) => k === params.kind);
        const items = await ctx.db.listings.findMany({
          where: { status: { in: ["active", "reserved"] }, ...(kind ? { kind } : {}) },
          orderBy: { createdAt: "desc" },
          with: { author: true },
        });
        const flagged = isAdmin(ctx) ? await ctx.db.flags.count() : 0;
        return ui.screen("Giełda sąsiedzka", [
          ui.row([
            ui.button("Dodaj ogłoszenie", ui.navigate("new")),
            ui.button("Moje ogłoszenia", ui.navigate("mine"), "quiet"),
            ...(isAdmin(ctx) ? [ui.button(`Moderacja (${flagged})`, ui.navigate("moderation"), "quiet")] : []),
          ]),
          ui.row([
            ui.button("Wszystkie", ui.navigate("list"), kind ? "quiet" : undefined),
            ...KINDS.map((k) =>
              ui.button(k.label, ui.navigate("list", { kind: k.value }), kind === k.value ? undefined : "quiet"),
            ),
          ]),
          ui.list(
            "Ogłoszenia",
            items.length
              ? items.map((l) => listingCard(l, l.author.name))
              : [ui.empty(kind ? "Brak ogłoszeń w tej kategorii." : "Nie ma jeszcze ogłoszeń.")],
          ),
        ]);
      },

      new: () =>
        ui.screen("Nowe ogłoszenie", [
          ui.form({
            submitLabel: "Opublikuj ogłoszenie",
            submit: ui.tool("createListing"),
            children: [
              ui.select({
                name: "kind",
                label: "Rodzaj",
                options: KINDS.map(({ value, label }) => ({ value, label })),
                value: "sell",
              }),
              ui.textInput({ name: "title", label: "Co oferujesz lub czego szukasz?" }),
              ui.textInput({ name: "description", label: "Opis", multiline: true }),
              ui.textInput({ name: "price", label: "Cena (opcjonalnie, np. 50 zł, do negocjacji)" }),
              ui.imagePicker({ name: "photo", label: "Zdjęcie (opcjonalnie)" }),
            ],
          }),
          ui.text(PAYMENT_NOTE, "soft"),
          ui.button("Wróć do listy", ui.navigate("list"), "quiet"),
        ]),

      listing: async (ctx, params) => {
        const l = params.id ? await ctx.db.listings.get(params.id, { with: { author: true, partner: true } }) : null;
        if (!l) return ui.screen("Nie znaleziono", [ui.empty(NOT_FOUND)]);
        const isAuthor = l.author.id === ctx.user.id;
        const kind = kindBadge(l.kind);
        const status = STATUS[l.status];
        const mine = isAuthor ? null : await myConversation(ctx, l.id);
        const conversations = isAuthor
          ? await ctx.db.conversations.findMany({
              where: { listing: l.id },
              orderBy: { lastMessageAt: "desc" },
              with: { buyer: true },
            })
          : [];
        const flags = isAdmin(ctx) ? await ctx.db.flags.count({ where: { listing: l.id } }) : 0;

        const partnerNote =
          l.status === "active" || !l.partner
            ? []
            : isAuthor
              ? [
                  ui.text(
                    `${l.status === "reserved" ? "Zarezerwowane dla" : "Transakcja z"}: ${l.partner.name}`,
                    "soft",
                  ),
                ]
              : l.partner.id === ctx.user.id
                ? [
                    ui.text(
                      l.status === "reserved" ? "Zarezerwowane dla Ciebie." : "Transakcja zawarta z Tobą.",
                      "soft",
                    ),
                  ]
                : [];

        const authorSection = [
          ui.heading(`Rozmowy (${conversations.length})`, 3),
          ui.list(
            "Rozmowy",
            conversations.length
              ? conversations.map((c) =>
                  ui.card({ title: c.buyer.name, onPress: ui.navigate("conversation", { id: c.id }) }),
                )
              : [ui.empty("Nikt jeszcze nie napisał.")],
          ),
        ];
        const visitorSection = mine
          ? [ui.button("Twoja rozmowa", ui.navigate("conversation", { id: mine.id }))]
          : l.status === "closed"
            ? [ui.text(CLOSED, "soft")]
            : [ui.button("Napisz do autora", ui.tool("startChat", { listing: l.id }))];

        return ui.screen(l.title, [
          ui.row([ui.badge(kind.text, kind.tone), ui.badge(status.text, status.tone)]),
          ...(l.price ? [ui.stat("Cena", l.price)] : []),
          ui.text(l.description || "Brak opisu."),
          ...(l.photo ? [ui.image(l.photo, `Zdjęcie: ${l.title}`)] : []),
          ui.text(`Autor: ${l.author.name}`, "soft"),
          ...partnerNote,
          ui.text(PAYMENT_NOTE, "soft"),
          ...(isAuthor ? authorSection : visitorSection),
          ...(canManage(ctx, l.author.id)
            ? [
                ui.row([
                  ...(l.status !== "active"
                    ? [
                        ui.button(
                          "Przywróć jako aktywne",
                          ui.tool("setStatus", { id: l.id, status: "active" }),
                          "quiet",
                        ),
                      ]
                    : [ui.button("Zarezerwuj", ui.tool("setStatus", { id: l.id, status: "reserved" }), "quiet")]),
                  ...(l.status !== "closed"
                    ? [ui.button("Zakończ", ui.tool("setStatus", { id: l.id, status: "closed" }), "quiet")]
                    : []),
                  ui.button("Usuń ogłoszenie", ui.tool("remove", { id: l.id }), "danger"),
                ]),
              ]
            : []),
          ...(isAdmin(ctx) && flags
            ? [
                ui.text(`Zgłoszenia do moderacji: ${flags}`, "soft"),
                ui.button("Odrzuć zgłoszenia", ui.tool("dismissFlags", { id: l.id }), "quiet"),
              ]
            : []),
          ...(!isAuthor ? [ui.button("Zgłoś do moderacji", ui.tool("flag", { id: l.id }), "quiet")] : []),
          ui.button("Wszystkie ogłoszenia", ui.navigate("list"), "quiet"),
        ]);
      },

      mine: async (ctx) => {
        const items = await ctx.db.listings.findMany({
          where: { author: ctx.user.id },
          orderBy: { createdAt: "desc" },
        });
        return ui.screen("Moje ogłoszenia", [
          ui.list(
            "Moje ogłoszenia",
            items.length
              ? items.map((l) =>
                  ui.card({
                    title: l.title,
                    subtitle: kindOf(l.kind).label,
                    badge: STATUS[l.status],
                    onPress: ui.navigate("listing", { id: l.id }),
                  }),
                )
              : [ui.empty("Nie masz jeszcze ogłoszeń.")],
          ),
          ui.button("Dodaj ogłoszenie", ui.navigate("new")),
          ui.button("Wszystkie ogłoszenia", ui.navigate("list"), "quiet"),
        ]);
      },

      chats: async (ctx) => {
        const asBuyer = await ctx.db.conversations.findMany({
          where: { buyer: ctx.user.id },
          with: { listing: true },
          limit: 200,
        });
        const myListings = await ctx.db.listings.findMany({ where: { author: ctx.user.id }, limit: 1000 });
        const titles = new Map(myListings.map((l) => [l.id, l.title]));
        const asSeller = myListings.length
          ? await ctx.db.conversations.findMany({
              where: { listing: { in: myListings.map((l) => l.id) } },
              with: { buyer: true },
              limit: 200,
            })
          : [];
        const rows = [
          ...asBuyer.map((c) => ({
            id: c.id,
            at: c.lastMessageAt,
            title: c.listing.title,
            who: "Z autorem ogłoszenia",
          })),
          ...asSeller.map((c) => ({
            id: c.id,
            at: c.lastMessageAt,
            title: titles.get(c.listing) ?? "",
            who: `Rozmowa z: ${c.buyer.name}`,
          })),
        ].sort((a, b) => b.at.getTime() - a.at.getTime());
        return ui.screen("Moje rozmowy", [
          ui.list(
            "Moje rozmowy",
            rows.length
              ? rows.map((r) =>
                  ui.card({ title: r.title, subtitle: r.who, onPress: ui.navigate("conversation", { id: r.id }) }),
                )
              : [ui.empty("Nie masz jeszcze rozmów.")],
          ),
          ui.button("Wszystkie ogłoszenia", ui.navigate("list"), "quiet"),
        ]);
      },

      conversation: async (ctx, params) => {
        const c = params.id ? await ctx.db.conversations.get(params.id, { with: { buyer: true } }) : null;
        const l = c ? await ctx.db.listings.get(c.listing, { with: { author: true } }) : null;
        if (!c || !l || (c.buyer.id !== ctx.user.id && l.author.id !== ctx.user.id)) return noAccess(NO_ACCESS);
        const isAuthor = l.author.id === ctx.user.id;
        const forThisBuyer = l.partner === c.buyer.id;
        const status = STATUS[l.status];
        const messages = await ctx.db.messages.findMany({
          where: { conversation: c.id },
          orderBy: { createdAt: "asc" },
          with: { author: true },
        });
        return ui.screen(`Rozmowa: ${l.title}`, [
          ui.text(`Rozmowa z: ${isAuthor ? c.buyer.name : l.author.name}`, "soft"),
          ui.row([ui.badge(kindBadge(l.kind).text, kindBadge(l.kind).tone), ui.badge(status.text, status.tone)]),
          ...(l.price ? [ui.stat("Cena", l.price)] : []),
          ...(!isAuthor && forThisBuyer && l.status !== "active"
            ? [ui.text(l.status === "reserved" ? "Zarezerwowane dla Ciebie." : "Transakcja zawarta z Tobą.", "soft")]
            : []),
          ...(isAuthor && l.status !== "closed"
            ? [
                ui.row([
                  l.status === "reserved" && forThisBuyer
                    ? ui.button("Cofnij rezerwację", ui.tool("setStatus", { id: l.id, status: "active" }), "quiet")
                    : ui.button(
                        `Zarezerwuj dla: ${c.buyer.name}`,
                        ui.tool("setStatus", { id: l.id, status: "reserved", conversation: c.id }),
                        "quiet",
                      ),
                  ui.button(
                    `Zakończ transakcję z: ${c.buyer.name}`,
                    ui.tool("setStatus", { id: l.id, status: "closed", conversation: c.id }),
                  ),
                ]),
              ]
            : []),
          ui.list(
            "Wiadomości",
            messages.length
              ? messages.map((m) => ui.card({ title: m.author.name, subtitle: m.text }))
              : [ui.empty("Nie ma jeszcze wiadomości.")],
          ),
          ui.form({
            submitLabel: "Wyślij",
            submit: ui.tool("sendMessage", { conversation: c.id }),
            children: [ui.textInput({ name: "text", label: "Wiadomość", multiline: true })],
          }),
          ui.text(PAYMENT_NOTE, "soft"),
          ui.button("Zobacz ogłoszenie", ui.navigate("listing", { id: l.id }), "quiet"),
        ]);
      },

      moderation: async (ctx) => {
        if (!isAdmin(ctx)) return noAccess("Moderacja jest dostępna tylko dla administratorów.");
        const flags = await ctx.db.flags.findMany({
          orderBy: { createdAt: "desc" },
          with: { listing: true },
          limit: 1000,
        });
        const byListing = new Map<string, { id: string; title: string; count: number; reasons: string[] }>();
        for (const f of flags) {
          const row = byListing.get(f.listing.id) ?? {
            id: f.listing.id,
            title: f.listing.title,
            count: 0,
            reasons: [],
          };
          row.count += 1;
          if (f.reason) row.reasons.push(f.reason);
          byListing.set(row.id, row);
        }
        const rows = [...byListing.values()].sort((a, b) => b.count - a.count);
        return ui.screen("Moderacja ogłoszeń", [
          ui.list(
            "Zgłoszone ogłoszenia",
            rows.length
              ? rows.map((r) =>
                  ui.card({
                    title: r.title,
                    subtitle: [`Zgłoszenia: ${r.count}`, ...r.reasons].join(" · "),
                    onPress: ui.navigate("listing", { id: r.id }),
                    children: [
                      ui.row([
                        ui.button("Usuń ogłoszenie", ui.tool("remove", { id: r.id }), "danger"),
                        ui.button("Odrzuć zgłoszenia", ui.tool("dismissFlags", { id: r.id }), "quiet"),
                      ]),
                    ],
                  }),
                )
              : [ui.empty("Brak zgłoszonych ogłoszeń.")],
          ),
          ui.button("Wszystkie ogłoszenia", ui.navigate("list"), "quiet"),
        ]);
      },
    },

    dashboardWidgets: {
      latest: {
        size: { w: 3, h: 3 },
        render: async (ctx) => {
          const latest = await ctx.db.listings.findMany({
            where: { status: "active" },
            orderBy: { createdAt: "desc" },
            limit: 3,
          });
          // Always drawn: with nothing listed, an empty state and the way to the market.
          if (!latest.length)
            return ui.widget("Giełda sąsiedzka", [
              ui.empty("Nic jeszcze nie wystawiono."),
              ui.button("Zobacz wszystkie", ui.navigate("list"), "quiet"),
            ]);
          const flagged = isAdmin(ctx) ? await ctx.db.flags.count() : 0;
          return ui.widget("Giełda sąsiedzka", [
            ...(flagged ? [ui.text(`Zgłoszenia do moderacji: ${flagged}`, "soft")] : []),
            ...latest.map((l) => listingCard(l)),
            ui.button("Zobacz wszystkie", ui.navigate("list"), "quiet"),
          ]);
        },
      },
    },

    tools: {
      createListing: {
        description:
          "Dodaj ogłoszenie: sprzedam, kupię, wymienię, oddam albo przyjmę (rzeczy lub usługi), opcjonalnie z ceną i zdjęciem.",
        input: z.object({
          kind: z.enum(KIND_VALUES),
          title: z.string().trim().min(3, "Tytuł jest za krótki").max(120, "Tytuł jest za długi"),
          description: z.string().trim().max(3000, "Opis jest za długi").default(""),
          price: z.string().trim().max(40, "Cena jest za długa").default(""),
          photo: fileRef().optional(),
        }),
        handler: async (ctx, input) => {
          const l = await ctx.db.listings.insert({ ...input, photo: input.photo ?? null, author: ctx.user.id });
          return {
            toast: "Ogłoszenie opublikowane.",
            navigate: ui.navigate("listing", { id: l.id }),
            data: { id: l.id },
          };
        },
      },

      setStatus: {
        description:
          "Oznacz ogłoszenie jako aktywne, zarezerwowane albo zakończone (autor lub administrator); opcjonalnie dla osoby z rozmowy.",
        input: z.object({ id, status: z.enum(["active", "reserved", "closed"]), conversation: id.optional() }),
        handler: async (ctx, input) => {
          const l = await ctx.db.listings.get(input.id);
          if (!l) return { error: NOT_FOUND };
          if (!canManage(ctx, l.author)) return { error: "Możesz zmieniać tylko swoje ogłoszenia." };
          let partner: string | null = null;
          if (input.status !== "active" && input.conversation) {
            const c = await ctx.db.conversations.get(input.conversation);
            if (!c || c.listing !== l.id) return { error: "Ta rozmowa nie dotyczy tego ogłoszenia." };
            partner = c.buyer;
          }
          await ctx.db.listings.update(l.id, { status: input.status, partner });
          const toasts: Record<Status, string> = {
            active: "Ogłoszenie znów jest aktywne.",
            reserved: "Oznaczono jako zarezerwowane.",
            closed: "Ogłoszenie zakończone.",
          };
          return { toast: toasts[input.status], refresh: true, data: { id: l.id } };
        },
      },

      remove: {
        description: "Usuń ogłoszenie razem z rozmowami (autor lub administrator).",
        input: z.object({ id }),
        handler: async (ctx, input) => {
          const l = await ctx.db.listings.get(input.id);
          if (!l) return { error: NOT_FOUND };
          if (!canManage(ctx, l.author)) return { error: "Możesz usuwać tylko swoje ogłoszenia." };
          await ctx.db.listings.delete(l.id);
          return { toast: "Ogłoszenie usunięte.", navigate: ui.navigate("list"), data: { id: l.id } };
        },
      },

      startChat: {
        description: "Napisz do autora ogłoszenia (otwiera prywatną rozmowę).",
        input: z.object({ listing: id }),
        handler: async (ctx, input) => {
          const l = await ctx.db.listings.get(input.listing);
          if (!l) return { error: NOT_FOUND };
          if (l.author === ctx.user.id) return { error: "To Twoje ogłoszenie." };
          let c = await myConversation(ctx, l.id);
          if (!c) {
            if (l.status === "closed") return { error: CLOSED };
            c = await ctx.db.conversations.insert({ listing: l.id, buyer: ctx.user.id, lastMessageAt: ctx.now() });
          }
          return { navigate: ui.navigate("conversation", { id: c.id }), data: { id: c.id } };
        },
      },

      sendMessage: {
        description: "Wyślij wiadomość w rozmowie o ogłoszeniu.",
        input: z.object({ conversation: id, text }),
        handler: async (ctx, input) => {
          if (!(await loadConversation(ctx, input.conversation))) return { error: NO_ACCESS };
          const m = await ctx.db.messages.insert({
            conversation: input.conversation,
            author: ctx.user.id,
            text: input.text,
          });
          await ctx.db.conversations.update(input.conversation, { lastMessageAt: ctx.now() });
          return { refresh: true, data: { id: m.id } };
        },
      },

      flag: {
        description: "Zgłoś ogłoszenie do moderacji (np. niezgodne z zasadami).",
        input: z.object({ id, reason: z.string().trim().max(500).default("") }),
        handler: async (ctx, input) => {
          const l = await ctx.db.listings.get(input.id);
          if (!l) return { error: NOT_FOUND };
          if (l.author === ctx.user.id) return { error: "Nie możesz zgłosić własnego ogłoszenia." };
          await ctx.db.flags.upsert(
            { listing: l.id, author: ctx.user.id, reason: input.reason },
            { on: ["listing", "author"] },
          );
          return { toast: "Dziękujemy, moderator sprawdzi ogłoszenie." };
        },
      },

      dismissFlags: {
        description: "Odrzuć zgłoszenia ogłoszenia, zostawiając je na liście (tylko administrator).",
        input: z.object({ id }),
        requires: "admin",
        handler: async (ctx, input) => {
          const flags = await ctx.db.flags.findMany({ where: { listing: input.id }, limit: 1000 });
          for (const f of flags) await ctx.db.flags.delete(f.id);
          return { toast: "Zgłoszenia odrzucone.", refresh: true, data: { dismissed: flags.length } };
        },
      },

      listListings: {
        description: "Aktualne ogłoszenia (aktywne i zarezerwowane), opcjonalnie jednego rodzaju (dla asystentów AI).",
        input: z.object({ kind: z.enum(KIND_VALUES).optional() }),
        readOnly: true,
        handler: async (ctx, input) => {
          const items = await ctx.db.listings.findMany({
            where: { status: { in: ["active", "reserved"] }, ...(input.kind ? { kind: input.kind as Kind } : {}) },
            orderBy: { createdAt: "desc" },
          });
          return {
            data: items.map((l) => ({
              id: l.id,
              kind: l.kind,
              title: l.title,
              description: l.description,
              price: l.price,
              status: l.status,
              createdAt: l.createdAt,
            })),
          };
        },
      },
    },

    streams: {
      conversation: {
        description: "Rozmowa o ogłoszeniu na żywo: najpierw aktualne wiadomości, potem każda zmiana.",
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

export default market;
