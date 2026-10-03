import { RecordId, type SurrealSession, Table } from "surrealdb";
import type { ColumnKind, ColumnSpec, Database, TableDef, Tables } from "../services/db";
import { HOST, ident, refTable, SYSTEM_COLUMNS, tableName } from "./schema";

/**
 * Runtime implementation of `ctx.db` on SurrealDB. The plugin never writes SurrealQL: every statement is
 * built here with bound variables and is always restricted to one installation. References are checked to
 * point to rows of the same installation (or a platform user / a file uploaded to this installation);
 * referencing a pending upload confirms it. `watch()` combines a snapshot with a live query.
 */

/** Invalid value, unknown reference or violated constraint — a plugin/caller error with a safe message. */
export class DbError extends Error {}

type Spec = Pick<ColumnSpec, "kind" | "nullable"> & Partial<ColumnSpec>;
type Raw = Record<string, unknown> & { id: RecordId };
type Row = Record<string, unknown> & { id: string };
type Vars = Record<string, unknown>;

const MAX_LIMIT = 1000;
const SYSTEM_SPECS: Record<keyof typeof SYSTEM_COLUMNS, Spec> = {
  id: { kind: "ref", nullable: false },
  createdAt: { kind: "timestamp", nullable: false },
  updatedAt: { kind: "timestamp", nullable: false },
  createdBy: { kind: "ref", nullable: true, target: "user" },
};
const OPERATORS: Record<string, string> = { eq: "=", ne: "!=", gt: ">", gte: ">=", lt: "<", lte: "<=" };

const isOperators = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !(v instanceof Date) && !Array.isArray(v);

/** SurrealDB DateTime (has toDate()) or Date → Date. */
const toDate = (v: unknown) => (v instanceof Date ? v : (v as { toDate(): Date }).toDate());
const idOf = (v: unknown) => String((v as RecordId).id);

/** Validated plain value → SurrealDB value. `null` stays null (written as NONE by the caller). */
function encode(spec: Spec, value: unknown, label: string, strict: boolean, target?: string): unknown {
  if (value === null || value === undefined) {
    if (!spec.nullable && strict) throw new DbError(`${label} cannot be null`);
    return null;
  }
  const fail = (expected: string): never => {
    throw new DbError(`${label} must be ${expected}`);
  };
  const kind: ColumnKind = spec.kind;
  switch (kind) {
    case "text":
      return typeof value === "string" ? value : fail("a string");
    case "ref":
      return typeof value === "string" ? new RecordId(target as string, value) : fail("an id (string)");
    case "enum":
      if (typeof value !== "string") return fail("a string");
      if (strict && !spec.values?.includes(value)) return fail(`one of ${spec.values?.join(", ")}`);
      return value;
    case "integer":
      return Number.isInteger(value) ? value : fail("an integer");
    case "real":
      return typeof value === "number" && Number.isFinite(value) ? value : fail("a number");
    case "boolean":
      return typeof value === "boolean" ? value : fail("a boolean");
    case "timestamp":
      return value instanceof Date && !Number.isNaN(value.getTime()) ? value : fail("a Date");
    case "json":
      return value;
  }
}

function decode(spec: Spec, raw: unknown): unknown {
  if (raw === undefined || raw === null) return null;
  if (spec.kind === "ref") return idOf(raw);
  if (spec.kind === "timestamp") return toDate(raw);
  return raw;
}

function translateError(err: unknown, table: string): never {
  const message = (err as Error).message ?? String(err);
  if (message.includes("already contains")) throw new DbError(`${table}: unique constraint violated`);
  if (message.includes("ON DELETE REJECT")) throw new DbError(`${table}: the row is still referenced (restrict)`);
  if (message.includes("Couldn't coerce")) throw new DbError(`${table}: ${message}`);
  throw err;
}

const MAX_ATTEMPTS = 5;
const retryable = (err: unknown) => String((err as Error)?.message ?? err).includes("can be retried");

/** Runs a transaction again when the engine reports a retryable conflict (concurrent writes to the same rows). */
function retrying<T>(run: () => Promise<T>, attempts = MAX_ATTEMPTS): Promise<T> {
  return run().catch((err) => (attempts > 1 && retryable(err) ? retrying(run, attempts - 1) : Promise.reject(err)));
}

/** Push-based async queue (live query notifications → async iteration). */
function asyncQueue<T>() {
  const items: T[] = [];
  const state: { wake: (() => void) | null; closed: boolean } = { wake: null, closed: false };
  const waitForItem = () =>
    new Promise<void>((resolve) => {
      state.wake = resolve;
    });
  return {
    push(item: T) {
      items.push(item);
      state.wake?.();
    },
    close() {
      state.closed = true;
      state.wake?.();
    },
    async *drain(): AsyncGenerator<T> {
      while (!state.closed) {
        const next = items.shift();
        if (next !== undefined) yield next;
        else await waitForItem();
      }
    },
  };
}

/** The same filter as the SurrealQL WHERE, evaluated in JS (for live notifications). */
function matches(row: Row, where: Record<string, unknown> = {}): boolean {
  const cmp = (v: unknown) => (v instanceof Date ? v.getTime() : v);
  return Object.entries(where).every(([key, cond]) => {
    if (cond === undefined) return true;
    const actual = cmp(row[key]);
    if (cond === null) return actual === null;
    if (!isOperators(cond)) return actual === cmp(cond);
    return Object.entries(cond).every(([op, v]) => {
      if (op === "in") return (v as unknown[]).map(cmp).includes(actual);
      const [a, b] = [actual as number, cmp(v) as number];
      return { eq: a === b, ne: a !== b, gt: a > b, gte: a >= b, lt: a < b, lte: a <= b }[op] ?? false;
    });
  });
}

export function createDatabase<TT extends Tables>(opts: {
  surreal: SurrealSession;
  pluginId: string;
  tables: TT;
  installationId: string;
  /** Author of writes (createdBy, file ownership); null for the system (onInstall). */
  userId: string | null;
  now?: () => Date;
}): Database<TT> {
  const { surreal, pluginId, tables, installationId, userId } = opts;
  const now = opts.now ?? (() => new Date());
  const installation = new RecordId(HOST.installation, installationId);
  /** Result of the last statement. */
  const query = async <T>(sql: string, vars: Vars): Promise<T[]> =>
    ((await surreal.query(sql, vars)) as unknown[]).at(-1) as T[];

  const client = (name: string, def: TableDef) => {
    const table = tableName(pluginId, name);
    const label = (col: string) => `${name}.${col}`;
    const recordId = (id: string) => new RecordId(table, id);

    const specOf = (key: string): { field: string; spec: Spec; target: string } => {
      if (key in SYSTEM_COLUMNS) {
        const k = key as keyof typeof SYSTEM_COLUMNS;
        return { field: SYSTEM_COLUMNS[k], spec: SYSTEM_SPECS[k], target: k === "id" ? table : HOST.user };
      }
      const column = def.columns[key];
      if (!column) throw new DbError(`${name}: unknown column "${key}"`);
      return {
        field: key,
        spec: column.spec,
        target: column.spec.kind === "ref" ? refTable(pluginId, column.spec) : "",
      };
    };

    const decodeRow = (raw: Raw): Row => ({
      id: idOf(raw.id),
      createdAt: toDate(raw.created_at),
      updatedAt: toDate(raw.updated_at),
      createdBy: raw.created_by ? idOf(raw.created_by) : null,
      ...Object.fromEntries(Object.entries(def.columns).map(([col, c]) => [col, decode(c.spec, raw[col])])),
    });

    /** WHERE clause (always scoped to the installation) and its variables. */
    const compileWhere = (where: Record<string, unknown> = {}) => {
      const vars: Vars = { installation };
      const bind = (value: unknown) => {
        const key = `w${Object.keys(vars).length}`;
        vars[key] = value;
        return `$${key}`;
      };
      const condition = (key: string, cond: unknown): string[] => {
        const { field, spec, target } = specOf(key);
        if (spec.kind === "json") throw new DbError(`${label(key)}: JSON columns cannot be filtered`);
        const col = ident(field);
        const value = (v: unknown) => encode(spec, v, label(key), false, target);
        if (cond === null) return [`${col} = NONE`];
        if (!isOperators(cond)) return [`${col} = ${bind(value(cond))}`];
        return Object.entries(cond)
          .filter(([, v]) => v !== undefined)
          .map(([op, v]) => {
            if (op === "in") return `${col} IN ${bind((v as unknown[]).map(value))}`;
            const sqlOp = OPERATORS[op];
            if (!sqlOp) throw new DbError(`${label(key)}: unknown operator "${op}"`);
            return `${col} ${sqlOp} ${bind(value(v))}`;
          });
      };
      const parts = Object.entries(where)
        .filter(([, cond]) => cond !== undefined)
        .flatMap(([key, cond]) => condition(key, cond));
      return { sql: ["installation = $installation", ...parts].join(" AND "), vars };
    };

    /** Validates one reference; returns a pending file to confirm with the write, if any. */
    const checkRef = async (col: string, spec: ColumnSpec, value: RecordId): Promise<RecordId[]> => {
      if (spec.target === "user") {
        const [exists] = await query<boolean>("RETURN [record::exists($r)];", { r: value });
        if (!exists) throw new DbError(`${label(col)}: unknown user`);
        return [];
      }
      if (spec.target === "file") {
        const [file] = await query<{ installation: RecordId; status: string; uploaded_by?: RecordId }>(
          "SELECT installation, status, uploaded_by FROM $r;",
          { r: value },
        );
        if (!file || idOf(file.installation) !== installationId) throw new DbError(`${label(col)}: unknown file`);
        if (file.status !== "pending") return [];
        if (!file.uploaded_by || idOf(file.uploaded_by) !== userId) {
          throw new DbError(`${label(col)}: file was uploaded by another user`);
        }
        return [value];
      }
      const [row] = await query<{ installation: RecordId }>("SELECT installation FROM $r;", { r: value });
      if (!row || idOf(row.installation) !== installationId)
        throw new DbError(`${label(col)}: unknown ${spec.target} id`);
      return [];
    };

    const checkRefs = async (values: Record<string, unknown>): Promise<RecordId[]> => {
      const refs = Object.entries(values).flatMap(([col, value]) => {
        const spec = def.columns[col]?.spec;
        return spec?.kind === "ref" && value instanceof RecordId ? [[col, spec, value] as const] : [];
      });
      return (await Promise.all(refs.map(([col, spec, value]) => checkRef(col, spec, value)))).flat();
    };

    /**
     * Runs a write (after optional `prelude` statements) and the file confirmations in one transaction;
     * returns the rows of the write.
     */
    const write = async (sql: string, vars: Vars, values: Record<string, unknown>, prelude = ""): Promise<Raw[]> => {
      const files = await checkRefs(values);
      const statements = [
        "BEGIN TRANSACTION;",
        prelude,
        `LET $result = (${sql});`,
        files.length ? `UPDATE ${HOST.file} SET status = "kept" WHERE id IN $files;` : "",
        "COMMIT TRANSACTION;",
        "RETURN $result;",
      ].join("\n");
      try {
        return (await retrying(() => query<Raw>(statements, { ...vars, files }))) ?? [];
      } catch (err) {
        return translateError(err, name);
      }
    };

    /** SET clause: values, NONE for nulls (optional fields) and the update timestamp. */
    const setClause = (values: Record<string, unknown>) => {
      const vars: Vars = { setNow: now() };
      const sets = Object.entries(values).map(([col, v], i) => {
        if (v === null) return `${ident(col)} = NONE`;
        vars[`set${i}`] = v;
        return `${ident(col)} = $set${i}`;
      });
      return { sql: [...sets, "updated_at = $setNow"].join(", "), vars };
    };

    const valueFor = (spec: ColumnSpec, raw: unknown, col: string) => {
      if (raw !== undefined) return raw;
      if (spec.hasDefault) return spec.default;
      if (spec.nullable) return null;
      throw new DbError(`${label(col)} is required`);
    };

    const encodeValues = (input: Record<string, unknown>, mode: "insert" | "patch") => {
      const unknown = Object.keys(input).find((key) => !(key in def.columns));
      if (unknown) throw new DbError(`${name}: unknown column "${unknown}"`);
      const columns = Object.entries(def.columns).filter(([col]) => mode === "insert" || input[col] !== undefined);
      return Object.fromEntries(
        columns.map(([col, { spec }]) => {
          const target = spec.kind === "ref" ? refTable(pluginId, spec) : undefined;
          return [col, encode(spec, valueFor(spec, input[col], col), label(col), true, target)];
        }),
      ) as Record<string, unknown>;
    };

    /** Plain value of a unique-key column as it will be stored: the input, else the default, else null. */
    const keyValue = (col: string, input: Record<string, unknown>): unknown => {
      if (col === "createdBy") return userId;
      if (col in SYSTEM_COLUMNS) throw new DbError(`${name}: upsert cannot match on "${col}"`);
      const spec = def.columns[col]?.spec;
      return input[col] !== undefined ? input[col] : spec?.hasDefault ? spec.default : null;
    };

    const content = (values: Record<string, unknown>) => {
      const at = now();
      return {
        installation,
        created_at: at,
        updated_at: at,
        ...(userId ? { created_by: new RecordId(HOST.user, userId) } : {}),
        ...Object.fromEntries(Object.entries(values).filter(([, v]) => v !== null)),
      };
    };

    /** Referenced rows by id: platform users/files or rows of another table of this plugin. */
    const lookup = async (spec: ColumnSpec, ids: string[]): Promise<Map<string, unknown>> => {
      const target = refTable(pluginId, spec);
      const vars = { ids: ids.map((id) => new RecordId(target, id)), installation };
      if (spec.target === "user") {
        const users = await query<{ id: RecordId; name: string }>(
          `SELECT id, name FROM ${HOST.user} WHERE id IN $ids;`,
          vars,
        );
        return new Map(users.map((u) => [idOf(u.id), { id: idOf(u.id), name: u.name }]));
      }
      if (spec.target === "file") {
        const files = await query<{ id: RecordId; mime: string; size: number }>(
          `SELECT id, mime, size FROM ${HOST.file} WHERE id IN $ids AND installation = $installation;`,
          vars,
        );
        return new Map(files.map((f) => [idOf(f.id), { id: idOf(f.id), mime: f.mime, size: f.size }]));
      }
      const rows = (await clients[spec.target as string]?.byIds(ids)) ?? [];
      return new Map(rows.map((r) => [r.id, r]));
    };

    const expand = async (rows: Row[], withSpec: Record<string, unknown> = {}) => {
      const enabled = Object.entries(withSpec).filter(([, on]) => on);
      for (const [col] of enabled) {
        const spec = def.columns[col]?.spec;
        if (spec?.kind !== "ref") throw new DbError(`${label(col)}: only reference columns can be expanded`);
        const ids = [...new Set(rows.map((r) => r[col]).filter((v): v is string => typeof v === "string"))];
        const found = ids.length ? await lookup(spec, ids) : new Map<string, unknown>();
        for (const row of rows)
          row[col] = typeof row[col] === "string" ? (found.get(row[col] as string) ?? null) : null;
      }
      return rows;
    };

    const orderSql = (orderBy: Record<string, unknown> = {}) => {
      const parts = Object.entries(orderBy).map(([key, dir]) => {
        if (dir !== "asc" && dir !== "desc") throw new DbError(`${name}: order must be "asc" or "desc"`);
        return `${ident(specOf(key).field)} ${dir.toUpperCase()}`;
      });
      return [...parts, "created_at DESC", "id DESC"].join(", ");
    };

    type Find = { where?: object; orderBy?: object; limit?: number; offset?: number; with?: object };
    const findMany = async (q: Find = {}) => {
      const w = compileWhere(q.where as Record<string, unknown>);
      const rows = await query<Raw>(
        `SELECT * FROM ${ident(table)} WHERE ${w.sql} ORDER BY ${orderSql(q.orderBy as Record<string, unknown>)} LIMIT $limit START $offset;`,
        { ...w.vars, limit: Math.min(q.limit ?? 100, MAX_LIMIT), offset: q.offset ?? 0 },
      );
      return expand(rows.map(decodeRow), q.with as Record<string, unknown>);
    };

    const deleteWhere = async (sql: string, vars: Vars) => {
      try {
        return (await retrying(() => query<Raw>(sql, vars))).length;
      } catch (err) {
        return translateError(err, name);
      }
    };

    const api = {
      findMany,
      findFirst: async (q: Find = {}) => (await findMany({ ...q, limit: 1 }))[0] ?? null,
      get: async (id: string, o: { with?: object } = {}) =>
        (await findMany({ where: { id }, limit: 1, ...o }))[0] ?? null,
      count: async (q: { where?: object } = {}) => {
        const w = compileWhere(q.where as Record<string, unknown>);
        const [row] = await query<{ count: number }>(
          `SELECT count() FROM ${ident(table)} WHERE ${w.sql} GROUP ALL;`,
          w.vars,
        );
        return Number(row?.count ?? 0);
      },
      insert: async (input: Record<string, unknown>) => {
        const values = encodeValues(input, "insert");
        const vars = { rid: recordId(crypto.randomUUID()), data: content(values) };
        const [raw] = await write("CREATE $rid CONTENT $data RETURN AFTER", vars, values);
        return decodeRow(raw as Raw);
      },
      upsert: async (input: Record<string, unknown>, o: { on: string[] }) => {
        const key = [...o.on].sort().join(",");
        const unique = def.unique.find((cols) => [...cols].sort().join(",") === key);
        if (!unique) throw new DbError(`${name}: upsert "on" must match a declared unique (${o.on.join(", ")})`);
        const values = encodeValues(input, "insert");
        // Matched on the values that will be written (defaults applied), so an omitted column cannot widen the match.
        const match = compileWhere(Object.fromEntries(unique.map((c) => [c, keyValue(c, input)])));
        const set = setClause(values);
        // One transaction: find the row, then update it or create it (a concurrent duplicate fails on the unique index).
        const [raw] = await write(
          `IF $existing { (UPDATE $existing SET ${set.sql} RETURN AFTER) } ELSE { (CREATE $rid CONTENT $data RETURN AFTER) }`,
          { ...match.vars, ...set.vars, rid: recordId(crypto.randomUUID()), data: content(values) },
          values,
          `LET $existing = (SELECT VALUE id FROM ${ident(table)} WHERE ${match.sql} LIMIT 1)[0];`,
        );
        return decodeRow(raw as Raw);
      },
      update: async (id: string, patch: Record<string, unknown>) => {
        const values = encodeValues(patch, "patch");
        const set = setClause(values);
        const rows = await write(
          `UPDATE $rid SET ${set.sql} WHERE installation = $installation RETURN AFTER`,
          { ...set.vars, rid: recordId(id), installation },
          values,
        );
        return rows[0] ? decodeRow(rows[0]) : null;
      },
      updateMany: async (where: object, patch: Record<string, unknown>) => {
        const values = encodeValues(patch, "patch");
        const w = compileWhere(where as Record<string, unknown>);
        const set = setClause(values);
        const rows = await write(
          `UPDATE ${ident(table)} SET ${set.sql} WHERE ${w.sql} RETURN AFTER`,
          { ...w.vars, ...set.vars },
          values,
        );
        return rows.length;
      },
      delete: async (id: string) =>
        (await deleteWhere("DELETE $rid WHERE installation = $installation RETURN BEFORE;", {
          rid: recordId(id),
          installation,
        })) > 0,
      deleteMany: async (where: object) => {
        const w = compileWhere(where as Record<string, unknown>);
        return deleteWhere(`DELETE ${ident(table)} WHERE ${w.sql} RETURN BEFORE;`, w.vars);
      },
      watch: async function* (q: Omit<Find, "offset"> = {}) {
        const live = await surreal.live(new Table(table));
        await (live as unknown as { ready?: () => Promise<void> }).ready?.();
        const queue = asyncQueue<{ action: string; value: Raw }>();
        const off = live.subscribe((m) => queue.push({ action: m.action, value: m.value as Raw }));
        try {
          const snapshot = await findMany(q);
          // Rows the subscriber has: events are relative to this set (a row entering the filter is a create,
          // leaving it is a delete; changes to rows it never had are skipped).
          const seen = new Set(snapshot.map((r) => r.id));
          yield { type: "snapshot" as const, rows: snapshot };
          for await (const message of queue.drain()) {
            const raw = message.value;
            if (!raw?.installation || idOf(raw.installation) !== installationId) continue;
            const row = decodeRow(raw);
            const had = seen.delete(row.id);
            const visible = message.action !== "DELETE" && matches(row, q.where as Record<string, unknown>);
            if (!visible) {
              if (had) yield { type: "delete" as const, id: row.id };
              continue;
            }
            seen.add(row.id);
            const [expanded] = await expand([row], q.with as Record<string, unknown>);
            yield { type: had ? ("update" as const) : ("create" as const), row: expanded };
          }
        } finally {
          off();
          queue.close();
          await live.kill();
        }
      },
    };

    return {
      api,
      byIds: async (ids: string[]) =>
        (
          await query<Raw>(`SELECT * FROM ${ident(table)} WHERE id IN $ids AND installation = $installation;`, {
            ids: ids.map(recordId),
            installation,
          })
        ).map(decodeRow),
    };
  };

  const clients: Record<string, ReturnType<typeof client>> = {};
  for (const [name, def] of Object.entries(tables)) clients[name] = client(name, def);
  return Object.fromEntries(Object.entries(clients).map(([name, c]) => [name, c.api])) as unknown as Database<TT>;
}
