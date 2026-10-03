import { z } from "zod";
import type { ToolResult, UI, UINode, ViewParams } from "./ui";

/**
 * Kontrakt wtyczki. Moduł wtyczki NICZEGO nie importuje w runtime (tylko `import type`):
 * eksportuje domyślnie funkcję, która dostaje SDK ({ definePlugin, ui, z }) od hosta.
 * Dzięki temu ten sam plik działa jako wtyczka wbudowana i jako wtyczka wgrana w locie przez API,
 * a później może być uruchamiany w izolacji (Worker/WASM) bez zmian w kodzie wtyczki.
 */

export const PLUGIN_PERMISSIONS = ["storage"] as const;
export type PluginPermission = (typeof PLUGIN_PERMISSIONS)[number];

const id = z
  .string()
  .regex(/^[a-z][a-z0-9-]{1,39}$/, "Use 2-40 chars: lowercase letters, digits, hyphens; start with a letter");

export const pluginManifestSchema = z.object({
  id,
  name: z.string().trim().min(1).max(60),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "Use semver, e.g. 1.0.0"),
  icon: z.string().max(8).default("🧩"),
  description: z.string().max(280).default(""),
  permissions: z.array(z.enum(PLUGIN_PERMISSIONS)).default([]),
  /** Wpisy w nawigacji społeczności; każdy wskazuje widok wtyczki. */
  nav: z.array(z.object({ view: z.string().min(1), label: z.string().min(1).max(40) })).min(1),
});
export type PluginManifest = z.output<typeof pluginManifestSchema>;
export type PluginManifestInput = z.input<typeof pluginManifestSchema>;

/** Rekord w magazynie wtyczki. `data` to dowolny JSON wtyczki. */
export type PluginDoc<T = Record<string, unknown>> = {
  id: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  data: T;
};

/**
 * Magazyn dokumentów wtyczki. Zawsze ograniczony do JEDNEJ instalacji (wtyczka × społeczność):
 * wtyczka nie ma jak odczytać danych innej społeczności ani innej wtyczki.
 */
export interface PluginStorage {
  list<T = Record<string, unknown>>(
    collection: string,
    opts?: { order?: "newest" | "oldest"; limit?: number },
  ): Promise<PluginDoc<T>[]>;
  get<T = Record<string, unknown>>(collection: string, id: string): Promise<PluginDoc<T> | null>;
  add<T extends Record<string, unknown>>(collection: string, data: T): Promise<PluginDoc<T>>;
  /** Płytkie scalenie pól `patch` z istniejącym `data`. */
  update<T = Record<string, unknown>>(
    collection: string,
    id: string,
    patch: Record<string, unknown>,
  ): Promise<PluginDoc<T> | null>;
  remove(collection: string, id: string): Promise<boolean>;
}

/** Jedyne API, jakie wtyczka widzi. Bez bazy, plików i sieci — tylko to, co dał host. */
export type PluginContext = {
  user: { id: string; name: string };
  community: { id: string; slug: string; name: string };
  /** Dostępne tylko z uprawnieniem "storage" w manifeście. */
  storage: PluginStorage;
};

export type PluginView = (ctx: PluginContext, params: ViewParams) => UINode | Promise<UINode>;

export type PluginTool<S extends z.ZodType = z.ZodType> = {
  /** Opis dla ludzi i dla asystentów AI (MCP). */
  description: string;
  input: S;
  handler: (ctx: PluginContext, input: z.output<S>) => ToolResult | undefined | Promise<ToolResult | undefined>;
};

export type PluginDefinition = PluginManifestInput & {
  views: Record<string, PluginView>;
  tools?: Record<string, PluginTool>;
};

/** Identyczność z typowaniem: zachowuje typ wejścia każdego narzędzia w handlerze. */
export function definePlugin<T extends Record<string, z.ZodType>>(
  plugin: PluginManifestInput & {
    views: Record<string, PluginView>;
    tools?: { [K in keyof T]: PluginTool<T[K]> };
  },
): PluginDefinition {
  return plugin as PluginDefinition;
}

export type PluginSdk = { definePlugin: typeof definePlugin; ui: UI; z: typeof z };

/** Kształt modułu wtyczki: `export default (({ definePlugin, ui, z }) => definePlugin({...})) satisfies PluginModule`. */
export type PluginModule = (sdk: PluginSdk) => PluginDefinition;
