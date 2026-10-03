import { z } from "zod";
import type { ToolResult, UI, UINode, ViewParams } from "./ui";

/**
 * Kontrakt wtyczki. Moduł wtyczki NICZEGO nie importuje w runtime (tylko `import type`):
 * eksportuje domyślnie funkcję, która dostaje SDK ({ definePlugin, ui, z, fileRef }) od hosta.
 * Dzięki temu ten sam plik działa jako wtyczka wbudowana i jako wtyczka wgrana w locie przez API,
 * a później może być uruchamiany w izolacji (Worker/WASM) bez zmian w kodzie wtyczki.
 */

export const PLUGIN_PERMISSIONS = ["storage", "files", "ai"] as const;
export type Permission = (typeof PLUGIN_PERMISSIONS)[number];

export const ROLES = ["admin", "user"] as const;
export type Role = (typeof ROLES)[number];

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

// ─────────────────────────────── Storage ────────────────────────────────

/** Dokument w magazynie wtyczki. `data` to dowolny JSON wtyczki. */
export type Doc<T = Record<string, unknown>> = {
  id: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  data: T;
};

export type Query<T> = {
  /** Równość na polach najwyższego poziomu `data` (string, number, boolean). */
  where?: Partial<T>;
  order?: "newest" | "oldest";
  limit?: number;
};

/**
 * Magazyn dokumentów. Zawsze ograniczony do JEDNEJ instalacji (wtyczka × społeczność):
 * wtyczka nie ma jak odczytać danych innej społeczności ani innej wtyczki.
 */
export interface Storage {
  get<T = Record<string, unknown>>(collection: string, id: string): Promise<Doc<T> | null>;
  list<T = Record<string, unknown>>(collection: string, query?: Query<T>): Promise<Doc<T>[]>;
  /** Nowy dokument z wygenerowanym id. */
  create<T extends Record<string, unknown>>(collection: string, data: T): Promise<Doc<T>>;
  /** Zapis pod kluczem (id = key): tworzy albo nadpisuje. Unikalność gwarantuje baza (np. jeden głos na osobę). */
  upsert<T extends Record<string, unknown>>(collection: string, key: string, data: T): Promise<Doc<T>>;
  /** Płytkie scalenie pól `patch` z istniejącym `data`. */
  update<T = Record<string, unknown>>(collection: string, id: string, patch: Partial<T>): Promise<Doc<T> | null>;
  remove(collection: string, id: string): Promise<boolean>;
}

// ──────────────────────────────── Pliki ─────────────────────────────────

/** Identyfikator pliku wysłanego przez aplikację (POST …/files). Wtyczka nigdy nie widzi bajtów ani dysku. */
export type FileId = string & { readonly __brand: "FileId" };
export const FILE_ID = /^file_[0-9a-f-]{36}$/;
export const fileRef = () =>
  z
    .string()
    .regex(FILE_ID, "Invalid file id")
    .transform((v) => v as FileId);

export type FileInfo = { mime: string; size: number };

export interface Files {
  /** Zatwierdza upload tego użytkownika w tej wtyczce. Niezatwierdzone pliki znikają po 24 h. */
  keep(id: FileId): Promise<void>;
  info(id: FileId): Promise<FileInfo>;
  remove(id: FileId): Promise<void>;
}

// ───────────────────────────────── AI ──────────────────────────────────

export type AICall<S extends z.ZodType | undefined = undefined> = {
  prompt: string;
  images?: FileId[];
  /** Ze schematem odpowiedź jest zwalidowanym obiektem; bez schematu — tekstem. */
  schema?: S;
};

export type SimilarOptions<T> = {
  text: (doc: Doc<T>) => string;
  image?: (doc: Doc<T>) => FileId | undefined;
  limit?: number;
};

export type SimilarMatch<T> = { doc: Doc<T>; score: number; reason: string };

export interface AI {
  call<S extends z.ZodType | undefined = undefined>(
    req: AICall<S>,
  ): Promise<S extends z.ZodType ? z.output<S> : string>;
  /** Semantycznie podobne dokumenty (od najbardziej podobnego); pusta lista = brak podobnych. */
  findSimilar<T>(
    query: { text: string; image?: FileId },
    candidates: Doc<T>[],
    opts: SimilarOptions<T>,
  ): Promise<SimilarMatch<T>[]>;
}

// ─────────────────────────────── Kontekst ───────────────────────────────

export type PluginUser = { id: string; name: string; role: Role };
export type PluginCommunity = { id: string; slug: string; name: string };

/** Jedyne API, jakie wtyczka widzi. Bez bazy, plików i sieci — tylko to, co dał host. */
export type Context = {
  user: PluginUser;
  community: PluginCommunity;
  now(): Date;
  /** Uprawnienie "storage". */
  storage: Storage;
  /** Uprawnienie "files". */
  files: Files;
  /** Uprawnienie "ai". */
  ai: AI;
};

// ─────────────────────────────── Wtyczka ────────────────────────────────

export type PluginView = (ctx: Context, params: ViewParams) => UINode | Promise<UINode>;

export type Tool<S extends z.ZodType = z.ZodType> = {
  /** Opis dla ludzi i dla asystentów AI (MCP). */
  description: string;
  input: S;
  /** Kto może wywołać; domyślnie "user". Host egzekwuje (403). */
  requires?: Role;
  /** Bez skutków ubocznych (np. odczyt dla asystenta AI). */
  readOnly?: boolean;
  handler: (ctx: Context, input: z.output<S>) => ToolResult | undefined | Promise<ToolResult | undefined>;
};

export type PluginDefinition = PluginManifestInput & {
  views: Record<string, PluginView>;
  tools?: Record<string, Tool>;
  /** Dane startowe po włączeniu wtyczki w społeczności (ctx.user = system, rola admin). */
  onInstall?: (ctx: Context) => void | Promise<void>;
};

/** Identyczność z typowaniem: zachowuje typ wejścia każdego narzędzia w handlerze. */
export function definePlugin<T extends Record<string, z.ZodType>>(
  plugin: Omit<PluginDefinition, "tools"> & { tools?: { [K in keyof T]: Tool<T[K]> } },
): PluginDefinition {
  return plugin as PluginDefinition;
}

export type PluginSdk = { definePlugin: typeof definePlugin; ui: UI; z: typeof z; fileRef: typeof fileRef };

/** Kształt modułu wtyczki: `const p: PluginModule = ({ definePlugin, ui, z, fileRef }) => definePlugin({...})`. */
export type PluginModule = (sdk: PluginSdk) => PluginDefinition;
