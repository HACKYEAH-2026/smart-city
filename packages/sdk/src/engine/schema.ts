import { RecordId, type SurrealSession } from "surrealdb";
import {
  type ColumnKind,
  type ColumnSpec,
  type Columns,
  PLATFORM_REFS,
  type TableDef,
  type Tables,
} from "../services/db";

/**
 * Plugin tables → SurrealDB schema, synced without migration files.
 * A plugin table (`p_<plugin>__<table>`, SCHEMAFULL) is shared by all installations of the plugin; every row
 * carries `installation` (record → plugin_installation, cascade) and every index is prefixed with it.
 * The declared shape of each table is stored in `plugin_schema`, so changes are compared semantically:
 * additive ones are applied (with defaults backfilled into existing rows), breaking ones are rejected.
 */

/** A declaration the host cannot apply (invalid names/refs, or a breaking change to an existing table). */
export class SchemaError extends Error {}

/** Platform tables referenced by plugin tables (names as in the host schema). */
export const HOST = {
  user: "user",
  file: "plugin_file",
  installation: "plugin_installation",
  schema: "plugin_schema",
} as const;

const TABLE_NAME = /^[a-z][a-zA-Z0-9]{0,39}$/;
const COLUMN_NAME = /^[a-z][a-zA-Z0-9]{0,39}$/;
const RESERVED = new Set(["id", "installation", "installationId", "createdAt", "updatedAt", "createdBy"]);

/** System fields: plugin-visible name → stored field name. */
export const SYSTEM_COLUMNS = {
  id: "id",
  createdAt: "created_at",
  updatedAt: "updated_at",
  createdBy: "created_by",
} as const;

export const tableName = (pluginId: string, table: string) => `p_${pluginId.replaceAll("-", "_")}__${table}`;
/** Identifiers are validated (letters, digits, underscores); backticks guard against reserved words. */
export const ident = (name: string) => `\`${name}\``;

const BASE_TYPES: Record<ColumnKind, (spec: ColumnSpec, pluginId: string) => string> = {
  text: () => "string",
  integer: () => "int",
  real: () => "float",
  boolean: () => "bool",
  timestamp: () => "datetime",
  json: () => "any",
  enum: (spec) => (spec.values ?? []).map((v) => JSON.stringify(v)).join(" | "),
  ref: (spec, pluginId) => `record<${refTable(pluginId, spec)}>`,
};

/** The table a ref column points to. */
export function refTable(pluginId: string, spec: ColumnSpec): string {
  if (spec.target === "user") return HOST.user;
  if (spec.target === "file") return HOST.file;
  return tableName(pluginId, spec.target as string);
}

export const onDeleteOf = (spec: ColumnSpec) => spec.onDelete ?? (spec.nullable ? "set null" : "cascade");
const ON_DELETE = { cascade: "CASCADE", "set null": "UNSET", restrict: "REJECT" } as const;

// ───────────────────────────── static validation ─────────────────────────────

/** Static checks of a plugin's table declarations (run when the plugin is loaded). */
export function validateTables(tables: Tables): void {
  for (const [name, table] of Object.entries(tables)) validateTable(name, table, tables);
}

function validateTable(name: string, table: TableDef, tables: Tables): void {
  if (!TABLE_NAME.test(name)) throw new SchemaError(`Table "${name}": use camelCase letters/digits, start lowercase`);
  if (!table || typeof table.columns !== "object") throw new SchemaError(`Table "${name}": use t.table({...})`);
  const columns = Object.entries(table.columns as Columns);
  if (!columns.length) throw new SchemaError(`Table "${name}" has no columns`);
  for (const [col, column] of columns) validateColumn(`${name}.${col}`, col, column?.spec, tables);
  const unknown = [...table.indexes, ...table.unique]
    .flat()
    .find((col) => !(col in table.columns) && !(col in SYSTEM_COLUMNS));
  if (unknown) throw new SchemaError(`Table "${name}": index refers to unknown column "${unknown}"`);
  if ([...table.indexes, ...table.unique].some((index) => !index.length)) {
    throw new SchemaError(`Table "${name}": empty index`);
  }
}

function validateColumn(where: string, col: string, spec: ColumnSpec | undefined, tables: Tables): void {
  if (!COLUMN_NAME.test(col)) throw new SchemaError(`Column "${where}": use camelCase letters/digits`);
  if (RESERVED.has(col)) throw new SchemaError(`Column "${where}" is reserved (system field)`);
  if (!spec || !(spec.kind in BASE_TYPES)) throw new SchemaError(`Column "${where}": use t.text(), t.ref(...) etc.`);
  if (spec.kind === "enum" && !spec.values?.length) throw new SchemaError(`Column "${where}": enum needs values`);
  if (spec.kind !== "ref") return;
  const target = spec.target ?? "";
  if (!(PLATFORM_REFS as readonly string[]).includes(target) && !(target in tables)) {
    throw new SchemaError(`Column "${where}" references unknown table "${target}"`);
  }
  if (spec.onDelete === "set null" && !spec.nullable) {
    throw new SchemaError(`Column "${where}": onDelete "set null" requires .optional()`);
  }
}

// ─────────────────────────────────── DDL ───────────────────────────────────

/** Column description stored in plugin_schema and compared on the next sync. */
type StoredColumn = Pick<ColumnSpec, "kind" | "nullable" | "values" | "target" | "onDelete">;
type StoredTable = Record<string, StoredColumn>;

const stored = (pluginId: string, spec: ColumnSpec): StoredColumn => ({
  kind: spec.kind,
  nullable: spec.nullable,
  ...(spec.values ? { values: [...spec.values] } : {}),
  ...(spec.kind === "ref" ? { target: refTable(pluginId, spec), onDelete: onDeleteOf(spec) } : {}),
});

function fieldDdl(pluginId: string, table: string, col: string, spec: ColumnSpec, overwrite: boolean): string {
  const base = BASE_TYPES[spec.kind](spec, pluginId);
  // `any` already admits NONE (option<any> is invalid); required JSON is enforced by the engine.
  const type = spec.nullable && spec.kind !== "json" ? `option<${base}>` : base;
  const reference = spec.kind === "ref" ? ` REFERENCE ON DELETE ${ON_DELETE[onDeleteOf(spec)]}` : "";
  const mode = overwrite ? "OVERWRITE" : "IF NOT EXISTS";
  return `DEFINE FIELD ${mode} ${ident(col)} ON ${ident(table)} TYPE ${type}${reference};`;
}

function systemDdl(table: string): string[] {
  const t = ident(table);
  return [
    `DEFINE TABLE IF NOT EXISTS ${t} SCHEMAFULL;`,
    `DEFINE FIELD IF NOT EXISTS installation ON ${t} TYPE record<${HOST.installation}> REFERENCE ON DELETE CASCADE;`,
    `DEFINE FIELD IF NOT EXISTS created_at ON ${t} TYPE datetime;`,
    `DEFINE FIELD IF NOT EXISTS updated_at ON ${t} TYPE datetime;`,
    `DEFINE FIELD IF NOT EXISTS created_by ON ${t} TYPE option<record<${HOST.user}>> REFERENCE ON DELETE UNSET;`,
    `DEFINE INDEX IF NOT EXISTS ${ident(`${table}__created`)} ON ${t} FIELDS installation, created_at;`,
  ];
}

const fieldName = (col: string) => (col in SYSTEM_COLUMNS ? SYSTEM_COLUMNS[col as keyof typeof SYSTEM_COLUMNS] : col);

function indexDdl(table: string, cols: readonly string[], unique: boolean): string {
  const name = `${table}__${unique ? "u" : "i"}_${cols.join("_")}`;
  const fields = ["installation", ...cols.map(fieldName)].map(ident).join(", ");
  return `DEFINE INDEX IF NOT EXISTS ${ident(name)} ON ${ident(table)} FIELDS ${fields}${unique ? " UNIQUE" : ""};`;
}

// ─────────────────────────────── planning ───────────────────────────────

export type Plan = { statements: string[]; vars: Record<string, unknown> };

const sameColumn = (a: StoredColumn, b: StoredColumn) =>
  a.kind === b.kind &&
  a.nullable === b.nullable &&
  a.target === b.target &&
  a.onDelete === b.onDelete &&
  JSON.stringify(a.values ?? []) === JSON.stringify(b.values ?? []);

/** Enum that only gained values: compatible (every stored value is still valid). */
const extendsEnum = (before: StoredColumn, after: StoredColumn) =>
  before.kind === "enum" &&
  after.kind === "enum" &&
  before.nullable === after.nullable &&
  (before.values ?? []).every((v) => after.values?.includes(v));

function changeError(where: string, before: StoredColumn, after: StoredColumn): SchemaError {
  if (before.kind !== after.kind)
    return new SchemaError(`Column "${where}" changed type (${before.kind} → ${after.kind})`);
  if (before.nullable !== after.nullable) {
    return new SchemaError(`Column "${where}" changed nullability; add a new column instead`);
  }
  if (before.kind === "enum") return new SchemaError(`Column "${where}" removed enum values; add a new column instead`);
  return new SchemaError(`Column "${where}" changed its reference; add a new column instead`);
}

function newColumn(pluginId: string, table: string, where: string, col: string, spec: ColumnSpec, vars: Plan["vars"]) {
  if (!spec.nullable && !spec.hasDefault) {
    throw new SchemaError(`New column "${where}" must be .optional() or have .default(...)`);
  }
  if (spec.kind === "ref" && !spec.nullable)
    throw new SchemaError(`New reference column "${where}" must be .optional()`);
  if (!spec.hasDefault) return [fieldDdl(pluginId, table, col, spec, false)];
  const key = `default_${table}_${col}`;
  vars[key] = spec.default;
  // Declare first (SCHEMAFULL rejects undeclared fields), then backfill rows written before the column existed.
  return [
    fieldDdl(pluginId, table, col, spec, false),
    `UPDATE ${ident(table)} SET ${ident(col)} = $${key} WHERE ${ident(col)} = NONE;`,
  ];
}

function planColumn(
  pluginId: string,
  table: string,
  where: string,
  col: string,
  spec: ColumnSpec,
  before: StoredColumn | undefined,
  vars: Plan["vars"],
): string[] {
  if (!before) return newColumn(pluginId, table, where, col, spec, vars);
  const after = stored(pluginId, spec);
  if (sameColumn(before, after)) return [];
  if (extendsEnum(before, after)) return [fieldDdl(pluginId, table, col, spec, true)];
  throw changeError(where, before, after);
}

function planTable(pluginId: string, name: string, def: TableDef, before: StoredTable | undefined, vars: Plan["vars"]) {
  const table = tableName(pluginId, name);
  const removed = Object.entries(before ?? {}).find(([col, c]) => !(col in def.columns) && !c.nullable);
  if (removed) throw new SchemaError(`Required column "${name}.${removed[0]}" was removed; make it .optional() first`);
  // A new table has no rows yet: every column is created as declared. Existing tables only grow additively.
  const columns = Object.entries(def.columns as Columns).flatMap(([col, column]) =>
    before
      ? planColumn(pluginId, table, `${name}.${col}`, col, column.spec, before[col], vars)
      : [fieldDdl(pluginId, table, col, column.spec, false)],
  );
  const schemaKey = `schema_${table}`;
  vars[`id_${schemaKey}`] = new RecordId(HOST.schema, table);
  vars[schemaKey] = Object.fromEntries(
    Object.entries(def.columns as Columns).map(([col, column]) => [col, stored(pluginId, column.spec)]),
  );
  return [
    ...systemDdl(table),
    ...columns,
    ...def.indexes.map((cols) => indexDdl(table, cols, false)),
    ...def.unique.map((cols) => indexDdl(table, cols, true)),
    `UPSERT $id_${schemaKey} SET columns = $${schemaKey};`,
  ];
}

async function storedSchema(
  db: SurrealSession,
  pluginId: string,
  names: string[],
): Promise<Record<string, StoredTable>> {
  const [, rows] = await db.query<[unknown, { key: string; columns: StoredTable }[]]>(
    `DEFINE TABLE IF NOT EXISTS ${HOST.schema} SCHEMALESS;
     SELECT meta::id(id) AS key, columns FROM ${HOST.schema} WHERE meta::id(id) IN $ids;`,
    { ids: names.map((n) => tableName(pluginId, n)) },
  );
  return Object.fromEntries(rows.map((r) => [r.key, r.columns]));
}

/** Statements bringing the database to the declared shape; throws SchemaError for breaking changes. */
export async function planSchema(db: SurrealSession, pluginId: string, tables: Tables): Promise<Plan> {
  validateTables(tables);
  const before = await storedSchema(db, pluginId, Object.keys(tables));
  const vars: Plan["vars"] = {};
  const statements = Object.entries(tables).flatMap(([name, def]) =>
    planTable(pluginId, name, def, before[tableName(pluginId, name)], vars),
  );
  return { statements, vars };
}

/** Applies the plan in one transaction; a failing statement (e.g. duplicates for a new unique index) rolls back. */
export async function syncSchema(db: SurrealSession, pluginId: string, tables: Tables): Promise<void> {
  const plan = await planSchema(db, pluginId, tables);
  try {
    await db.query(["BEGIN TRANSACTION;", ...plan.statements, "COMMIT TRANSACTION;"].join("\n"), plan.vars);
  } catch (err) {
    throw new SchemaError(`Cannot apply tables of "${pluginId}": ${(err as Error).message}`);
  }
}
