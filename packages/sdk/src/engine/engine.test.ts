import { beforeEach, describe, expect, test } from "bun:test";
import { RecordId, type SurrealSession, surql } from "surrealdb";
import { type TableDef, type Tables, t } from "../services/db";
import { testDatabase } from "../testing";
import { createDatabase, DbError } from "./client";
import { PLATFORM_SCHEMA } from "./platform";
import { HOST, SchemaError, syncSchema, validateTables } from "./schema";

const tables = {
  issues: t.table(
    {
      title: t.text(),
      status: t.enum(["open", "fixed"]).default("open"),
      votes: t.integer().default(0),
      urgent: t.boolean().default(false),
      meta: t.json<{ tags: string[] }>().optional(),
      reporter: t.ref("user"),
      photo: t.ref("file").optional(),
    },
    { indexes: [["status"]] },
  ),
  reports: t.table(
    { issue: t.ref("issues"), author: t.ref("user"), note: t.text().default("") },
    { unique: [["issue", "author"]] },
  ),
  labels: t.table(
    { name: t.text(), scope: t.text().default("global"), color: t.text().optional() },
    { unique: [["name", "scope"]] },
  ),
  pins: t.table({ issue: t.ref("issues", { onDelete: "restrict" }) }),
};

let surreal: SurrealSession;
const db = (installationId: string, userId: string | null = "alice") =>
  createDatabase({ surreal, pluginId: "issues", tables, installationId, userId });
const upload = (id: string, installation: string, by: string) =>
  surreal.query(
    surql`CREATE ${new RecordId(HOST.file, id)} CONTENT ${{
      installation: new RecordId(HOST.installation, installation),
      uploaded_by: new RecordId(HOST.user, by),
      mime: "image/jpeg",
      size: 1,
    }};`,
  );
const fileStatus = async (id: string) => {
  const [rows] = await surreal.query(surql<[{ status: string }[]]>`SELECT status FROM ${new RecordId(HOST.file, id)};`);
  return rows[0]?.status;
};

beforeEach(async () => {
  surreal = await testDatabase();
  await surreal.query(PLATFORM_SCHEMA);
  await surreal.query(surql`
    CREATE user:alice SET name = "Alice"; CREATE user:bob SET name = "Bob";
    CREATE plugin_installation:krakow; CREATE plugin_installation:gdansk;`);
  await syncSchema(surreal, "issues", tables);
});

describe("tables and values", () => {
  test("insert applies defaults and system fields; values round-trip with their types", async () => {
    const row = await db("krakow").issues.insert({ title: "Latarnia", reporter: "alice", meta: { tags: ["noc"] } });
    expect(row).toMatchObject({ title: "Latarnia", status: "open", votes: 0, urgent: false, createdBy: "alice" });
    expect(row.createdAt).toBeInstanceOf(Date);
    expect(row.meta).toEqual({ tags: ["noc"] });
    expect(row.photo).toBeNull();
  });

  test("rejects missing required columns, bad types, unknown columns and enum values", async () => {
    const issues = db("krakow").issues;
    await expect(issues.insert({ reporter: "alice" } as never)).rejects.toThrow("issues.title is required");
    await expect(issues.insert({ title: 1, reporter: "alice" } as never)).rejects.toThrow("must be a string");
    await expect(issues.insert({ title: "x", reporter: "alice", nope: 1 } as never)).rejects.toThrow("unknown column");
    await expect(issues.insert({ title: "x", reporter: "alice", status: "closed" } as never)).rejects.toThrow(
      "one of open, fixed",
    );
  });

  test("update merges a patch, null clears an optional column; delete removes", async () => {
    const issues = db("krakow").issues;
    const row = await issues.insert({ title: "Dziura", reporter: "alice", meta: { tags: [] } });
    const updated = await issues.update(row.id, { status: "fixed", votes: 3, meta: null });
    expect(updated).toMatchObject({ title: "Dziura", status: "fixed", votes: 3, meta: null });
    expect(await issues.delete(row.id)).toBe(true);
    expect(await issues.get(row.id)).toBeNull();
  });
});

describe("queries", () => {
  test("where with equality, operators, IN and null; orderBy; count", async () => {
    const issues = db("krakow").issues;
    for (const [title, votes] of [
      ["a", 1],
      ["b", 5],
      ["c", 9],
    ] as const) {
      await issues.insert({ title, votes, reporter: "alice" });
    }
    const hot = await issues.findMany({ where: { votes: { gte: 5 } }, orderBy: { votes: "asc" } });
    expect(hot.map((r) => r.title)).toEqual(["b", "c"]);
    expect((await issues.findMany({ where: { title: { in: ["a", "c"] } } })).length).toBe(2);
    expect(await issues.count({ where: { photo: null } })).toBe(3);
    expect(await issues.count({ where: { status: "fixed" } })).toBe(0);
    expect(await issues.findFirst({ orderBy: { votes: "desc" } })).toMatchObject({ title: "c" });
  });

  test("with expands references to users and own tables", async () => {
    const issue = await db("krakow").issues.insert({ title: "Latarnia", reporter: "alice" });
    await db("krakow", "bob").reports.insert({ issue: issue.id, author: "bob", note: "też widzę" });
    const [report] = await db("krakow").reports.findMany({ with: { issue: true, author: true } });
    expect(report?.author).toEqual({ id: "bob", name: "Bob" });
    expect(report?.issue).toMatchObject({ id: issue.id, title: "Latarnia" });
  });

  test("JSON columns cannot be filtered", async () => {
    await expect(db("krakow").issues.findMany({ where: { meta: { tags: [] } } as never })).rejects.toThrow(
      "JSON columns cannot be filtered",
    );
  });
});

describe("integrity", () => {
  test("installations are isolated: no reads, no updates, no references across them", async () => {
    const krakow = await db("krakow").issues.insert({ title: "Kraków", reporter: "alice" });
    expect(await db("gdansk").issues.count()).toBe(0);
    expect(await db("gdansk").issues.get(krakow.id)).toBeNull();
    expect(await db("gdansk").issues.update(krakow.id, { title: "hack" })).toBeNull();
    expect(await db("gdansk").issues.delete(krakow.id)).toBe(false);
    expect((await db("krakow").issues.get(krakow.id))?.title).toBe("Kraków");
    await expect(db("gdansk").reports.insert({ issue: krakow.id, author: "alice" })).rejects.toThrow(
      "unknown issues id",
    );
  });

  test("unique constraint and upsert on the declared unique columns", async () => {
    const issue = await db("krakow").issues.insert({ title: "Latarnia", reporter: "alice" });
    const reports = db("krakow", "bob").reports;
    await reports.insert({ issue: issue.id, author: "bob" });
    await expect(reports.insert({ issue: issue.id, author: "bob" })).rejects.toThrow("unique constraint");
    const again = await reports.upsert({ issue: issue.id, author: "bob", note: "nadal" }, { on: ["author", "issue"] });
    expect(again.note).toBe("nadal");
    expect(await reports.count()).toBe(1);
    await expect(reports.upsert({ issue: issue.id, author: "bob" }, { on: ["note"] as never })).rejects.toThrow(
      "must match a declared unique",
    );
  });

  test("references cascade: deleting a user or an issue removes dependent rows", async () => {
    const issue = await db("krakow").issues.insert({ title: "Latarnia", reporter: "alice" });
    await db("krakow", "bob").reports.insert({ issue: issue.id, author: "bob" });
    await surreal.query(surql`DELETE user:bob;`);
    expect(await db("krakow").reports.count()).toBe(0);
    await db("krakow").reports.insert({ issue: issue.id, author: "alice" });
    await db("krakow").issues.delete(issue.id);
    expect(await db("krakow").reports.count()).toBe(0);
  });

  test("upsert matches on the stored value of a defaulted key column, never on a wider set", async () => {
    const labels = db("krakow").labels;
    const local = await labels.insert({ name: "pilne", scope: "local", color: "red" });
    const global = await labels.upsert({ name: "pilne", color: "blue" }, { on: ["name", "scope"] });
    expect(global).toMatchObject({ name: "pilne", scope: "global", color: "blue" });
    expect(global.id).not.toBe(local.id);
    expect(await labels.get(local.id)).toMatchObject({ scope: "local", color: "red" });
    const again = await labels.upsert({ name: "pilne", color: "green" }, { on: ["name", "scope"] });
    expect(again).toMatchObject({ id: global.id, color: "green" });
    expect(await labels.count()).toBe(2);
  });

  test("concurrent upserts of the same key leave one row", async () => {
    const labels = db("krakow").labels;
    const rows = await Promise.all(
      ["a", "b", "c"].map((color) => labels.upsert({ name: "x", color }, { on: ["name", "scope"] })),
    );
    expect(new Set(rows.map((r) => r.id)).size).toBe(1);
    expect(await labels.count()).toBe(1);
  });

  test('deleting a row still referenced with onDelete "restrict" throws DbError', async () => {
    const issue = await db("krakow").issues.insert({ title: "Latarnia", reporter: "alice" });
    await db("krakow").pins.insert({ issue: issue.id });
    await expect(db("krakow").issues.delete(issue.id)).rejects.toThrow(DbError);
    expect(await db("krakow").issues.count()).toBe(1);
  });

  test("references to unknown users are rejected", async () => {
    await expect(db("krakow").issues.insert({ title: "x", reporter: "nobody" })).rejects.toThrow("unknown user");
  });

  test("a file reference confirms the uploader's pending file; foreign and other users' files are rejected", async () => {
    await upload("file_a", "krakow", "alice");
    await upload("file_b", "krakow", "bob");
    await upload("file_c", "gdansk", "alice");

    const row = await db("krakow").issues.insert({ title: "Ze zdjęciem", reporter: "alice", photo: "file_a" as never });
    expect(await fileStatus("file_a")).toBe("kept");
    const [withPhoto] = await db("krakow").issues.findMany({ where: { id: row.id }, with: { photo: true } });
    expect({ ...withPhoto?.photo }).toEqual({ id: "file_a" as never, mime: "image/jpeg", size: 1 });

    await expect(
      db("krakow").issues.insert({ title: "x", reporter: "alice", photo: "file_b" as never }),
    ).rejects.toThrow("uploaded by another user");
    await expect(
      db("krakow").issues.insert({ title: "x", reporter: "alice", photo: "file_c" as never }),
    ).rejects.toThrow("unknown file");
    expect(await fileStatus("file_b")).toBe("pending");
  });

  test("a rejected write leaves nothing behind", async () => {
    const issue = await db("krakow").issues.insert({ title: "Latarnia", reporter: "alice" });
    await db("krakow").reports.insert({ issue: issue.id, author: "alice" });
    await expect(db("krakow").reports.insert({ issue: issue.id, author: "alice" })).rejects.toThrow(DbError);
    expect(await db("krakow").reports.count()).toBe(1);
  });
});

describe("watch (snapshot, then live changes)", () => {
  const next = async <T>(it: AsyncIterator<T>) => (await it.next()).value as T;

  test("yields the current rows, then creates, updates and deletes of matching rows only", async () => {
    const issues = db("krakow").issues;
    const lamp = await issues.insert({ title: "Latarnia", reporter: "alice" });
    const it = issues.watch({ where: { status: "open" }, with: { reporter: true } });
    expect(await next(it)).toMatchObject({ type: "snapshot", rows: [{ title: "Latarnia" }] });

    const hole = await issues.insert({ title: "Dziura", reporter: "alice" });
    expect(await next(it)).toMatchObject({
      type: "create",
      row: { id: hole.id, title: "Dziura", reporter: { name: "Alice" } },
    });
    await issues.update(lamp.id, { votes: 2 });
    expect(await next(it)).toMatchObject({ type: "update", row: { id: lamp.id, votes: 2 } });
    await issues.update(lamp.id, { status: "fixed" });
    expect(await next(it)).toEqual({ type: "delete", id: lamp.id });
    await issues.delete(hole.id);
    expect(await next(it)).toEqual({ type: "delete", id: hole.id });
    await it.return?.();
  });

  test("events are relative to the rows the subscriber has: entering is create, leaving is delete", async () => {
    const issues = db("krakow").issues;
    const fixed = await issues.insert({ title: "Naprawione", reporter: "alice", status: "fixed" });
    const it = issues.watch({ where: { status: "open" } });
    expect(await next(it)).toEqual({ type: "snapshot", rows: [] });
    await issues.update(fixed.id, { votes: 5 });
    await issues.update(fixed.id, { status: "open" });
    expect(await next(it)).toMatchObject({ type: "create", row: { id: fixed.id, votes: 5 } });
    await issues.update(fixed.id, { status: "fixed" });
    expect(await next(it)).toEqual({ type: "delete", id: fixed.id });
    await it.return?.();
  });

  test("changes from other installations are not visible", async () => {
    const it = db("krakow").issues.watch();
    expect(await next(it)).toEqual({ type: "snapshot", rows: [] });
    await db("gdansk").issues.insert({ title: "Gdańsk", reporter: "alice" });
    const mine = await db("krakow").issues.insert({ title: "Kraków", reporter: "alice" });
    expect(await next(it)).toMatchObject({ type: "create", row: { id: mine.id } });
    await it.return?.();
  });
});

describe("schema sync (no migration files)", () => {
  // biome-ignore lint/suspicious/noExplicitAny: variants of the issues table with different column types
  const withIssues = (issues: TableDef<any>) => ({ ...tables, issues });
  const cols = tables.issues.columns;

  test("re-sync is idempotent; additive changes apply, existing rows get the default, enums can grow", async () => {
    await db("krakow").issues.insert({ title: "Stare", reporter: "alice" });
    await syncSchema(surreal, "issues", tables);
    const extended = withIssues(
      t.table(
        {
          ...cols,
          priority: t.integer().default(2),
          area: t.text().optional(),
          status: t.enum(["open", "fixed", "wontfix"]).default("open"),
        },
        { indexes: [["status"], ["priority"]] },
      ),
    );
    await syncSchema(surreal, "issues", extended);
    const client = createDatabase({
      surreal,
      pluginId: "issues",
      tables: extended,
      installationId: "krakow",
      userId: null,
    });
    const [row] = await client.issues.findMany();
    expect(row).toMatchObject({ title: "Stare", priority: 2, area: null });
    expect(await client.issues.update(String(row?.id), { status: "wontfix" })).toMatchObject({ status: "wontfix" });
  });

  test("breaking changes are rejected before touching the database", async () => {
    // biome-ignore lint/suspicious/noExplicitAny: variants of the issues table with different column types
    const change = (issues: TableDef<any>) => syncSchema(surreal, "issues", withIssues(issues));
    await expect(change(t.table({ ...cols, required: t.text() }))).rejects.toThrow(
      "must be .optional() or have .default",
    );
    await expect(change(t.table({ ...cols, votes: t.text().default("0") }))).rejects.toThrow("changed type");
    await expect(change(t.table({ ...cols, meta: t.json<{ tags: string[] }>() }))).rejects.toThrow("became required");
    const { title: _, ...withoutTitle } = cols;
    await expect(change(t.table(withoutTitle))).rejects.toThrow("was removed");
    await expect(change(t.table({ ...cols, reporter: t.ref("issues") }))).rejects.toThrow(
      "changed its reference target",
    );
    await expect(change(t.table({ ...cols, status: t.enum(["open"]).default("open") }))).rejects.toThrow(
      "removed enum values",
    );
  });

  test("compatible changes apply: required → optional, onDelete, removed optional columns and indexes", async () => {
    const client = <TT extends Tables>(tt: TT) =>
      createDatabase({ surreal, pluginId: "issues", tables: tt, installationId: "krakow", userId: "alice" });
    const issue = await db("krakow").issues.insert({ title: "Latarnia", reporter: "alice", meta: { tags: ["a"] } });
    await db("krakow").labels.insert({ name: "pilne", scope: "x" });

    const relaxedCols = { ...cols, title: t.text().optional(), reporter: t.ref("user", { onDelete: "restrict" }) };
    const relaxed = {
      ...withIssues(t.table(relaxedCols, { indexes: [["status"]] })),
      labels: t.table({ name: t.text(), scope: t.text().default("global") }),
    };
    await syncSchema(surreal, "issues", relaxed);
    expect(await client(relaxed).issues.update(issue.id, { title: null })).toMatchObject({ title: null });
    // query() returns a lazy thenable; .then() makes it a Promise for expect().rejects.
    await expect(surreal.query(surql`DELETE user:alice;`).then()).rejects.toThrow("ON DELETE REJECT");
    // The unique index is gone with the declaration.
    expect(await client(relaxed).labels.insert({ name: "pilne", scope: "x" })).toMatchObject({ name: "pilne" });

    const { meta: _, ...withoutMeta } = relaxedCols;
    await syncSchema(surreal, "issues", { ...relaxed, issues: t.table(withoutMeta) });
    const readded = { ...relaxed, issues: t.table({ ...withoutMeta, meta: t.integer().optional() }) };
    await syncSchema(surreal, "issues", readded);
    expect(await client(readded).issues.get(issue.id)).toMatchObject({ meta: null });
    expect(await client(readded).issues.update(issue.id, { meta: 3 })).toMatchObject({ meta: 3 });
  });

  test("static validation of declarations", () => {
    expect(() => validateTables({ bad: t.table({ x: t.ref("nope") }) })).toThrow('unknown table "nope"');
    expect(() => validateTables({ bad: t.table({ id: t.text() }) })).toThrow("reserved");
    expect(() => validateTables({ "Bad-Name": t.table({ x: t.text() }) })).toThrow(SchemaError);
    expect(() => validateTables({ bad: t.table({ x: t.text() }, { indexes: [["y" as "x"]] }) })).toThrow(
      'unknown column "y"',
    );
  });
});
