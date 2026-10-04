import type { CardTag, Context, FileId, GeoLocation, MetaItem, PluginModule, ScreenAction } from "@app/plugin-sdk";

/**
 * "Uwaga, dzik!": residents warn each other about wild boars.
 * - A resident reports a sighting: the place on the map (required), up to 3 photos, a short note, "z młodymi".
 * - Residents within 500 m of the place get a danger notification. The host matches their saved places and shared
 *   positions, so the plugin never learns where anyone is; the reporter does not get their own alert.
 * - A map and a list of the last week's sightings, a sighting with its alert zone, and a dashboard widget with the
 *   sightings of the last 24 hours.
 * Sightings never show who reported them: a name next to a place and a time would tell everyone where that person was.
 * The module imports nothing at runtime (only `import type`) — the host provides the SDK.
 */

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;
/** The widget and the red pins: sightings of the last day. */
const FRESH_MS = DAY_MS;
/** The main view's map and list: sightings of the last week. */
const RECENT_MS = 7 * DAY_MS;
/**
 * One report per resident in this window: it blunts one person sending alert after alert on purpose (the app already
 * blocks double submits of a form).
 */
const REPORT_INTERVAL_MS = 90 * 1000;
const ALERT_RADIUS_M = 500;
const PHOTOS_MAX = 3;
const NOTE_MAX = 280;
const RECENT_MAX = 100;

const TITLE = "Uwaga, dzik!";
const PHOTO_ALT = "Zdjęcie dzika";
const NO_ADDRESS = "Miejsce zaznaczone na mapie";
const SAFETY = "Nie podchodź i nie karm dzika. Weź psa na smycz i omiń to miejsce.";
const SAFETY_YOUNG = "Locha broni młodych: trzymaj się z daleka.";

const WARSAW = "Europe/Warsaw";
/** "4 paź, 18:40" (built from parts: ICU versions join a date and a time differently). */
const formatDateTime = (d: Date) =>
  `${new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short", timeZone: WARSAW }).format(d)}, ${new Intl.DateTimeFormat("pl-PL", { hour: "2-digit", minute: "2-digit", timeZone: WARSAW }).format(d)}`;

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);
const sentence = (text: string) => (/[.!?…]$/.test(text) ? text : `${text}.`);
/** A resident's note opens its sentence in a push; an address keeps its case ("al. Krasińskiego"). */
const capitalised = (text: string) => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

const boars: PluginModule = ({ definePlugin, ui, z, fileRef, geoLocation, t }) => {
  const tables = {
    sightings: t.table(
      {
        /** Where the boar was seen (picked on the app's map), with its address. */
        location: t.json<GeoLocation>(),
        note: t.text().default(""),
        withYoung: t.boolean().default(false),
        reporter: t.ref("user"),
      },
      { indexes: [["createdAt"], ["reporter", "createdAt"]] },
    ),
    photos: t.table(
      { sighting: t.ref("sightings"), file: t.ref("file"), position: t.integer().default(0) },
      { indexes: [["sighting", "position"]], unique: [["sighting", "file"]] },
    ),
  };
  type Ctx = Context<typeof tables>;
  type Sighting = Awaited<ReturnType<Ctx["db"]["sightings"]["insert"]>>;

  /** A place is required; without one the form gets a message for the field instead of Zod's generic one. */
  const placeSchema = geoLocation()
    .optional()
    .transform((place, check) => {
      if (place) return place;
      check.addIssue({ code: "custom", message: "Zaznacz na mapie, gdzie jest dzik." });
      return z.NEVER;
    });
  const reportSchema = z.object({
    location: placeSchema,
    withYoung: z.boolean().default(false),
    note: z.string().trim().max(NOTE_MAX, `Notatka może mieć najwyżej ${NOTE_MAX} znaków.`).default(""),
    photos: z.array(fileRef()).max(PHOTOS_MAX, `Dodaj najwyżej ${PHOTOS_MAX} zdjęcia.`).default([]),
  });

  const ago = (ctx: Ctx, ms: number) => new Date(ctx.now().getTime() - ms);
  const isFresh = (ctx: Ctx, sighting: Sighting) => sighting.createdAt > ago(ctx, FRESH_MS);
  const placeOf = (sighting: Sighting) => sighting.location.address || NO_ADDRESS;
  const titleOf = (sighting: Sighting) => (sighting.withYoung ? "Dzik z młodymi" : "Dzik w okolicy");
  const safetyOf = (sighting: Sighting) => (sighting.withYoung ? `${SAFETY} ${SAFETY_YOUNG}` : SAFETY);
  const pointOf = (sighting: Sighting) => ({ lat: sighting.location.lat, lng: sighting.location.lng });
  const open = (sighting: Sighting) => ui.navigate("sighting", { id: sighting.id });
  const canRemove = (ctx: Ctx, sighting: Sighting) => sighting.reporter === ctx.user.id || ctx.user.role === "admin";
  /** The header's "Usuń" for the author and admins. The catalog has no bin icon: a pill with the label alone. */
  const removeActions = (ctx: Ctx, sighting: Sighting): { actions?: ScreenAction[] } =>
    canRemove(ctx, sighting)
      ? {
          actions: [
            {
              label: "Usuń",
              action: ui.tool("remove", { id: sighting.id }),
              confirm: {
                title: "Usunąć zgłoszenie?",
                message: "Zniknie z mapy i listy. Wysłanego ostrzeżenia nie da się cofnąć.",
                confirmLabel: "Usuń",
              },
            },
          ],
        }
      : {};

  const sightingsSince = (ctx: Ctx, ms: number, limit: number) =>
    ctx.db.sightings.findMany({ where: { createdAt: { gt: ago(ctx, ms) } }, orderBy: { createdAt: "desc" }, limit });

  /** The photos of each sighting, in the order they were added. */
  const photosOf = async (ctx: Ctx, list: Sighting[]) => {
    const rows = list.length
      ? await ctx.db.photos.findMany({
          where: { sighting: { in: list.map((s) => s.id) } },
          orderBy: { position: "asc" },
          limit: 1000,
        })
      : [];
    return (sighting: Sighting): FileId[] => rows.filter((p) => p.sighting === sighting.id).map((p) => p.file);
  };

  /** The file is an upload of this installation by the acting user (a row may reference any kept file). */
  const isOwnPhoto = async (ctx: Ctx, file: FileId) => {
    const info = await ctx.files.info(file).catch(() => null);
    return info?.uploadedBy === ctx.user.id;
  };
  const photosError = async (ctx: Ctx, photos: FileId[]) => {
    const own = await Promise.all(photos.map((file) => isOwnPhoto(ctx, file)));
    return own.every(Boolean) ? null : "Nie można dodać tego zdjęcia. Dodaj je jeszcze raz.";
  };
  const reportedJustNow = async (ctx: Ctx) =>
    (await ctx.db.sightings.count({
      where: { reporter: ctx.user.id, createdAt: { gt: ago(ctx, REPORT_INTERVAL_MS) } },
    })) > 0;

  /** One at a time: parallel inserts into one table can hit a write conflict. */
  const addPhotos = async (ctx: Ctx, sighting: Sighting, photos: FileId[]) => {
    for (const [position, file] of [...new Set(photos)].entries()) {
      await ctx.db.photos.insert({ sighting: sighting.id, file, position });
    }
  };

  /** Residents near the place hear about it at once; the host leaves the reporter out. */
  const warnNeighbours = (ctx: Ctx, sighting: Sighting) =>
    ctx.notify({
      to: { near: { ...pointOf(sighting), radius: ALERT_RADIUS_M } },
      tone: "danger",
      title: sighting.withYoung ? "Dzik z młodymi w pobliżu" : "Dzik w pobliżu",
      // Only a real address: "Miejsce zaznaczone na mapie" says nothing in a push.
      body: clip(
        [sighting.location.address, capitalised(sighting.note), safetyOf(sighting)]
          .filter(Boolean)
          .map(sentence)
          .join(" "),
        500,
      ),
      open: open(sighting),
    });

  const thumbnail = (photos: FileId[]) => {
    const [first, ...rest] = photos;
    return first ? { image: { file: first, alt: PHOTO_ALT, ...(rest.length ? { more: rest.length } : {}) } } : {};
  };
  const youngTag = (sighting: Sighting): CardTag[] =>
    sighting.withYoung ? [{ text: "Z młodymi", tone: "danger", dot: true }] : [];
  const when = (sighting: Sighting): MetaItem => ({ at: sighting.createdAt.toISOString() });

  /** A sighting on the main list: the place, the note, when, "z młodymi" and the first photo. */
  const listCard = (sighting: Sighting, photos: FileId[]) =>
    ui.card({
      title: placeOf(sighting),
      ...(sighting.note ? { subtitle: clip(sighting.note, 120) } : {}),
      ...thumbnail(photos),
      ...(sighting.withYoung ? { tags: youngTag(sighting) } : {}),
      meta: [when(sighting)],
      onPress: open(sighting),
    });

  /** The last day's sightings in red, older ones in amber: what matters now stands out on the map. */
  const sightingsMap = (ctx: Ctx, list: Sighting[]) => {
    const pin = (sighting: Sighting) => ({
      id: sighting.id,
      at: pointOf(sighting),
      title: titleOf(sighting),
      subtitle: `${placeOf(sighting)} · ${formatDateTime(sighting.createdAt)}`,
      onPress: open(sighting),
    });
    const layers = [
      ui.map.pins("Ostatnia doba", list.filter((s) => isFresh(ctx, s)).map(pin), "danger"),
      ui.map.pins("Wcześniej", list.filter((s) => !isFresh(ctx, s)).map(pin), "warning"),
    ];
    // An empty layer would still get a line in the map's legend.
    return ui.map({ label: "Mapa zgłoszeń dzików", layers: layers.filter((layer) => layer.items.length) });
  };

  const notFound = () =>
    ui.screen("Nie znaleziono", [ui.empty("To zgłoszenie nie istnieje.", { icon: "info" })], {
      back: ui.navigate("list"),
    });

  return definePlugin({
    id: "boars",
    name: TITLE,
    version: "1.0.0",
    icon: "🐗",
    description:
      "Mieszkańcy zgłaszają dzika ze zdjęciem i miejscem na mapie, a sąsiedzi w promieniu 500 m od razu dostają ostrzeżenie.",
    permissions: ["db", "files", "notify"],
    nav: [{ view: "list", label: TITLE }],
    tables,

    views: {
      /** The last week's sightings on a map and in a list, newest first. */
      list: async (ctx) => {
        const sightings = await sightingsSince(ctx, RECENT_MS, RECENT_MAX);
        const photos = await photosOf(ctx, sightings);
        return ui.screen(
          TITLE,
          [
            ...(sightings.length ? [sightingsMap(ctx, sightings)] : []),
            ui.notice(SAFETY, { icon: "alert", tone: "danger" }),
            ui.heading("Ostatnie 7 dni", 3),
            sightings.length
              ? ui.list(
                  "Zgłoszenia dzików z ostatnich 7 dni",
                  sightings.map((s) => listCard(s, photos(s))),
                )
              : ui.empty("W ostatnim tygodniu nikt nie zgłosił dzika w okolicy.", {
                  title: "Spokojnie",
                  icon: "check",
                }),
            ui.fab({ label: "Zgłoś dzika", icon: "plus", action: ui.navigate("report") }),
          ],
          { eyebrow: ctx.community.name },
        );
      },

      report: async () =>
        ui.screen(
          "Zgłoś dzika",
          [
            ui.notice(
              `Ostrzeżenie trafi do sąsiadów, którzy mają zapisane miejsce albo udostępnioną pozycję w promieniu ${ALERT_RADIUS_M} m.`,
              {
                icon: "info",
                variant: "plain",
              },
            ),
            ui.form({
              submitLabel: "Ostrzeż sąsiadów",
              submitIcon: "send",
              submit: ui.tool("report"),
              children: [
                ui.locationInput({ name: "location", label: "Gdzie jest dzik?" }),
                ui.switch({
                  name: "withYoung",
                  label: "Z młodymi",
                  hint: "Zaznacz, jeśli widzisz warchlaki",
                  value: false,
                }),
                ui.textInput({
                  name: "note",
                  label: "Notatka",
                  multiline: true,
                  placeholder: "Np. idzie w stronę placu zabaw",
                }),
                ui.imagePicker({ name: "photos", label: "Zdjęcia (z bezpiecznej odległości)", max: PHOTOS_MAX }),
              ],
            }),
          ],
          { eyebrow: TITLE, back: ui.navigate("list") },
        ),

      /** One sighting: photos, when, the note, the place with the 500 m alert zone, what to do. */
      sighting: async (ctx, params) => {
        const sighting = params.id ? await ctx.db.sightings.get(params.id) : null;
        if (!sighting) return notFound();
        const photos = (await photosOf(ctx, [sighting]))(sighting);
        const mine: MetaItem[] = sighting.reporter === ctx.user.id ? [{ text: "Twoje zgłoszenie" }] : [];
        return ui.screen(
          titleOf(sighting),
          [
            ...(photos.length ? [ui.gallery(photos.map((file) => ({ file, alt: PHOTO_ALT })))] : []),
            ...(sighting.withYoung ? [ui.tags(youngTag(sighting))] : []),
            ui.meta([...mine, when(sighting)]),
            ...(sighting.note ? [ui.text(sighting.note)] : []),
            ui.place(placeOf(sighting)),
            ui.map({
              label: "Miejsce i strefa ostrzeżenia",
              layers: [
                ui.map.areas(
                  "Strefa ostrzeżenia",
                  [
                    {
                      id: `${sighting.id}-zone`,
                      title: `${ALERT_RADIUS_M} m od miejsca`,
                      center: pointOf(sighting),
                      radius: ALERT_RADIUS_M,
                    },
                  ],
                  "danger",
                ),
                ui.map.pins(
                  "Dzik",
                  [{ id: sighting.id, at: pointOf(sighting), title: titleOf(sighting), subtitle: placeOf(sighting) }],
                  "danger",
                ),
              ],
            }),
            ui.notice(safetyOf(sighting), { icon: "alert", tone: "danger" }),
            ui.share("Udostępnij sąsiadom", `/app/c/${ctx.community.slug}/boars/sighting?id=${sighting.id}`, {
              variant: "button",
            }),
          ],
          { eyebrow: TITLE, back: ui.navigate("list"), ...removeActions(ctx, sighting) },
        );
      },
    },

    dashboardWidgets: {
      /** The latest sightings of the last 24 hours (2 rows at 3×2, 4 at 3×3) and "Zgłoś dzika"; calm when none. */
      latest: {
        title: TITLE,
        size: { w: 3, h: 2 },
        sizes: [{ w: 3, h: 3 }],
        render: async (ctx, frame) => {
          const rows = frame.size.h >= 3 ? 4 : 2;
          const fresh = await sightingsSince(ctx, FRESH_MS, rows);
          const total = fresh.length
            ? await ctx.db.sightings.count({ where: { createdAt: { gt: ago(ctx, FRESH_MS) } } })
            : 0;
          const row = (sighting: Sighting) =>
            ui.card({
              title: placeOf(sighting),
              meta: [when(sighting)],
              badge: { text: sighting.withYoung ? "Z młodymi" : "Dzik", tone: "danger" },
              onPress: open(sighting),
            });
          return ui.widget(
            TITLE,
            [
              fresh.length
                ? ui.list("Dziki zgłoszone w ciągu doby", fresh.map(row))
                : ui.empty("Nikt nie zgłosił dzika w ciągu ostatniej doby.", { title: "Spokojnie" }),
              ui.button("Zgłoś dzika", ui.navigate("report"), "ink", "alert"),
            ],
            {
              icon: "alert",
              onPress: ui.navigate("list"),
              ...(total ? { link: { label: "w ciągu doby", count: total, action: ui.navigate("list") } } : {}),
            },
          );
        },
      },
    },

    tools: {
      report: {
        description:
          "Zgłoś dzika: miejsce na mapie (lat, lng, adres), opcjonalnie zdjęcia, notatka i czy są młode. Ostrzega mieszkańców w promieniu 500 m.",
        input: reportSchema,
        handler: async (ctx, input) => {
          if (await reportedJustNow(ctx))
            return { error: "Twoje ostrzeżenie zostało już wysłane. Następne możesz wysłać za chwilę." };
          const error = await photosError(ctx, input.photos);
          if (error) return { error };
          const sighting = await ctx.db.sightings.insert({
            location: input.location,
            note: input.note,
            withYoung: input.withYoung,
            reporter: ctx.user.id,
          });
          await addPhotos(ctx, sighting, input.photos);
          await warnNeighbours(ctx, sighting);
          return {
            toast: `Zgłoszenie zapisane. Ostrzeżenie wysłane w promieniu ${ALERT_RADIUS_M} m.`,
            navigate: ui.navigate("sighting", { id: sighting.id }, { replace: true }),
            data: { id: sighting.id },
          };
        },
      },

      /** The author or an admin removes a sighting (e.g. a false alarm); its photos go with it (required ref). */
      remove: {
        description: "Usuń zgłoszenie dzika (autor albo administrator).",
        input: z.object({ id: z.string().min(1) }),
        handler: async (ctx, input) => {
          const sighting = await ctx.db.sightings.get(input.id);
          if (!sighting) return { error: "To zgłoszenie już nie istnieje." };
          if (!canRemove(ctx, sighting)) return { error: "Możesz usunąć tylko swoje zgłoszenie." };
          await ctx.db.sightings.delete(sighting.id);
          return { toast: "Zgłoszenie usunięte.", navigate: ui.navigate("list", undefined, { replace: true }) };
        },
      },

      recent: {
        description: "Dziki zgłoszone w ciągu ostatniej doby, najnowsze najpierw (dla asystentów AI).",
        input: z.object({}),
        readOnly: true,
        handler: async (ctx) => {
          const fresh = await sightingsSince(ctx, FRESH_MS, RECENT_MAX);
          return {
            data: fresh.map((s) => ({
              id: s.id,
              place: placeOf(s),
              lat: s.location.lat,
              lng: s.location.lng,
              withYoung: s.withYoung,
              note: s.note,
              createdAt: s.createdAt.toISOString(),
            })),
          };
        },
      },
    },
  });
};

export default boars;
