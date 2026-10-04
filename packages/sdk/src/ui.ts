import { z } from "zod";
import { geoPointSchema } from "./geo";

/**
 * Server-Driven UI: a plugin does NOT ship code to the app, only a tree of nodes from a closed
 * component catalog. The app (RN/web) renders them with native primitives, so every plugin
 * looks consistent and is accessible. Actions are data (navigation or a tool call), not code.
 *
 * New component = schema here + builder in `ui` + renderer in apps/app/src/plugins/Renderer.tsx.
 */

/** View params (query string): always flat strings. */
export const viewParamsSchema = z.record(z.string(), z.string());
const params = viewParamsSchema;
export type ViewParams = z.infer<typeof params>;

export const navigateActionSchema = z.object({
  type: z.literal("navigate"),
  view: z.string().min(1),
  params: params.optional(),
  /** Replaces the current view instead of stacking a new one (sorting and filters). */
  replace: z.boolean().optional(),
  /**
   * `sheet`: the view opens as a bottom sheet over the current screen (which stays as it is, e.g. a typed form)
   * instead of a new screen. Opened by its address, the view is a normal screen.
   */
  present: z.enum(["sheet"]).optional(),
});
export const toolActionSchema = z.object({
  type: z.literal("tool"),
  tool: z.string().min(1),
  args: z.record(z.string(), z.unknown()).optional(),
});
/** A screen of the app itself, outside the plugin (e.g. "Wróć do pulpitu"). Read-only: allowed in widgets. */
export const appActionSchema = z.object({ type: z.literal("app"), screen: z.enum(["dashboard", "pluginPage"]) });
export const actionSchema = z.discriminatedUnion("type", [navigateActionSchema, toolActionSchema, appActionSchema]);

export type NavigateAction = z.infer<typeof navigateActionSchema>;
export type ToolAction = z.infer<typeof toolActionSchema>;
export type AppAction = z.infer<typeof appActionSchema>;
export type Action = z.infer<typeof actionSchema>;

/** Tool result: what the app should do after the call (message, navigation, view refresh). */
export const toolResultSchema = z.object({
  /** Success message. */
  toast: z.string().optional(),
  /** Error message for the user (e.g. "the poll is closed", written in Polish by the plugin); nothing was saved. */
  error: z.string().optional(),
  navigate: navigateActionSchema.optional(),
  /** Close the current screen (go back). */
  close: z.boolean().optional(),
  refresh: z.boolean().optional(),
  /** Result data for AI assistants (MCP) and readOnly tools. */
  data: z.unknown().optional(),
});
export type ToolResult = z.infer<typeof toolResultSchema>;

const tone = z.enum(["neutral", "info", "success", "warning", "danger"]);
export type Tone = z.infer<typeof tone>;

/**
 * Plugin maps (`ui.map`): layers of pins, routes and areas over the app's base map. A plugin says what is where
 * and what it means (`tone`); the app draws it in its own colours. The map is a canvas, so every item has a `title`:
 * the app lists the items next to the map (screen readers, keyboards, E2E), and tapping one there or on the map runs
 * its `onPress`.
 */
export const MAP_LIMITS = {
  layers: 8,
  /** Items on one map, all layers together. */
  items: 1000,
  routePoints: 2000,
  polygonPoints: 500,
  /** Largest area radius, in metres (as a "near" notification). */
  radius: 50_000,
} as const;

const mapItem = {
  id: z.string().min(1).max(100),
  title: z.string().min(1).max(120),
  subtitle: z.string().max(200).optional(),
  /** Overrides the layer's tone. */
  tone: tone.optional(),
  onPress: actionSchema.optional(),
};
const mapPinSchema = z.object({ ...mapItem, at: geoPointSchema });
const mapRouteSchema = z.object({
  ...mapItem,
  path: z.array(geoPointSchema).min(2).max(MAP_LIMITS.routePoints),
  /** A dashed line: a detour, a planned or a temporary route. */
  dashed: z.boolean().optional(),
});
/** A circle (`center`, `radius` in metres) or a polygon. */
const mapAreaSchema = z.union([
  z.object({ ...mapItem, center: geoPointSchema, radius: z.number().positive().max(MAP_LIMITS.radius) }),
  z.object({ ...mapItem, polygon: z.array(geoPointSchema).min(3).max(MAP_LIMITS.polygonPoints) }),
]);
const layerHead = { title: z.string().min(1).max(80), tone: tone.optional() };
const mapLayerSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("pins"), ...layerHead, items: z.array(mapPinSchema).max(MAP_LIMITS.items) }),
  z.object({ kind: z.literal("routes"), ...layerHead, items: z.array(mapRouteSchema).max(MAP_LIMITS.items) }),
  z.object({ kind: z.literal("areas"), ...layerHead, items: z.array(mapAreaSchema).max(MAP_LIMITS.items) }),
]);

export type MapPinItem = z.infer<typeof mapPinSchema>;
export type MapRouteItem = z.infer<typeof mapRouteSchema>;
export type MapAreaItem = z.infer<typeof mapAreaSchema>;
export type MapLayer = z.infer<typeof mapLayerSchema>;

/** Icons a node can show (a Select card, a Button, a widget header); the app draws them (apps/app/src/plugins/Renderer.tsx). */
export const UI_ICONS = [
  "alert",
  "idea",
  "camera",
  "megaphone",
  "share",
  "send",
  "pin",
  "chat",
  "people",
  "plus",
  "lock",
  "shield",
  "settings",
  "sliders",
  "check",
  "refresh",
  "info",
  "arrowUp",
  "sparkles",
] as const;
export const uiIconSchema = z.enum(UI_ICONS);
export type UIIcon = z.infer<typeof uiIconSchema>;

/** A photo from ctx.files. The host adds `url` (signed, short-lived) when rendering, as for Image. */
const imageRefSchema = z.object({ file: z.string(), alt: z.string(), url: z.string().optional() });
export type ImageRef = z.infer<typeof imageRefSchema>;

/**
 * One piece of a meta line: a moment (`at`, an ISO date; the app formats it: "3 dni temu", "wczoraj") or a text with
 * an optional icon. `label` is the screen-reader name when the icon carries the meaning ("Komentarze: 8").
 */
const metaItemSchema = z.union([
  z.object({ at: z.iso.datetime({ offset: true }) }),
  z.object({
    text: z.string().min(1).max(80),
    icon: uiIconSchema.optional(),
    label: z.string().min(1).max(80).optional(),
  }),
]);
export type MetaItem = z.infer<typeof metaItemSchema>;

/**
 * A small label on a card: a tone colour, an optional icon and a dot (a status). `onRemove` (a tool) makes it a
 * removable chip with an "X" (e.g. a category in settings).
 */
const cardTagSchema = z.object({
  text: z.string().min(1).max(40),
  tone: tone.optional(),
  icon: uiIconSchema.optional(),
  dot: z.boolean().optional(),
  onRemove: toolActionSchema.optional(),
  variant: z.enum(["pill"]).optional(),
});
export type CardTag = z.infer<typeof cardTagSchema>;

/**
 * A card's counter (e.g. votes). With `action` (a tool) it is a toggle button and `pressed` says whether the viewer
 * already counted; without `action` but with `pressed` it is a pill shown as it is; with neither it is a plain count
 * (an arrow and the number: admin rows, widget rows).
 */
const cardCounterSchema = z.object({
  label: z.string().min(1).max(60),
  value: z.number().int().min(0),
  pressed: z.boolean().optional(),
  action: toolActionSchema.optional(),
});
export type CardCounter = z.infer<typeof cardCounterSchema>;

/** A thumbnail on a card; `more` = how many photos besides this one (a "+N" badge). */
const cardImageSchema = imageRefSchema.extend({ more: z.number().int().min(0).max(99).optional() });
export type CardImage = z.infer<typeof cardImageSchema>;

/**
 * A button in a screen's header (navigation chrome, so it only navigates): `pill` (default) = icon and label,
 * `icon` = a round icon-only button whose label is its accessible name.
 */
const screenActionSchema = z
  .object({
    label: z.string().min(1).max(40),
    icon: uiIconSchema.optional(),
    variant: z.enum(["pill", "icon"]).optional(),
    action: navigateActionSchema,
  })
  .refine((a) => a.variant !== "icon" || a.icon !== undefined, "An icon-only action needs an icon");
export type ScreenAction = z.infer<typeof screenActionSchema>;

/** An option of a Menu: navigate (e.g. a sort, `replace: true`) or a tool (e.g. set a category). */
const menuOptionSchema = z.object({
  label: z.string().min(1).max(60),
  selected: z.boolean().optional(),
  action: actionSchema,
});
export type MenuOption = z.infer<typeof menuOptionSchema>;

/** Leaf nodes (no children). */
const leafSchemas = [
  z.object({ type: z.literal("Heading"), text: z.string(), level: z.union([z.literal(2), z.literal(3)]).optional() }),
  z.object({ type: z.literal("Text"), text: z.string(), tone: z.enum(["ink", "soft"]).optional() }),
  z.object({ type: z.literal("Badge"), text: z.string(), tone: tone.optional() }),
  /**
   * `ink` is the dark button (e.g. "Zgłoś problem" in a widget). `pressed` makes it a toggle (vote, follow): the state
   * is shown and announced; both states need an action.
   */
  z.object({
    type: z.literal("Button"),
    label: z.string(),
    action: actionSchema,
    variant: z.enum(["primary", "quiet", "danger", "ink"]).optional(),
    icon: uiIconSchema.optional(),
    pressed: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("Progress"),
    value: z.number().min(0),
    max: z.number().positive(),
    label: z.string(),
  }),
  /** A number with its label under it; `success` greens the number, `danger` reds it. In a `Row grow`, a grid. */
  z.object({ type: z.literal("Stat"), label: z.string(), value: z.string(), tone: tone.optional() }),
  /** Nothing to show yet: an optional icon and title over the text. */
  z.object({
    type: z.literal("Empty"),
    text: z.string(),
    title: z.string().max(80).optional(),
    icon: uiIconSchema.optional(),
  }),
  /** Photo from ctx.files. The host adds `url` (signed, short-lived) when rendering the view. */
  z.object({ type: z.literal("Image"), file: z.string(), alt: z.string(), url: z.string().optional() }),
  /**
   * Form field: photo picker; the app uploads each photo and puts its FileId into the form. `max` 1 (default): the
   * field is one FileId; more: an array of FileIds. `value`: photos already uploaded (a previous step), prefilled.
   */
  z
    .object({
      type: z.literal("ImagePicker"),
      name: z.string().min(1),
      label: z.string(),
      max: z.number().int().min(1).max(10).optional(),
      hideLabel: z.boolean().optional(),
      value: z.array(imageRefSchema.partial({ alt: true })).optional(),
    })
    .refine((p) => (p.value?.length ?? 0) <= (p.max ?? 1), "An ImagePicker's value has at most `max` photos"),
  z.object({
    type: z.literal("TextInput"),
    name: z.string().min(1),
    label: z.string(),
    multiline: z.boolean().optional(),
    value: z.string().optional(),
    /** A line under the field (e.g. who sees what is typed). */
    hint: z.string().max(160).optional(),
    placeholder: z.string().max(80).optional(),
    variant: z.enum(["muted"]).optional(),
  }),
  /**
   * One of the options. `cards` (default) are large choices with an optional hint under the label; `chips` a short row
   * of pills (e.g. categories); `segmented` 2–3 options side by side; `radio` a column of radio cards (`hint` under
   * each). Inside a Form it is a field; outside one, `action` (a tool) runs on every change with `[name]: value` added
   * to its args (settings that save at once).
   */
  z.object({
    type: z.literal("Select"),
    name: z.string().min(1),
    label: z.string(),
    variant: z.enum(["cards", "chips", "segmented", "radio"]).optional(),
    options: z
      .array(
        z.object({
          value: z.string(),
          label: z.string(),
          hint: z.string().optional(),
          /** A card's icon. */
          icon: uiIconSchema.optional(),
        }),
      )
      .min(1),
    value: z.string().optional(),
    action: toolActionSchema.optional(),
  }),
  /**
   * On or off, with an optional hint under the label; the tool gets a boolean. Inside a Form it is a field; outside
   * one, `action` (a tool) runs on every change with `[name]: value` added to its args.
   */
  z.object({
    type: z.literal("Switch"),
    name: z.string().min(1),
    label: z.string(),
    hint: z.string().optional(),
    value: z.boolean().optional(),
    action: toolActionSchema.optional(),
  }),
  /** Confirmation at the top of a view: a check mark, a title and an optional text. */
  z.object({
    type: z.literal("Hero"),
    title: z.string(),
    text: z.string().optional(),
  }),
  /**
   * @deprecated Use a `List` of `Card`s. Kept so trees of already uploaded plugins still render.
   * The highlighted item of a dashboard widget: a thumbnail (`image`, a photo from ctx.files), a small eyebrow line,
   * the title and a vote count with an up arrow. Tapping it runs `onPress`.
   */
  z.object({
    type: z.literal("Highlight"),
    eyebrow: z.string(),
    title: z.string(),
    image: imageRefSchema.optional(),
    votes: z.number().int().min(0).optional(),
    onPress: actionSchema.optional(),
  }),
  /**
   * A row of options that only navigate (sorting, filters); one option is selected. `tiles` are big tiles with a
   * `count` over the label (e.g. "8" over "Aktywne").
   */
  z.object({
    type: z.literal("Tabs"),
    label: z.string().min(1).max(80),
    variant: z.enum(["segmented", "chips", "tiles"]).optional(),
    options: z
      .array(
        z.object({
          label: z.string().min(1).max(40),
          selected: z.boolean().optional(),
          count: z.number().int().min(0).optional(),
          action: navigateActionSchema,
        }),
      )
      .min(2)
      .max(6),
  }),
  /** A place as a row with a pin: an address, or a note that there is none. */
  z.object({ type: z.literal("Place"), text: z.string().min(1).max(200), action: navigateActionSchema.optional() }),
  /** An information banner with an optional icon (e.g. a lock: "only you and the admins see your reports"). */
  z.object({
    type: z.literal("Notice"),
    text: z.string().min(1).max(300),
    icon: uiIconSchema.optional(),
    tone: tone.optional(),
    variant: z.enum(["plain"]).optional(),
  }),
  /** A meta line on its own ("Anna N. · 3 dni temu"): the same items as a Card's `meta`, joined with " · ". */
  z.object({ type: z.literal("Meta"), items: z.array(metaItemSchema).min(1).max(5) }),
  /** Photos to swipe through, with "1 / 2" (from ctx.files; the host signs each). */
  z.object({ type: z.literal("Gallery"), items: z.array(imageRefSchema).min(1).max(10) }),
  /**
   * Pick one option now: a trigger showing the selected option opens a sheet with all of them; choosing one runs its
   * action (navigate, e.g. a sort, or a tool, e.g. set a category). `text`: a plain text button; `chip`: a small
   * outlined pill with `icon`.
   */
  z.object({
    type: z.literal("Menu"),
    label: z.string().min(1).max(80),
    icon: uiIconSchema.optional(),
    variant: z.enum(["text", "chip"]).optional(),
    options: z.array(menuOptionSchema).min(2).max(30),
  }),
  /** A row of tags (a report's kind and status): tones, an optional icon and a dot. */
  z.object({ type: z.literal("Tags"), items: z.array(cardTagSchema).min(1).max(4) }),
  /** The steps of something that moves on (a report's progress): a dot per step, with its date and an optional note. */
  z.object({
    type: z.literal("Timeline"),
    items: z
      .array(
        z.object({
          title: z.string().min(1).max(80),
          at: z.string().max(40).optional(),
          text: z.string().max(500).optional(),
          tone: tone.optional(),
        }),
      )
      .min(1)
      .max(50),
  }),
  /**
   * A button that shares a link to a place inside the app (`path` starts with /app/); the app builds the full address.
   * `icon` (default): a square icon button; `button`: a full-width button with the label.
   */
  z.object({
    type: z.literal("Share"),
    label: z.string().min(1).max(40),
    path: z.string().regex(/^\/app\//, "a path inside the app"),
    variant: z.enum(["icon", "button"]).optional(),
  }),
  /** A floating button over the screen (it stays in place while the content scrolls), e.g. "Zgłoś". Navigates. */
  z.object({
    type: z.literal("Fab"),
    label: z.string().min(1).max(40),
    icon: uiIconSchema.optional(),
    action: navigateActionSchema,
  }),
  /**
   * Something a person did, and when: their avatar (initials of `person`), the title, a line of text (e.g. the last
   * message of a discussion) and `at` (an ISO date; the app shows "5 min temu"). `unread` marks it as new for this
   * user. In a widget it is one compact row; on a screen the text is shown in full (e.g. a message in a thread).
   */
  z.object({
    type: z.literal("Activity"),
    title: z.string(),
    text: z.string().optional(),
    person: z.string().optional(),
    at: z.iso.datetime({ offset: true }).optional(),
    unread: z.boolean().optional(),
    onPress: actionSchema.optional(),
  }),
  /**
   * A map (see MAP_LIMITS). The first view fits everything on it; `center` (and `zoom`, 1–19) set it instead, e.g.
   * `ctx.community.location` for a map that may be empty. In a dashboard widget it is a still preview.
   */
  z
    .object({
      type: z.literal("Map"),
      label: z.string().min(1).max(120),
      layers: z.array(mapLayerSchema).max(MAP_LIMITS.layers),
      center: geoPointSchema.optional(),
      zoom: z.number().min(1).max(19).optional(),
    })
    .refine(
      (map) => map.layers.reduce((n, layer) => n + layer.items.length, 0) <= MAP_LIMITS.items,
      `A map shows at most ${MAP_LIMITS.items} items`,
    ),
  /**
   * Form field: a place picked on the app's location picker (address search, the user's position, a pin). The tool
   * gets `{ lat, lng, address }` (validate it with `geoLocation()`); no value = the field is left out of `args`.
   */
  z.object({
    type: z.literal("LocationInput"),
    name: z.string().min(1),
    label: z.string(),
    value: geoPointSchema.extend({ address: z.string().max(200).optional() }).optional(),
  }),
] as const;

type Leaf = z.infer<(typeof leafSchemas)[number]>;

/** A text link in a widget's header (e.g. "Wszystkie", or "12 aktywnych" with `count` in bold): it only navigates. */
const widgetLinkSchema = z.object({
  label: z.string().min(1).max(40),
  count: z.number().int().min(0).optional(),
  action: navigateActionSchema,
});
export type WidgetLink = z.infer<typeof widgetLinkSchema>;

/** Nodes with children. Type written by hand because the schema is recursive (z.lazy). */
export type UINode =
  | Leaf
  | {
      type: "Screen";
      title: string;
      eyebrow?: string;
      back?: NavigateAction | AppAction;
      chrome?: boolean;
      /** Buttons at the right of the header (up to 2), e.g. an admin's "Panel". */
      actions?: ScreenAction[];
      children: UINode[];
    }
  | {
      type: "Widget";
      title: string;
      children: UINode[];
      icon?: UIIcon;
      subtitle?: string;
      link?: WidgetLink;
      /** Tapping the dashboard tile opens this view of the plugin (e.g. the full list). */
      onPress?: NavigateAction;
    }
  | { type: "Stack"; children: UINode[] }
  /** `grow`: the children share the row's width equally (e.g. two buttons side by side). */
  | { type: "Row"; grow?: boolean; children: UINode[] }
  /** `grouped`: one white group with its items as rows between hairlines (settings, an admin's list). */
  | { type: "List"; label: string; variant?: "cards" | "grouped"; children: UINode[] }
  | {
      type: "Card";
      title: string;
      subtitle?: string;
      variant?: "compact" | "featured";
      badge?: { text: string; tone?: Tone };
      tags?: CardTag[];
      /** A thumbnail; `more` = how many photos besides it ("+N"). */
      image?: CardImage;
      /** A leading icon in a box (menu rows); ignored when `image` is set. */
      icon?: UIIcon;
      /** The small bottom line: a relative time, a count with an icon, free text. */
      meta?: MetaItem[];
      counter?: CardCounter;
      /** A number badge at the right (unread, pending). */
      count?: number;
      /** New for this viewer: a dot at the left. */
      unread?: boolean;
      onPress?: Action;
      children?: UINode[];
    }
  /** `inline`: the submit is a square send button beside the fields (a comment box), not a full-width button. */
  | {
      type: "Form";
      submitLabel: string;
      submit: ToolAction;
      submitIcon?: UIIcon;
      inline?: boolean;
      children: UINode[];
    };

export type UINodeType = UINode["type"];

export const uiNodeSchema: z.ZodType<UINode> = z.lazy(() =>
  z.discriminatedUnion("type", [
    ...leafSchemas,
    z.object({
      type: z.literal("Screen"),
      title: z.string(),
      eyebrow: z.string().max(80).optional(),
      /** Where the back button leads; without it, the dashboard. */
      back: z.union([navigateActionSchema, appActionSchema]).optional(),
      chrome: z.boolean().optional(),
      actions: z.array(screenActionSchema).max(2).optional(),
      children: z.array(uiNodeSchema),
    }),
    z.object({
      type: z.literal("Widget"),
      title: z.string(),
      children: z.array(uiNodeSchema),
      icon: uiIconSchema.optional(),
      subtitle: z.string().max(120).optional(),
      link: widgetLinkSchema.optional(),
      onPress: navigateActionSchema.optional(),
    }),
    z.object({ type: z.literal("Stack"), children: z.array(uiNodeSchema) }),
    z.object({ type: z.literal("Row"), grow: z.boolean().optional(), children: z.array(uiNodeSchema) }),
    z.object({
      type: z.literal("List"),
      label: z.string(),
      variant: z.enum(["cards", "grouped"]).optional(),
      children: z.array(uiNodeSchema),
    }),
    z.object({
      type: z.literal("Card"),
      title: z.string(),
      subtitle: z.string().optional(),
      variant: z.enum(["compact", "featured"]).optional(),
      badge: z.object({ text: z.string(), tone: tone.optional() }).optional(),
      tags: z.array(cardTagSchema).max(4).optional(),
      image: cardImageSchema.optional(),
      icon: uiIconSchema.optional(),
      meta: z.array(metaItemSchema).min(1).max(4).optional(),
      counter: cardCounterSchema.optional(),
      count: z.number().int().min(0).max(999).optional(),
      unread: z.boolean().optional(),
      onPress: actionSchema.optional(),
      children: z.array(uiNodeSchema).optional(),
    }),
    z.object({
      type: z.literal("Form"),
      submitLabel: z.string(),
      submit: toolActionSchema,
      submitIcon: uiIconSchema.optional(),
      inline: z.boolean().optional(),
      children: z.array(uiNodeSchema),
    }),
  ]),
);

/** View returned by a plugin: always a Screen at the root. */
export const screenSchema = uiNodeSchema.refine((n) => n.type === "Screen", "View must return a Screen node");

const INPUT_NODES: readonly UINodeType[] = ["Form", "TextInput", "Select", "Switch", "ImagePicker", "LocationInput"];

const removable = (tags: CardTag[] | undefined) => tags?.some((tag) => tag.onRemove) ?? false;

/** No inputs and no tool calls anywhere in the tree: only reading and navigation (app actions included). */
function isReadOnly(node: UINode): boolean {
  if (INPUT_NODES.includes(node.type)) return false;
  if (node.type === "Button" && node.action.type === "tool") return false;
  if (node.type === "Card" && node.onPress?.type === "tool") return false;
  if (node.type === "Card" && (node.counter?.action || removable(node.tags))) return false;
  if (node.type === "Tags" && removable(node.items)) return false;
  if (node.type === "Menu" && node.options.some((option) => option.action.type === "tool")) return false;
  if ((node.type === "Highlight" || node.type === "Activity") && node.onPress?.type === "tool") return false;
  if (node.type === "Map") {
    const items = node.layers.flatMap((layer): { onPress?: Action }[] => layer.items);
    if (items.some((item) => item.onPress?.type === "tool")) return false;
  }
  return !("children" in node && node.children) || node.children.every(isReadOnly);
}

/**
 * Dashboard widget returned by a plugin: a Widget node at the root, read-only
 * (no forms, no tool calls). Its navigate actions open views of the plugin.
 */
export const dashboardWidgetSchema = uiNodeSchema
  .refine((n) => n.type === "Widget", "Widget must return a Widget node")
  .refine(isReadOnly, "Widget must be read-only: no forms, inputs or tool actions");

type Of<T extends UINodeType> = Extract<UINode, { type: T }>;
type Props<T extends UINodeType> = Omit<Of<T>, "type">;

/** Node builders — a plugin composes its view from them. They return plain JSON objects. */
export const ui = {
  /**
   * `options.eyebrow`: a small line above the title (e.g. the place's name); `options.back`: where back leads;
   * `options.actions`: up to 2 header buttons that navigate.
   */
  screen: (
    title: string,
    children: UINode[],
    options: { eyebrow?: string; back?: NavigateAction | AppAction; chrome?: boolean; actions?: ScreenAction[] } = {},
  ): Of<"Screen"> => ({
    type: "Screen",
    title,
    children,
    ...options,
  }),
  /** `options.onPress`: where tapping the tile leads; `icon`, `subtitle` and `link` make the header (see Widget). */
  widget: (
    title: string,
    children: UINode[],
    options: Omit<Props<"Widget">, "title" | "children"> = {},
  ): Of<"Widget"> => ({
    type: "Widget",
    title,
    children,
    ...options,
  }),
  stack: (children: UINode[]): Of<"Stack"> => ({ type: "Stack", children }),
  row: (children: UINode[], options: { grow?: boolean } = {}): Of<"Row"> => ({ type: "Row", children, ...options }),
  /** `options.variant`: `cards` (default, separate cards) or `grouped` (rows in one white group). */
  list: (label: string, children: UINode[], options: { variant?: "cards" | "grouped" } = {}): Of<"List"> => ({
    type: "List",
    label,
    children,
    ...options,
  }),
  card: (props: Props<"Card">): Of<"Card"> => ({ type: "Card", ...props }),
  form: (props: Props<"Form">): Of<"Form"> => ({ type: "Form", ...props }),
  heading: (text: string, level: 2 | 3 = 2): Of<"Heading"> => ({ type: "Heading", text, level }),
  text: (text: string, tone?: "ink" | "soft"): Of<"Text"> => ({ type: "Text", text, ...(tone ? { tone } : {}) }),
  badge: (text: string, tone?: Tone): Of<"Badge"> => ({ type: "Badge", text, ...(tone ? { tone } : {}) }),
  /** `options.pressed`: a toggle (e.g. a vote) and its state. */
  button: (
    label: string,
    action: Action,
    variant?: "primary" | "quiet" | "danger" | "ink",
    icon?: UIIcon,
    options: { pressed?: boolean } = {},
  ): Of<"Button"> => ({
    type: "Button",
    label,
    action,
    ...(variant ? { variant } : {}),
    ...(icon ? { icon } : {}),
    ...options,
  }),
  progress: (props: Props<"Progress">): Of<"Progress"> => ({ type: "Progress", ...props }),
  stat: (label: string, value: string, tone?: Tone): Of<"Stat"> => ({
    type: "Stat",
    label,
    value,
    ...(tone ? { tone } : {}),
  }),
  /** `options.title` and `options.icon` go over the text. */
  empty: (text: string, options: { title?: string; icon?: UIIcon } = {}): Of<"Empty"> => ({
    type: "Empty",
    text,
    ...options,
  }),
  image: (file: string, alt: string): Of<"Image"> => ({ type: "Image", file, alt }),
  imagePicker: (props: Props<"ImagePicker">): Of<"ImagePicker"> => ({ type: "ImagePicker", ...props }),
  textInput: (props: Props<"TextInput">): Of<"TextInput"> => ({ type: "TextInput", ...props }),
  select: (props: Props<"Select">): Of<"Select"> => ({ type: "Select", ...props }),
  switch: (props: Props<"Switch">): Of<"Switch"> => ({ type: "Switch", ...props }),
  hero: (props: Props<"Hero">): Of<"Hero"> => ({ type: "Hero", ...props }),
  tabs: (props: Props<"Tabs">): Of<"Tabs"> => ({ type: "Tabs", ...props }),
  tags: (items: Props<"Tags">["items"]): Of<"Tags"> => ({ type: "Tags", items }),
  place: (text: string, action?: NavigateAction): Of<"Place"> => ({
    type: "Place",
    text,
    ...(action ? { action } : {}),
  }),
  timeline: (items: Props<"Timeline">["items"]): Of<"Timeline"> => ({ type: "Timeline", items }),
  /** `options.variant`: `icon` (default, a square button) or `button` (full width with the label). */
  share: (label: string, path: string, options: { variant?: "icon" | "button" } = {}): Of<"Share"> => ({
    type: "Share",
    label,
    path,
    ...options,
  }),
  fab: (props: Props<"Fab">): Of<"Fab"> => ({ type: "Fab", ...props }),
  /** @deprecated Use a `List` of `Card`s. */
  highlight: (props: Props<"Highlight">): Of<"Highlight"> => ({ type: "Highlight", ...props }),
  notice: (text: string, options: { icon?: UIIcon; tone?: Tone; variant?: "plain" } = {}): Of<"Notice"> => ({
    type: "Notice",
    text,
    ...options,
  }),
  meta: (items: MetaItem[]): Of<"Meta"> => ({ type: "Meta", items }),
  gallery: (items: { file: string; alt: string }[]): Of<"Gallery"> => ({ type: "Gallery", items }),
  menu: (props: Props<"Menu">): Of<"Menu"> => ({ type: "Menu", ...props }),
  activity: (props: Props<"Activity">): Of<"Activity"> => ({ type: "Activity", ...props }),
  /** `ui.map({ label, layers: [ui.map.pins(...), ui.map.routes(...), ui.map.areas(...)], center?, zoom? })`. */
  map: Object.assign((props: Props<"Map">): Of<"Map"> => ({ type: "Map", ...props }), {
    /** Points: places, reports, alerts. `tone` colours the whole layer (an item's own tone wins). */
    pins: (title: string, items: MapPinItem[], tone?: Tone): MapLayer => ({
      kind: "pins",
      title,
      items,
      ...(tone ? { tone } : {}),
    }),
    /** Lines through `path`: a route, a detour (`dashed`), a closed street. */
    routes: (title: string, items: MapRouteItem[], tone?: Tone): MapLayer => ({
      kind: "routes",
      title,
      items,
      ...(tone ? { tone } : {}),
    }),
    /** Circles (`center`, `radius` in metres) or polygons: an alert zone, a closed park, a district. */
    areas: (title: string, items: MapAreaItem[], tone?: Tone): MapLayer => ({
      kind: "areas",
      title,
      items,
      ...(tone ? { tone } : {}),
    }),
  }),
  locationInput: (props: Props<"LocationInput">): Of<"LocationInput"> => ({ type: "LocationInput", ...props }),

  /**
   * `options.replace`: replace the current view instead of stacking a new one; `options.present: "sheet"`: open it
   * as a bottom sheet over the current screen.
   */
  navigate: (
    view: string,
    params?: ViewParams,
    options: { replace?: boolean; present?: "sheet" } = {},
  ): NavigateAction => ({
    type: "navigate",
    view,
    ...(params ? { params } : {}),
    ...(options.replace ? { replace: true } : {}),
    ...(options.present ? { present: options.present } : {}),
  }),
  tool: (tool: string, args?: Record<string, unknown>): ToolAction => ({
    type: "tool",
    tool,
    ...(args ? { args } : {}),
  }),
  /** A host screen: `dashboard` or this installation's management page (`pluginPage`). */
  app: (screen: AppAction["screen"]): AppAction => ({ type: "app", screen }),
  result: (result: ToolResult): ToolResult => result,
};

export type UI = typeof ui;
