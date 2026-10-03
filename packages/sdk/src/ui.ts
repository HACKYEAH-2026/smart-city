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
});
export const toolActionSchema = z.object({
  type: z.literal("tool"),
  tool: z.string().min(1),
  args: z.record(z.string(), z.unknown()).optional(),
});
export const actionSchema = z.discriminatedUnion("type", [navigateActionSchema, toolActionSchema]);

export type NavigateAction = z.infer<typeof navigateActionSchema>;
export type ToolAction = z.infer<typeof toolActionSchema>;
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
export const UI_ICONS = ["alert", "idea", "camera", "megaphone"] as const;
export const uiIconSchema = z.enum(UI_ICONS);
export type UIIcon = z.infer<typeof uiIconSchema>;

/** Leaf nodes (no children). */
const leafSchemas = [
  z.object({ type: z.literal("Heading"), text: z.string(), level: z.union([z.literal(2), z.literal(3)]).optional() }),
  z.object({ type: z.literal("Text"), text: z.string(), tone: z.enum(["ink", "soft"]).optional() }),
  z.object({ type: z.literal("Badge"), text: z.string(), tone: tone.optional() }),
  z.object({
    type: z.literal("Button"),
    label: z.string(),
    action: actionSchema,
    variant: z.enum(["primary", "quiet", "danger"]).optional(),
    icon: uiIconSchema.optional(),
  }),
  z.object({
    type: z.literal("Progress"),
    value: z.number().min(0),
    max: z.number().positive(),
    label: z.string(),
  }),
  z.object({ type: z.literal("Stat"), label: z.string(), value: z.string() }),
  z.object({ type: z.literal("Empty"), text: z.string() }),
  /** Photo from ctx.files. The host adds `url` (signed, short-lived) when rendering the view. */
  z.object({ type: z.literal("Image"), file: z.string(), alt: z.string(), url: z.string().optional() }),
  /** Form field: photo picker; the app uploads the file and puts its FileId into the form. */
  z.object({ type: z.literal("ImagePicker"), name: z.string().min(1), label: z.string() }),
  z.object({
    type: z.literal("TextInput"),
    name: z.string().min(1),
    label: z.string(),
    multiline: z.boolean().optional(),
    value: z.string().optional(),
  }),
  /**
   * Form field: one of the options. `cards` (default) are large choices with an optional hint under the label;
   * `chips` are a short row of pills (e.g. categories).
   */
  z.object({
    type: z.literal("Select"),
    name: z.string().min(1),
    label: z.string(),
    variant: z.enum(["cards", "chips"]).optional(),
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
  }),
  /** Form field: on or off, with an optional hint under the label; the tool gets a boolean. */
  z.object({
    type: z.literal("Switch"),
    name: z.string().min(1),
    label: z.string(),
    hint: z.string().optional(),
    value: z.boolean().optional(),
  }),
  /** Confirmation at the top of a view: a check mark, a title and an optional text. */
  z.object({
    type: z.literal("Hero"),
    title: z.string(),
    text: z.string().optional(),
  }),
  /**
   * The highlighted item of a dashboard widget: a thumbnail (`image`, a photo from ctx.files), a small eyebrow line,
   * the title and a vote count with an up arrow. Tapping it runs `onPress`.
   */
  z.object({
    type: z.literal("Highlight"),
    eyebrow: z.string(),
    title: z.string(),
    image: z.object({ file: z.string(), alt: z.string(), url: z.string().optional() }).optional(),
    votes: z.number().int().min(0).optional(),
    onPress: actionSchema.optional(),
  }),
  /** A row of options that only navigate (sorting, filters); one option is selected. */
  z.object({
    type: z.literal("Tabs"),
    label: z.string().min(1).max(80),
    variant: z.enum(["segmented", "chips"]).optional(),
    options: z
      .array(
        z.object({
          label: z.string().min(1).max(40),
          selected: z.boolean().optional(),
          action: navigateActionSchema,
        }),
      )
      .min(2)
      .max(6),
  }),
  /** A floating button over the screen (it stays in place while the content scrolls), e.g. "Zgłoś". Navigates. */
  z.object({
    type: z.literal("Fab"),
    label: z.string().min(1).max(40),
    icon: uiIconSchema.optional(),
    action: navigateActionSchema,
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

/** A small label on a card: a tone colour, an optional icon and a dot (a status). */
const cardTagSchema = z.object({
  text: z.string().min(1).max(40),
  tone: tone.optional(),
  icon: uiIconSchema.optional(),
  dot: z.boolean().optional(),
});
export type CardTag = z.infer<typeof cardTagSchema>;

/**
 * A counter button at the left of a card (e.g. votes): the number and whether the viewer already counted. `action` is a
 * tool; without it the button is shown as it is and cannot be pressed (e.g. already confirmed).
 */
const cardCounterSchema = z.object({
  label: z.string().min(1).max(60),
  value: z.number().int().min(0),
  pressed: z.boolean(),
  action: toolActionSchema.optional(),
});
export type CardCounter = z.infer<typeof cardCounterSchema>;

/** A text link in a widget's header (e.g. "Wszystkie"): it only navigates. */
const widgetLinkSchema = z.object({ label: z.string().min(1).max(40), action: navigateActionSchema });
export type WidgetLink = z.infer<typeof widgetLinkSchema>;

/** Nodes with children. Type written by hand because the schema is recursive (z.lazy). */
export type UINode =
  | Leaf
  | { type: "Screen"; title: string; eyebrow?: string; children: UINode[] }
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
  | { type: "List"; label: string; children: UINode[] }
  | {
      type: "Card";
      title: string;
      subtitle?: string;
      badge?: { text: string; tone?: Tone };
      tags?: CardTag[];
      counter?: CardCounter;
      onPress?: Action;
      children?: UINode[];
    }
  | { type: "Form"; submitLabel: string; submit: ToolAction; children: UINode[] };

export type UINodeType = UINode["type"];

export const uiNodeSchema: z.ZodType<UINode> = z.lazy(() =>
  z.discriminatedUnion("type", [
    ...leafSchemas,
    z.object({
      type: z.literal("Screen"),
      title: z.string(),
      eyebrow: z.string().max(80).optional(),
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
    z.object({ type: z.literal("List"), label: z.string(), children: z.array(uiNodeSchema) }),
    z.object({
      type: z.literal("Card"),
      title: z.string(),
      subtitle: z.string().optional(),
      badge: z.object({ text: z.string(), tone: tone.optional() }).optional(),
      tags: z.array(cardTagSchema).max(4).optional(),
      counter: cardCounterSchema.optional(),
      onPress: actionSchema.optional(),
      children: z.array(uiNodeSchema).optional(),
    }),
    z.object({
      type: z.literal("Form"),
      submitLabel: z.string(),
      submit: toolActionSchema,
      children: z.array(uiNodeSchema),
    }),
  ]),
);

/** View returned by a plugin: always a Screen at the root. */
export const screenSchema = uiNodeSchema.refine((n) => n.type === "Screen", "View must return a Screen node");

const INPUT_NODES: readonly UINodeType[] = ["Form", "TextInput", "Select", "Switch", "ImagePicker", "LocationInput"];

/** No inputs and no tool calls anywhere in the tree: only reading and navigation. */
function isReadOnly(node: UINode): boolean {
  if (INPUT_NODES.includes(node.type)) return false;
  if (node.type === "Button" && node.action.type === "tool") return false;
  if (node.type === "Card" && node.onPress?.type === "tool") return false;
  if (node.type === "Card" && node.counter?.action) return false;
  if (node.type === "Highlight" && node.onPress?.type === "tool") return false;
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
  /** `options.eyebrow`: a small line above the title (e.g. the place's name). */
  screen: (title: string, children: UINode[], options: { eyebrow?: string } = {}): Of<"Screen"> => ({
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
  list: (label: string, children: UINode[]): Of<"List"> => ({ type: "List", label, children }),
  card: (props: Props<"Card">): Of<"Card"> => ({ type: "Card", ...props }),
  form: (props: Props<"Form">): Of<"Form"> => ({ type: "Form", ...props }),
  heading: (text: string, level: 2 | 3 = 2): Of<"Heading"> => ({ type: "Heading", text, level }),
  text: (text: string, tone?: "ink" | "soft"): Of<"Text"> => ({ type: "Text", text, ...(tone ? { tone } : {}) }),
  badge: (text: string, tone?: Tone): Of<"Badge"> => ({ type: "Badge", text, ...(tone ? { tone } : {}) }),
  button: (label: string, action: Action, variant?: "primary" | "quiet" | "danger", icon?: UIIcon): Of<"Button"> => ({
    type: "Button",
    label,
    action,
    ...(variant ? { variant } : {}),
    ...(icon ? { icon } : {}),
  }),
  progress: (props: Props<"Progress">): Of<"Progress"> => ({ type: "Progress", ...props }),
  stat: (label: string, value: string): Of<"Stat"> => ({ type: "Stat", label, value }),
  empty: (text: string): Of<"Empty"> => ({ type: "Empty", text }),
  image: (file: string, alt: string): Of<"Image"> => ({ type: "Image", file, alt }),
  imagePicker: (props: Props<"ImagePicker">): Of<"ImagePicker"> => ({ type: "ImagePicker", ...props }),
  textInput: (props: Props<"TextInput">): Of<"TextInput"> => ({ type: "TextInput", ...props }),
  select: (props: Props<"Select">): Of<"Select"> => ({ type: "Select", ...props }),
  switch: (props: Props<"Switch">): Of<"Switch"> => ({ type: "Switch", ...props }),
  hero: (props: Props<"Hero">): Of<"Hero"> => ({ type: "Hero", ...props }),
  tabs: (props: Props<"Tabs">): Of<"Tabs"> => ({ type: "Tabs", ...props }),
  fab: (props: Props<"Fab">): Of<"Fab"> => ({ type: "Fab", ...props }),
  highlight: (props: Props<"Highlight">): Of<"Highlight"> => ({ type: "Highlight", ...props }),
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

  /** `options.replace`: replace the current view instead of stacking a new one. */
  navigate: (view: string, params?: ViewParams, options: { replace?: boolean } = {}): NavigateAction => ({
    type: "navigate",
    view,
    ...(params ? { params } : {}),
    ...(options.replace ? { replace: true } : {}),
  }),
  tool: (tool: string, args?: Record<string, unknown>): ToolAction => ({
    type: "tool",
    tool,
    ...(args ? { args } : {}),
  }),
  result: (result: ToolResult): ToolResult => result,
};

export type UI = typeof ui;
