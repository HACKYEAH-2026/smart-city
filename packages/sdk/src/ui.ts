import { z } from "zod";

/**
 * Server-Driven UI: wtyczka NIE dostarcza kodu do aplikacji, tylko drzewo węzłów z zamkniętego
 * katalogu komponentów. Aplikacja (RN/web) renderuje je natywnymi prymitywami, więc każda wtyczka
 * wygląda spójnie i jest dostępna. Akcje to dane (nawigacja albo wywołanie narzędzia), nie kod.
 *
 * Nowy komponent = schemat tutaj + builder w `ui` + renderer w apps/app/src/plugins/Renderer.tsx.
 */

/** Parametry widoku (query string): zawsze płaskie stringi. */
export const viewParamsSchema = z.record(z.string(), z.string());
const params = viewParamsSchema;
export type ViewParams = z.infer<typeof params>;

export const navigateActionSchema = z.object({
  type: z.literal("navigate"),
  view: z.string().min(1),
  params: params.optional(),
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

/** Wynik narzędzia: co aplikacja ma zrobić po wywołaniu (komunikat, przejście, odświeżenie widoku). */
export const toolResultSchema = z.object({
  /** Komunikat sukcesu. */
  toast: z.string().optional(),
  /** Komunikat błędu dla użytkownika (np. „Głosowanie jest zamknięte”); nic nie zostało zapisane. */
  error: z.string().optional(),
  navigate: navigateActionSchema.optional(),
  /** Zamknij bieżący ekran (wróć). */
  close: z.boolean().optional(),
  refresh: z.boolean().optional(),
  /** Dane wyniku dla asystentów AI (MCP) i narzędzi readOnly. */
  data: z.unknown().optional(),
});
export type ToolResult = z.infer<typeof toolResultSchema>;

const tone = z.enum(["neutral", "info", "success", "warning", "danger"]);
export type Tone = z.infer<typeof tone>;

/** Węzły liściowe (bez dzieci). */
const leafSchemas = [
  z.object({ type: z.literal("Heading"), text: z.string(), level: z.union([z.literal(2), z.literal(3)]).optional() }),
  z.object({ type: z.literal("Text"), text: z.string(), tone: z.enum(["ink", "soft"]).optional() }),
  z.object({ type: z.literal("Badge"), text: z.string(), tone: tone.optional() }),
  z.object({
    type: z.literal("Button"),
    label: z.string(),
    action: actionSchema,
    variant: z.enum(["primary", "quiet", "danger"]).optional(),
  }),
  z.object({
    type: z.literal("Progress"),
    value: z.number().min(0),
    max: z.number().positive(),
    label: z.string(),
  }),
  z.object({ type: z.literal("Stat"), label: z.string(), value: z.string() }),
  z.object({ type: z.literal("Empty"), text: z.string() }),
  /** Zdjęcie z ctx.files. `url` (podpisany, krótkotrwały) dokleja host przy renderowaniu widoku. */
  z.object({ type: z.literal("Image"), file: z.string(), alt: z.string(), url: z.string().optional() }),
  /** Pole formularza: wybór zdjęcia; aplikacja wysyła plik i wstawia do formularza jego FileId. */
  z.object({ type: z.literal("ImagePicker"), name: z.string().min(1), label: z.string() }),
  z.object({
    type: z.literal("TextInput"),
    name: z.string().min(1),
    label: z.string(),
    multiline: z.boolean().optional(),
    value: z.string().optional(),
  }),
  z.object({
    type: z.literal("Select"),
    name: z.string().min(1),
    label: z.string(),
    options: z.array(z.object({ value: z.string(), label: z.string() })).min(1),
    value: z.string().optional(),
  }),
] as const;

type Leaf = z.infer<(typeof leafSchemas)[number]>;

/** Węzły z dziećmi. Typ zapisany ręcznie, bo schemat jest rekurencyjny (z.lazy). */
export type UINode =
  | Leaf
  | { type: "Screen"; title: string; children: UINode[] }
  | { type: "Stack"; children: UINode[] }
  | { type: "Row"; children: UINode[] }
  | { type: "List"; label: string; children: UINode[] }
  | {
      type: "Card";
      title: string;
      subtitle?: string;
      badge?: { text: string; tone?: Tone };
      onPress?: Action;
      children?: UINode[];
    }
  | { type: "Form"; submitLabel: string; submit: ToolAction; children: UINode[] };

export type UINodeType = UINode["type"];

export const uiNodeSchema: z.ZodType<UINode> = z.lazy(() =>
  z.discriminatedUnion("type", [
    ...leafSchemas,
    z.object({ type: z.literal("Screen"), title: z.string(), children: z.array(uiNodeSchema) }),
    z.object({ type: z.literal("Stack"), children: z.array(uiNodeSchema) }),
    z.object({ type: z.literal("Row"), children: z.array(uiNodeSchema) }),
    z.object({ type: z.literal("List"), label: z.string(), children: z.array(uiNodeSchema) }),
    z.object({
      type: z.literal("Card"),
      title: z.string(),
      subtitle: z.string().optional(),
      badge: z.object({ text: z.string(), tone: tone.optional() }).optional(),
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

/** Widok zwracany przez wtyczkę: zawsze Screen na szczycie. */
export const screenSchema = uiNodeSchema.refine((n) => n.type === "Screen", "View must return a Screen node");

type Of<T extends UINodeType> = Extract<UINode, { type: T }>;
type Props<T extends UINodeType> = Omit<Of<T>, "type">;

/** Buildery węzłów — wtyczka składa z nich widok. Zwracają zwykłe obiekty JSON. */
export const ui = {
  screen: (title: string, children: UINode[]): Of<"Screen"> => ({ type: "Screen", title, children }),
  stack: (children: UINode[]): Of<"Stack"> => ({ type: "Stack", children }),
  row: (children: UINode[]): Of<"Row"> => ({ type: "Row", children }),
  list: (label: string, children: UINode[]): Of<"List"> => ({ type: "List", label, children }),
  card: (props: Props<"Card">): Of<"Card"> => ({ type: "Card", ...props }),
  form: (props: Props<"Form">): Of<"Form"> => ({ type: "Form", ...props }),
  heading: (text: string, level: 2 | 3 = 2): Of<"Heading"> => ({ type: "Heading", text, level }),
  text: (text: string, tone?: "ink" | "soft"): Of<"Text"> => ({ type: "Text", text, ...(tone ? { tone } : {}) }),
  badge: (text: string, tone?: Tone): Of<"Badge"> => ({ type: "Badge", text, ...(tone ? { tone } : {}) }),
  button: (label: string, action: Action, variant?: "primary" | "quiet" | "danger"): Of<"Button"> => ({
    type: "Button",
    label,
    action,
    ...(variant ? { variant } : {}),
  }),
  progress: (props: Props<"Progress">): Of<"Progress"> => ({ type: "Progress", ...props }),
  stat: (label: string, value: string): Of<"Stat"> => ({ type: "Stat", label, value }),
  empty: (text: string): Of<"Empty"> => ({ type: "Empty", text }),
  image: (file: string, alt: string): Of<"Image"> => ({ type: "Image", file, alt }),
  imagePicker: (props: Props<"ImagePicker">): Of<"ImagePicker"> => ({ type: "ImagePicker", ...props }),
  textInput: (props: Props<"TextInput">): Of<"TextInput"> => ({ type: "TextInput", ...props }),
  select: (props: Props<"Select">): Of<"Select"> => ({ type: "Select", ...props }),

  navigate: (view: string, params?: ViewParams): NavigateAction => ({
    type: "navigate",
    view,
    ...(params ? { params } : {}),
  }),
  tool: (tool: string, args?: Record<string, unknown>): ToolAction => ({
    type: "tool",
    tool,
    ...(args ? { args } : {}),
  }),
  result: (result: ToolResult): ToolResult => result,
};

export type UI = typeof ui;
