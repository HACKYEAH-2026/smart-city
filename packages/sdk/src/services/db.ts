import type { FileId } from "./files";

/**
 * Plugin database: tables declared by the plugin (`tables: { … }`), stored in SurrealDB, with references to
 * platform tables ("user", "file") and to the plugin's own tables. No migration files: the host defines
 * tables and applies additive changes (new optional/defaulted columns, enum values, indexes) when the plugin
 * loads, and rejects breaking changes. Every query is scoped to ONE installation (plugin × community).
 * `watch()` streams the current rows and then every change (live queries).
 *
 *   tables: {
 *     issues: t.table({ title: t.text(), status: t.enum(["open", "fixed"]).default("open"), reporter: t.ref("user") },
 *                     { indexes: [["status"]] }),
 *   }
 *   const open = await ctx.db.issues.findMany({ where: { status: "open" }, with: { reporter: true } });
 */

export type ColumnKind = "text" | "integer" | "real" | "boolean" | "timestamp" | "json" | "enum" | "ref";
export type OnDelete = "cascade" | "set null" | "restrict";

/** Platform tables a plugin column may reference with `t.ref(...)`. */
export const PLATFORM_REFS = ["user", "file"] as const;
export type PlatformRef = (typeof PLATFORM_REFS)[number];

/** Runtime description of a column (used by the host to build DDL and validate values). */
export type ColumnSpec = {
  kind: ColumnKind;
  nullable: boolean;
  hasDefault: boolean;
  default?: unknown;
  values?: readonly string[];
  target?: string;
  onDelete?: OnDelete;
};

/**
 * A column. Type parameters exist only for inference: `T` is the value type, `Optional` says whether the
 * column may be omitted on insert, `Ref` is the referenced table (never for plain columns).
 */
export interface Column<T, Optional extends boolean = false, Ref extends string = never> {
  readonly spec: ColumnSpec;
  readonly __value?: T;
  readonly __optional?: Optional;
  readonly __ref?: Ref;
  /** Nullable; may be omitted on insert (null). */
  optional(): Column<T | null, true, Ref>;
  /** May be omitted on insert; the default is applied by the host. */
  default(value: Exclude<T, null>): Column<T, true, Ref>;
}

// biome-ignore lint/suspicious/noExplicitAny: column maps hold columns of any value type
export type Columns = Record<string, Column<any, boolean, string>>;

/** Columns an index may use: declared ones and the system timestamps/author. */
export type IndexColumn<C extends Columns> = (keyof C & string) | "createdAt" | "updatedAt" | "createdBy";

export interface TableDef<C extends Columns = Columns> {
  readonly columns: C;
  /** Extra indexes (each one is prefixed with the installation id). */
  readonly indexes: readonly (readonly IndexColumn<C>[])[];
  /** Unique combinations within one installation (e.g. one report per user per issue). */
  readonly unique: readonly (readonly IndexColumn<C>[])[];
}

// biome-ignore lint/suspicious/noExplicitAny: a table map holds tables of any shape
export type Tables = Record<string, TableDef<any>>;

class ColumnImpl<T, O extends boolean, R extends string> implements Column<T, O, R> {
  constructor(readonly spec: ColumnSpec) {}
  optional(): Column<T | null, true, R> {
    return new ColumnImpl<T | null, true, R>({ ...this.spec, nullable: true });
  }
  default(value: Exclude<T, null>): Column<T, true, R> {
    return new ColumnImpl<T, true, R>({ ...this.spec, hasDefault: true, default: value });
  }
}

const column = <T, R extends string = never>(spec: Omit<ColumnSpec, "nullable" | "hasDefault">) =>
  new ColumnImpl<T, false, R>({ ...spec, nullable: false, hasDefault: false }) as Column<T, false, R>;

type RefValue<R extends string> = R extends "file" ? FileId : string;

/** Column and table builders (passed to the plugin as `t` by the host). */
export const t = {
  text: () => column<string>({ kind: "text" }),
  integer: () => column<number>({ kind: "integer" }),
  real: () => column<number>({ kind: "real" }),
  boolean: () => column<boolean>({ kind: "boolean" }),
  timestamp: () => column<Date>({ kind: "timestamp" }),
  /** Arbitrary JSON (not queryable in `where`). */
  json: <T = unknown>() => column<T>({ kind: "json" }),
  enum: <const V extends readonly [string, ...string[]]>(values: V) => column<V[number]>({ kind: "enum", values }),
  /**
   * Foreign key to a platform table ("user", "file") or to another table of this plugin.
   * onDelete defaults to "cascade" for required refs and "set null" for optional ones.
   */
  ref: <const R extends string>(target: R, opts: { onDelete?: OnDelete } = {}) =>
    column<RefValue<R>, R>({ kind: "ref", target, ...(opts.onDelete ? { onDelete: opts.onDelete } : {}) }),
  table: <const C extends Columns>(
    columns: C,
    opts: { indexes?: IndexColumn<C>[][]; unique?: IndexColumn<C>[][] } = {},
  ): TableDef<C> => ({ columns, indexes: opts.indexes ?? [], unique: opts.unique ?? [] }),
};
export type TableBuilders = typeof t;

// ─────────────────────────────── Row types ───────────────────────────────

type ValueOf<C> = C extends Column<infer T, boolean, string> ? T : never;
type OptionalOf<C> = C extends Column<unknown, infer O, string> ? O : never;
type RefOf<C> = C extends Column<unknown, boolean, infer R> ? R : never;

/** Columns every table has; managed by the host. */
export type SystemFields = { id: string; createdAt: Date; updatedAt: Date; createdBy: string | null };

export type Row<D extends TableDef> = SystemFields & { [K in keyof D["columns"]]: ValueOf<D["columns"][K]> };

export type Insert<D extends TableDef> = {
  [K in keyof D["columns"] as OptionalOf<D["columns"][K]> extends true ? never : K]: ValueOf<D["columns"][K]>;
} & {
  [K in keyof D["columns"] as OptionalOf<D["columns"][K]> extends true ? K : never]?: ValueOf<D["columns"][K]>;
};

export type Patch<D extends TableDef> = { [K in keyof D["columns"]]?: ValueOf<D["columns"][K]> };

export type Operators<V> = { eq?: V; ne?: V; gt?: V; gte?: V; lt?: V; lte?: V; in?: readonly V[] };

/** Equality (`null` = IS NULL) or operators on columns and system fields. JSON columns are not queryable. */
export type Where<D extends TableDef> = {
  [K in keyof Row<D>]?: Row<D>[K] | Operators<NonNullable<Row<D>[K]>>;
};

export type OrderBy<D extends TableDef> = { [K in keyof Row<D>]?: "asc" | "desc" };

type RefKeys<C> = { [K in keyof C]: [RefOf<C[K]>] extends [never] ? never : K }[keyof C];

/** Which foreign keys to expand (join) in the result. */
export type With<D extends TableDef> = { [K in RefKeys<D["columns"]>]?: true };

/** What a plugin sees of a platform user (never the e-mail). */
export type PublicUser = { id: string; name: string };
export type FileMeta = { id: FileId; mime: string; size: number };

type Expanded<R, TT extends Tables> = R extends "user"
  ? PublicUser
  : R extends "file"
    ? FileMeta
    : R extends keyof TT
      ? Row<TT[R]>
      : never;

export type Selected<TT extends Tables, D extends TableDef, W> = Omit<Row<D>, keyof W & string> & {
  [K in keyof W & keyof D["columns"]]:
    | Expanded<RefOf<D["columns"][K]>, TT>
    | (null extends ValueOf<D["columns"][K]> ? null : never);
};

export type FindOptions<D extends TableDef, W> = {
  where?: Where<D>;
  orderBy?: OrderBy<D>;
  /** Maximum rows; default 100, at most 1000. */
  limit?: number;
  offset?: number;
  with?: W;
};

/**
 * First event: the current rows (the snapshot). Then one event per change, relative to the rows the subscriber
 * has: a row entering the filter is `create`, a change to a row it has is `update`, a row leaving the filter or
 * deleted is `delete`. `limit` and `orderBy` shape only the snapshot; later events are not limited or reordered.
 */
export type WatchEvent<R> =
  | { type: "snapshot"; rows: R[] }
  | { type: "create" | "update"; row: R }
  | { type: "delete"; id: string };

export type WatchOptions<D extends TableDef, W> = Omit<FindOptions<D, W>, "offset">;

export interface TableClient<TT extends Tables, D extends TableDef> {
  findMany<const W extends With<D> = Record<never, never>>(query?: FindOptions<D, W>): Promise<Selected<TT, D, W>[]>;
  findFirst<const W extends With<D> = Record<never, never>>(
    query?: FindOptions<D, W>,
  ): Promise<Selected<TT, D, W> | null>;
  get<const W extends With<D> = Record<never, never>>(
    id: string,
    opts?: { with?: W },
  ): Promise<Selected<TT, D, W> | null>;
  count(query?: { where?: Where<D> }): Promise<number>;
  insert(values: Insert<D>): Promise<Row<D>>;
  /** Insert, or update the row matching the declared unique columns `on`. */
  upsert(values: Insert<D>, opts: { on: IndexColumn<D["columns"]>[] }): Promise<Row<D>>;
  update(id: string, patch: Patch<D>): Promise<Row<D> | null>;
  updateMany(where: Where<D>, patch: Patch<D>): Promise<number>;
  delete(id: string): Promise<boolean>;
  deleteMany(where: Where<D>): Promise<number>;
  /**
   * Live view of the rows matching `where`: yields a snapshot first, then creates/updates/deletes.
   * Stop it with `break` (or `return()`); the live query is closed automatically.
   */
  watch<const W extends With<D> = Record<never, never>>(
    query?: WatchOptions<D, W>,
  ): AsyncGenerator<WatchEvent<Selected<TT, D, W>>, void, undefined>;
}

/** `ctx.db`: one typed client per declared table. */
export type Database<TT extends Tables = Tables> = { [K in keyof TT]: TableClient<TT, TT[K]> };
