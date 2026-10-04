import type { Context, PluginModule } from "@app/plugin-sdk";

/**
 * Disruptions map: roadworks, closures and other disruptions marked on a map.
 * - Admins mark a section of a road (line) or an area (polygon), and set the name, description, kind
 *   (closure, limited access, inconvenience), start, optional end ("until further notice") and an optional detour.
 * - Everyone sees a map of current (red) and planned (yellow) disruptions, a list, and details.
 * - Admins can end a disruption early ("Zakończ teraz"), edit or delete it.
 * Geometry is stored as GeoJSON (LineString / Polygon, [longitude, latitude]) and validated here.
 * Dates are typed as "RRRR-MM-DD GG:MM" in TIME_ZONE; full ISO with an offset also works (AI tools).
 *
 * MAP ADAPTER: the map is drawn by `mapOf` and edited by `geometryField` below. They assume
 * `ui.map({ label, features })` and `ui.mapInput({ name, label, draw, value })` returning GeoJSON.
 * If the SDK's map component looks different, only these two helpers need to change.
 * The module imports nothing at runtime (only `import type`); the host provides the SDK.
 */
const TIME_ZONE = "Europe/Warsaw";
/** "Until further notice": a far-future sort key, so active disruptions are `activeUntil > now`. */
const FOREVER = new Date("2100-01-01T00:00:00Z");
const MAX_POINTS = 500;
const DAY_MS = 24 * 60 * 60 * 1000;

export const COLORS = { current: "#D32F2F", planned: "#F9A825" } as const;

const KIND_VALUES = ["closure", "limited", "inconvenience"] as const;
type Kind = (typeof KIND_VALUES)[number];
const KINDS: Record<Kind, { label: string; hint: string; tone: "warning" | "info" | "neutral" }> = {
  closure: { label: "Zamknięcie", hint: "droga lub miejsce całkowicie zamknięte", tone: "warning" },
  limited: { label: "Ograniczony dostęp", hint: "np. ruch wahadłowy, dojazd tylko dla mieszkańców", tone: "info" },
  inconvenience: { label: "Utrudnienia", hint: "przejezdne, ale możliwe opóźnienia, hałas, objazdy", tone: "neutral" },
};
const STATUS = {
  current: { text: "Trwa", tone: "warning" },
  planned: { text: "Planowane", tone: "info" },
  ended: { text: "Zakończone", tone: "neutral" },
} as const;
type Status = keyof typeof STATUS;
const SHAPES = { line: "Odcinek drogi", area: "Obszar" } as const;

// ---- Dates in the community time zone (same helpers as the events plugin) ----
const MONTHS_GENITIVE = ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"];
const WEEKDAYS = ["niedziela", "poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota"];
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
/** "od czwartku…" is hard to inflect, so: "od: czwartek, 1 października 2026, 7:00 · do: …" */
const fmtRange = (start: Date, end: Date | null) =>
  `od: ${fmtDay(start)}, ${fmtTime(start)} · do: ${end ? `${fmtDay(end)}, ${fmtTime(end)}` : "odwołania"}`;
const fmtInput = (date: Date) => {
  const p = partsIn(date);
  return `${p.y}-${pad(p.m)}-${pad(p.d)} ${pad(p.h)}:${pad(p.mi)}`;
};

// ---- Geometry (GeoJSON, [longitude, latitude]) ----
type Position = [number, number];
type Geometry = { type: "LineString"; coordinates: Position[] } | { type: "Polygon"; coordinates: Position[][] };
const NO_GEOMETRY = "Zaznacz odcinek drogi albo obszar na mapie";

const toPosition = (p: unknown): Position | null => {
  if (!Array.isArray(p) || p.length < 2) return null;
  const [lng, lat] = p as unknown[];
  if (typeof lng !== "number" || typeof lat !== "number" || !Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) return null;
  return [Math.round(lng * 1e6) / 1e6, Math.round(lat * 1e6) / 1e6];
};
const samePoint = (a: Position, b: Position) => a[0] === b[0] && a[1] === b[1];

/** GeoJSON text, Geometry or Feature → normalized Geometry, or an error message. */
const parseGeometry = (value: unknown): Geometry | string => {
  let v = value;
  if (typeof v === "string") {
    if (!v.trim()) return NO_GEOMETRY;
    try {
      v = JSON.parse(v);
    } catch {
      return NO_GEOMETRY;
    }
  }
  if (!v || typeof v !== "object") return NO_GEOMETRY;
  const obj = v as { type?: unknown; geometry?: unknown; coordinates?: unknown };
  if (obj.type === "Feature") return parseGeometry(obj.geometry);
  if (obj.type === "LineString") {
    const coords = Array.isArray(obj.coordinates) ? obj.coordinates.map(toPosition) : [];
    if (coords.some((c) => !c)) return "Nieprawidłowe współrzędne na mapie";
    const line = coords as Position[];
    if (line.length < 2) return "Odcinek drogi musi mieć co najmniej 2 punkty";
    if (line.length > MAX_POINTS) return "Zbyt wiele punktów na mapie";
    return { type: "LineString", coordinates: line };
  }
  if (obj.type === "Polygon") {
    const outer = Array.isArray(obj.coordinates) ? obj.coordinates[0] : null;
    const coords = Array.isArray(outer) ? outer.map(toPosition) : [];
    if (coords.some((c) => !c)) return "Nieprawidłowe współrzędne na mapie";
    const ring = coords as Position[];
    if (ring.length > 1 && samePoint(ring[0]!, ring[ring.length - 1]!)) ring.pop();
    if (ring.length < 3) return "Obszar musi mieć co najmniej 3 punkty";
    if (ring.length > MAX_POINTS) return "Zbyt wiele punktów na mapie";
    return { type: "Polygon", coordinates: [[...ring, ring[0]!]] };
  }
  return NO_GEOMETRY;
};
const pointsOf = (g: Geometry) => (g.type === "LineString" ? g.coordinates : g.coordinates[0]!);
const centerOf = (g: Geometry) => {
  const pts = pointsOf(g);
  const lngs = pts.map((p) => p[0]);
  const lats = pts.map((p) => p[1]);
  return {
    lng: Math.round(((Math.min(...lngs) + Math.max(...lngs)) / 2) * 1e6) / 1e6,
    lat: Math.round(((Math.min(...lats) + Math.max(...lats)) / 2) * 1e6) / 1e6,
  };
};

const disruptions: PluginModule = ({ definePlugin, ui, z, t }) => {
  const tables = {
    disruptions: t.table(
      {
        title: t.text(),
        description: t.text().default(""),
        detour: t.text().default(""),
        kind: t.enum(KIND_VALUES),
        shape: t.enum(["line", "area"]),
        /** GeoJSON geometry as JSON text. */
        geometry: t.text(),
        startsAt: t.timestamp(),
        endsAt: t.timestamp().optional(),
        /** endsAt, or FOREVER ("until further notice"). */
        activeUntil: t.timestamp(),
      },
      { indexes: [["activeUntil"], ["startsAt"]] },
    ),
  };
  type Ctx = Context<typeof tables>;
  type Row = { id: string; title: string; kind: Kind; shape: "line" | "area"; geometry: string; startsAt: Date; endsAt: Date | null; activeUntil: Date };

  const id = z.string().min(1);
  const dateField = (message: string) =>
    z.string().trim().transform((s, c) => {
      const date = parseWhen(s);
      if (!date) {
        c.addIssue({ code: "custom", message });
        return z.NEVER;
      }
      return date;
    });
  const input = {
    title: z.string().trim().min(3, "Nazwa jest za krótka").max(120, "Nazwa jest za długa"),
    kind: z.enum(KIND_VALUES),
    geometry: z.unknown().transform((v, c) => {
      const g = parseGeometry(v);
      if (typeof g === "string") {
        c.addIssue({ code: "custom", message: g });
        return z.NEVER;
      }
      return g;
    }),
    startsAt: dateField("Podaj początek w formacie RRRR-MM-DD GG:MM"),
    endsAt: z
      .string()
      .trim()
      .optional()
      .transform((s, c) => {
        if (!s) return null;
        const date = parseWhen(s);
        if (!date) {
          c.addIssue({ code: "custom", message: "Podaj koniec w formacie RRRR-MM-DD GG:MM albo zostaw puste" });
          return z.NEVER;
        }
        return date;
      }),
    description: z.string().trim().max(3000, "Opis jest za długi").default(""),
    detour: z.string().trim().max(1000, "Opis objazdu jest za długi").default(""),
  };
  type Input = { title: string; kind: Kind; geometry: Geometry; startsAt: Date; endsAt: Date | null; description: string; detour: string };

  const isAdmin = (ctx: Ctx) => ctx.user.role === "admin";
  const statusOf = (d: Pick<Row, "startsAt" | "activeUntil">, now: Date): Status =>
    d.startsAt.getTime() > now.getTime() ? "planned" : d.activeUntil.getTime() <= now.getTime() ? "ended" : "current";
  const toRow = (i: Input) => ({
    title: i.title,
    kind: i.kind,
    shape: i.geometry.type === "LineString" ? ("line" as const) : ("area" as const),
    geometry: JSON.stringify(i.geometry),
    startsAt: i.startsAt,
    endsAt: i.endsAt,
    activeUntil: i.endsAt ?? FOREVER,
    description: i.description,
    detour: i.detour,
  });
  const checkDates = (i: Input) => (i.endsAt && i.endsAt <= i.startsAt ? "Koniec musi być po rozpoczęciu." : null);

  const current = (ctx: Ctx, now: Date, limit = 200) =>
    ctx.db.disruptions.findMany({
      where: { startsAt: { lte: now }, activeUntil: { gt: now } },
      orderBy: { startsAt: "desc" },
      limit,
    });
  const planned = (ctx: Ctx, now: Date, limit = 200) =>
    ctx.db.disruptions.findMany({ where: { startsAt: { gt: now } }, orderBy: { startsAt: "asc" }, limit });

  // ---- MAP ADAPTER ----
  const mapOf = (label: string, items: Row[], now: Date) =>
    ui.map({
      label,
      features: items.map((d) => ({
        id: d.id,
        geometry: JSON.parse(d.geometry) as Geometry,
        color: statusOf(d, now) === "planned" ? COLORS.planned : COLORS.current,
        title: d.title,
        onPress: ui.navigate("detail", { id: d.id }),
      })),
    });
  const geometryField = (value?: string) =>
    ui.mapInput({
      name: "geometry",
      label: "Zaznacz odcinek drogi (linia) albo obszar (wielokąt)",
      draw: ["line", "polygon"],
      ...(value ? { value: JSON.parse(value) as Geometry } : {}),
    });
  // ---------------------

  const legend = () =>
    ui.row([ui.badge("Czerwony – trwające", "warning"), ui.badge("Żółty – planowane", "info")]);
  const card = (d: Row) =>
    ui.card({
      title: d.title,
      subtitle: [SHAPES[d.shape], fmtRange(d.startsAt, d.endsAt)].join(" · "),
      badge: { text: KINDS[d.kind].label, tone: KINDS[d.kind].tone },
      onPress: ui.navigate("detail", { id: d.id }),
    });
  const form = (submit: ReturnType<typeof ui.tool>, label: string, d?: Row & { description: string; detour: string }) =>
    ui.form({
      submitLabel: label,
      submit,
      children: [
        ui.textInput({ name: "title", label: "Nazwa (np. Remont ul. Długiej)", value: d?.title }),
        ui.select({
          name: "kind",
          label: "Rodzaj utrudnienia",
          options: KIND_VALUES.map((k) => ({ value: k, label: `${KINDS[k].label} – ${KINDS[k].hint}` })),
          value: d?.kind ?? "inconvenience",
        }),
        geometryField(d?.geometry),
        ui.textInput({ name: "startsAt", label: "Początek (RRRR-MM-DD GG:MM)", value: d ? fmtInput(d.startsAt) : undefined }),
        ui.textInput({
          name: "endsAt",
          label: "Koniec (puste = do odwołania)",
          value: d?.endsAt ? fmtInput(d.endsAt) : undefined,
        }),
        ui.textInput({ name: "description", label: "Opis", multiline: true, value: d?.description }),
        ui.textInput({ name: "detour", label: "Objazd (opcjonalnie)", multiline: true, value: d?.detour }),
      ],
    });
  const notFound = () =>
    ui.screen("Nie znaleziono", [ui.empty("To utrudnienie nie istnieje."), ui.button("Mapa utrudnień", ui.navigate("map"), "quiet")]);
  const adminOnly = (message: string) => ui.screen("Brak dostępu", [ui.empty(message)]);

  return definePlugin({
    id: "disruptions",
    name: "Utrudnienia",
    version: "1.0.0",
    icon: "🚧",
    description: "Mapa remontów, zamknięć i utrudnień: trwające na czerwono, planowane na żółto.",
    permissions: ["db"],
    nav: [
      { view: "map", label: "Mapa utrudnień" },
      { view: "list", label: "Lista utrudnień" },
    ],
    tables,

    views: {
      map: async (ctx, params) => {
        const now = ctx.now();
        const show = params.show === "current" || params.show === "planned" ? params.show : "all";
        const items = [
          ...(show !== "planned" ? await current(ctx, now) : []),
          ...(show !== "current" ? await planned(ctx, now) : []),
        ];
        return ui.screen("Mapa utrudnień", [
          ...(isAdmin(ctx) ? [ui.button("Dodaj utrudnienie", ui.navigate("new"))] : []),
          ui.row([
            ui.button("Wszystkie", ui.navigate("map"), show === "all" ? undefined : "quiet"),
            ui.button("Trwające", ui.navigate("map", { show: "current" }), show === "current" ? undefined : "quiet"),
            ui.button("Planowane", ui.navigate("map", { show: "planned" }), show === "planned" ? undefined : "quiet"),
          ]),
          legend(),
          mapOf("Mapa utrudnień", items, now),
          ...(items.length ? [] : [ui.empty("Brak utrudnień do pokazania.")]),
          ui.button("Lista utrudnień", ui.navigate("list"), "quiet"),
        ]);
      },

      list: async (ctx, params) => {
        const now = ctx.now();
        if (params.past === "1") {
          const ended = await ctx.db.disruptions.findMany({
            where: { activeUntil: { lte: now } },
            orderBy: { activeUntil: "desc" },
            limit: 50,
          });
          return ui.screen("Zakończone utrudnienia", [
            ui.list("Zakończone utrudnienia", ended.length ? ended.map(card) : [ui.empty("Brak zakończonych utrudnień.")]),
            ui.button("Aktualne utrudnienia", ui.navigate("list"), "quiet"),
          ]);
        }
        const active = await current(ctx, now);
        const next = await planned(ctx, now);
        return ui.screen("Utrudnienia", [
          ...(isAdmin(ctx) ? [ui.button("Dodaj utrudnienie", ui.navigate("new"))] : []),
          ui.heading(`Trwające utrudnienia (${active.length})`, 3),
          ui.list("Trwające utrudnienia", active.length ? active.map(card) : [ui.empty("Teraz nic nie utrudnia przejazdu.")]),
          ui.heading(`Planowane utrudnienia (${next.length})`, 3),
          ui.list("Planowane utrudnienia", next.length ? next.map(card) : [ui.empty("Brak zaplanowanych utrudnień.")]),
          ui.row([
            ui.button("Mapa utrudnień", ui.navigate("map"), "quiet"),
            ui.button("Zakończone", ui.navigate("list", { past: "1" }), "quiet"),
          ]),
        ]);
      },

      detail: async (ctx, params) => {
        const d = params.id ? await ctx.db.disruptions.get(params.id) : null;
        if (!d) return notFound();
        const now = ctx.now();
        const status = statusOf(d, now);
        return ui.screen(d.title, [
          ui.row([
            ui.badge(STATUS[status].text, STATUS[status].tone),
            ui.badge(KINDS[d.kind].label, KINDS[d.kind].tone),
            ui.badge(SHAPES[d.shape]),
          ]),
          ui.text(`${KINDS[d.kind].label}: ${KINDS[d.kind].hint}.`, "soft"),
          ui.stat("Kiedy", fmtRange(d.startsAt, d.endsAt)),
          ...(status === "ended" ? [] : [mapOf(d.title, [d], now)]),
          ui.text(d.description || "Brak opisu."),
          ...(d.detour ? [ui.stat("Objazd", d.detour)] : []),
          ...(isAdmin(ctx)
            ? [
                ui.row([
                  ui.button("Edytuj", ui.navigate("edit", { id: d.id }), "quiet"),
                  ...(status !== "ended" ? [ui.button("Zakończ teraz", ui.tool("endDisruption", { id: d.id }), "quiet")] : []),
                  ui.button("Usuń", ui.tool("deleteDisruption", { id: d.id }), "danger"),
                ]),
              ]
            : []),
          ui.row([
            ui.button("Mapa utrudnień", ui.navigate("map"), "quiet"),
            ui.button("Lista utrudnień", ui.navigate("list"), "quiet"),
          ]),
        ]);
      },

      new: (ctx) =>
        isAdmin(ctx)
          ? ui.screen("Nowe utrudnienie", [form(ui.tool("createDisruption"), "Opublikuj utrudnienie"), ui.button("Anuluj", ui.navigate("map"), "quiet")])
          : adminOnly("Utrudnienia dodają administratorzy."),

      edit: async (ctx, params) => {
        if (!isAdmin(ctx)) return adminOnly("Utrudnienia edytują administratorzy.");
        const d = params.id ? await ctx.db.disruptions.get(params.id) : null;
        if (!d) return notFound();
        return ui.screen("Edycja utrudnienia", [
          form(ui.tool("updateDisruption", { id: d.id }), "Zapisz zmiany", d),
          ui.button("Anuluj", ui.navigate("detail", { id: d.id }), "quiet"),
        ]);
      },
    },

    dashboardWidgets: {
      now: {
        size: { w: 2, h: 3 },
        render: async (ctx) => {
          const now = ctx.now();
          const active = await current(ctx, now, 3);
          const activeCount = await ctx.db.disruptions.count({ where: { startsAt: { lte: now }, activeUntil: { gt: now } } });
          const soon = await ctx.db.disruptions.count({
            where: { startsAt: { gt: now, lte: new Date(now.getTime() + 7 * DAY_MS) } },
          });
          if (!activeCount && !soon) return null;
          return ui.widget("Utrudnienia", [
            ui.text(activeCount ? `Trwające utrudnienia: ${activeCount}` : "Teraz nic nie utrudnia przejazdu.", "soft"),
            ...active.map((d) =>
              ui.card({ title: d.title, subtitle: KINDS[d.kind].label, onPress: ui.navigate("detail", { id: d.id }) }),
            ),
            ...(soon ? [ui.text(`Planowane w ciągu 7 dni: ${soon}`, "soft")] : []),
            ui.button("Mapa utrudnień", ui.navigate("map"), "quiet"),
          ]);
        },
      },
    },

    tools: {
      createDisruption: {
        description:
          "Oznacz utrudnienie na mapie (tylko administrator): geometry to GeoJSON LineString (odcinek drogi) albo Polygon (obszar), współrzędne [długość, szerokość]; daty RRRR-MM-DD GG:MM, brak końca = do odwołania.",
        input: z.object(input),
        requires: "admin",
        handler: async (ctx, i) => {
          const error = checkDates(i);
          if (error) return { error };
          const d = await ctx.db.disruptions.insert(toRow(i));
          return { toast: "Utrudnienie opublikowane.", navigate: ui.navigate("detail", { id: d.id }), data: { id: d.id } };
        },
      },

      updateDisruption: {
        description: "Zmień utrudnienie (tylko administrator).",
        input: z.object({ id, ...input }),
        requires: "admin",
        handler: async (ctx, { id: disruptionId, ...i }) => {
          const error = checkDates(i);
          if (error) return { error };
          if (!(await ctx.db.disruptions.update(disruptionId, toRow(i)))) return { error: "To utrudnienie nie istnieje." };
          return { toast: "Zmiany zapisane.", navigate: ui.navigate("detail", { id: disruptionId }), data: { id: disruptionId } };
        },
      },

      endDisruption: {
        description: "Zakończ utrudnienie teraz, np. gdy remont skończył się wcześniej (tylko administrator).",
        input: z.object({ id }),
        requires: "admin",
        handler: async (ctx, i) => {
          const d = await ctx.db.disruptions.get(i.id);
          if (!d) return { error: "To utrudnienie nie istnieje." };
          const now = ctx.now();
          if (statusOf(d, now) === "ended") return { error: "To utrudnienie już się zakończyło." };
          // A planned disruption that is cancelled ends at its start, so it never shows as current.
          const end = d.startsAt.getTime() > now.getTime() ? d.startsAt : now;
          await ctx.db.disruptions.update(d.id, { endsAt: end, activeUntil: end });
          return { toast: "Utrudnienie zakończone.", refresh: true, data: { id: d.id } };
        },
      },

      deleteDisruption: {
        description: "Usuń utrudnienie (tylko administrator).",
        input: z.object({ id }),
        requires: "admin",
        handler: async (ctx, i) => {
          if (!(await ctx.db.disruptions.delete(i.id))) return { error: "To utrudnienie nie istnieje." };
          return { toast: "Utrudnienie usunięte.", navigate: ui.navigate("map") };
        },
      },

      listDisruptions: {
        description:
          "Trwające i planowane utrudnienia z rodzajem, czasem i środkiem na mapie (dla asystentów AI). status: current | planned | all.",
        input: z.object({ status: z.enum(["current", "planned", "all"]).default("all") }),
        readOnly: true,
        handler: async (ctx, i) => {
          const now = ctx.now();
          const items = [
            ...(i.status !== "planned" ? await current(ctx, now) : []),
            ...(i.status !== "current" ? await planned(ctx, now) : []),
          ];
          return {
            data: items.map((d) => ({
              id: d.id,
              title: d.title,
              status: statusOf(d, now),
              kind: d.kind,
              kindLabel: KINDS[d.kind].label,
              shape: d.shape,
              when: fmtRange(d.startsAt, d.endsAt),
              startsAt: d.startsAt,
              endsAt: d.endsAt,
              description: d.description,
              detour: d.detour,
              center: centerOf(JSON.parse(d.geometry) as Geometry),
            })),
          };
        },
      },
    },
  });
};

export default disruptions;
