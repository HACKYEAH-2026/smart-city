# Plugins

Every community feature (issue reports, discussions, lost & found…) is a plugin. The core only knows
communities, users and installations; plugins bring everything else: their own typed tables, tools
(actions), live streams and views.
An interactive walkthrough of how the runtime works (a tool call step by step, isolation, the generated
SurrealQL, `watch()`, Server-Driven UI) is in [architecture/plugins.html](architecture/plugins.html).

> **Status (read first)**
> - **Ready and tested:** the plugin SDK (`packages/sdk`) — contract, typed tables on SurrealDB, `watch()`
>   streams, files, AI — and the test harness (`@app/plugin-sdk/testing`). You can write and test the
>   backend side of a plugin today, without the API.
> - **Ready:** the API host (`apps/api`) on SurrealDB — views, tools, file uploads, runtime plugin uploads
>   (tables synced on upload) and `onInstall`; see [Host](#host).
> - **Not yet:** an HTTP transport for `streams` (they work in the harness; the app cannot subscribe yet).

Contents: [Mental model](#mental-model) · [New plugin](#creating-a-plugin-package) ·
[Manifest](#manifest-permissions-roles) · [Tables](#tables) · [Schema evolution](#schema-evolution-no-migrations) ·
[`ctx.db`](#ctxdb) · [Files](#ctxfiles) · [AI](#ctxai) · [Notifications](#ctxnotify) · [Tools & streams](#tools-streams-oninstall) ·
[Views](#views-ui) · [Dashboard widgets](#dashboard-widgets) · [Testing](#testing) · [Host](#host)

## Mental model

- A plugin is a package in `plugins/<id>/` that depends **only** on `@app/plugin-sdk`.
- The module imports **nothing at runtime** (only `import type`). Its default export is a factory
  `(sdk) => definePlugin({...})`; the host passes the SDK: `{ definePlugin, ui, z, fileRef, geoLocation, t }`
  (`t` = table builders, `z` = Zod 4, `fileRef` = Zod schema for an uploaded file id, `geoLocation` = Zod schema for
  a place picked on the map).
  This lets the same file run built-in, uploaded at runtime, or later in a sandbox.
- So a plugin is **one file** (`index.ts`; its test sits next to it): an upload sends that file, and the host
  rejects runtime imports and type errors before running it ([Checks](#checks)).
- A plugin sees only `ctx`: `user` (with role in this community), `community` (`id`, `slug`, `name`, `location`),
  `now()`, `lastVisit`, `db`, `files`, `ai`, `notify`. No app database, no disk, no network, no residents' locations.
- All data is **isolated per installation** (plugin × community): every query, reference and live
  stream is scoped to it.
- Code, identifiers and comments are in English; everything a resident sees (view titles, labels, toasts,
  `error` messages, Zod messages for user input, tool descriptions) is in Polish.

```
 plugin factory(sdk) ──► definePlugin({ tables, views, dashboardWidgets, tools, streams })
                                │
 host ── ctx { user, community, now, lastVisit, db, files, ai, notify } ──► view / dashboard widget / tool / stream handler
```

Reference plugins: `plugins/discussions` (best full example: two tables, refs, moderator rules, streams, a widget
of the latest activity),
`plugins/announcements` (dashboard widget with `ctx.lastVisit`, admin-only tools),
`plugins/issues` (photos, `ai.findSimilar`, `upsert` on a unique key). All three are built in; the smallest
plugin is the upload-test fixture `apps/api/test/fixtures/notes-plugin.ts`.

## Creating a plugin package

1. `plugins/<id>/package.json` (copy from `plugins/announcements`):

   ```json
   {
     "name": "@plugins/<id>",
     "private": true,
     "type": "module",
     "exports": { ".": "./index.ts" },
     "scripts": { "typecheck": "tsc -p ." },
     "dependencies": { "@app/plugin-sdk": "workspace:*" }
   }
   ```

2. `plugins/<id>/tsconfig.json`:

   ```json
   { "extends": "../../tsconfig.base.json", "include": ["*.ts"] }
   ```

3. `bun install` at the repo root (links the workspace package).
4. `plugins/<id>/index.ts` — the plugin (smallest working one):

   ```ts
   import type { PluginModule } from "@app/plugin-sdk";

   const notes: PluginModule = ({ definePlugin, ui, z, t }) =>
     definePlugin({
       id: "notes",
       name: "Notatki",
       version: "1.0.0",
       permissions: ["db"],
       nav: [{ view: "main", label: "Notatki" }],
       tables: {
         notes: t.table({ title: t.text(), body: t.text().default(""), author: t.ref("user").optional() }),
       },
       views: {
         main: async (ctx) => {
           const items = await ctx.db.notes.findMany();
           return ui.screen("Tablica notatek", items.map((n) => ui.card({ title: n.title, subtitle: n.body })));
         },
       },
       tools: {
         add: {
           description: "Dodaj notatkę",
           input: z.object({ title: z.string().trim().min(1), body: z.string().trim().max(200).default("") }),
           handler: async (ctx, input) => {
             await ctx.db.notes.insert({ ...input, author: ctx.user.id });
             return { toast: "Notatka dodana.", refresh: true };
           },
         },
       },
     });

   export default notes;
   ```

5. `plugins/<id>/<id>.test.ts` — see [Testing](#testing).
6. Run (inside `nix develop`):

   ```bash
   bun test ./plugins/<id>                 # tests (embedded in-memory SurrealDB, no API, no AI key)
   cd plugins/<id> && bunx tsc -p .        # typecheck (or: bun run --filter '@plugins/<id>' typecheck)
   bun run verify                          # before committing (definition of done, AGENTS.md)
   ```

Code style (AGENTS.md): declarative — handlers read as a sequence of `const x = await step()`; extract
helpers (e.g. `canRemove(ctx, authorId)`) instead of nested imperative blocks.

## Manifest, permissions, roles

| Field | Rule |
|---|---|
| `id` | `^[a-z][a-z0-9-]{1,39}$` (2–40 chars), unique |
| `name` | 1–60 chars, Polish, shown to residents |
| `version` | semver `x.y.z` |
| `icon` | ≤ 8 chars (emoji), default `🧩` |
| `description` | ≤ 280 chars, default `""` |
| `permissions` | subset of `"db"`, `"files"`, `"ai"`, `"notify"`, default `[]` |
| `nav` | ≥ 1 entry `{ view, label (≤ 40) }`; each `view` must exist in `views` |
| `tables` | optional, see [Tables](#tables) |
| `views`, `dashboardWidgets` (exactly one, required), `tools`, `streams`, `onInstall` | see below |

**Permissions.** In the host, using `ctx.db` / `ctx.files` / `ctx.ai` / `ctx.notify` without the matching permission rejects
with `Plugin did not declare the "<x>" permission`; uploads for a plugin without `"files"` return 404.
(The test harness enforces them like the host: an undeclared service rejects on use.)

**Roles** (`ctx.user.role`, per community):

| Role | Who |
|---|---|
| `"admin"` | community moderator (e.g. city office) |
| `"user"` | any resident (joining a community = `"user"`) |

`requires: "admin"` on a tool or stream → non-admins are rejected before the handler runs
(host: 403; harness: `ForbiddenError`). Default is `"user"` (everyone). For rules like "author **or**
moderator", check in the handler and return `{ error }` (see `canRemove` in `plugins/discussions`).

**What is validated when a plugin loads** (`loadPlugin`, used by the host and the harness): the module
default-exports a function; it returns an object; the manifest parses; every `nav.view` exists; `tables`
pass static validation (names, refs, indexes — see below); every tool/stream has a Zod `input` and a
`handler`. Failures throw `PluginError` with a readable message.

## Tables

Declare tables in the manifest; `ctx.db.<table>` is then fully typed (inserts, filters, `with` expansions).
Declare them in a `const` so helpers can use `Context<typeof tables>`:

```ts
const lostFound: PluginModule = ({ definePlugin, ui, z, fileRef, t }) => {
  const tables = {
    items: t.table(
      {
        title: t.text(),
        description: t.text().default(""),
        kind: t.enum(["lost", "found"]),
        status: t.enum(["open", "returned"]).default("open"),
        photo: t.ref("file").optional(),
        author: t.ref("user"),
      },
      { indexes: [["status", "createdAt"]] },
    ),
    claims: t.table(
      { item: t.ref("items"), claimant: t.ref("user"), message: t.text().default("") },
      { unique: [["item", "claimant"]] }, // one claim per person per item
    ),
  };
  type Ctx = Context<typeof tables>; // import type { Context } from "@app/plugin-sdk"
  const canManage = (ctx: Ctx, authorId: string) => authorId === ctx.user.id || ctx.user.role === "admin";

  return definePlugin({ /* …, */ tables, views: { /* … */ } });
};
```

### Columns

| Builder | TS value | Notes |
|---|---|---|
| `t.text()` | `string` | |
| `t.integer()` | `number` | must be an integer |
| `t.real()` | `number` | finite number |
| `t.boolean()` | `boolean` | |
| `t.timestamp()` | `Date` | pass a `Date` (use `ctx.now()`) |
| `t.json<T>()` | `T` | arbitrary JSON; **cannot be used in `where`** |
| `t.enum(["a", "b"])` | `"a" \| "b"` | values checked on write |
| `t.ref("user")` | `string` (user id) | platform users; expands to `{ id, name }` (never e-mail) |
| `t.ref("file")` | `FileId` | upload from the app; expands to `{ id, mime, size }`; see [Files](#ctxfiles) |
| `t.ref("<ownTable>")` | `string` (row id) | another table of this plugin; expands to its full row |

Modifiers:

| | Insert | Value type |
|---|---|---|
| (none) | required | `T` |
| `.optional()` | may be omitted → `null` | `T \| null` |
| `.default(v)` | may be omitted → `v` (applied on insert) | `T` |

**References** must point to rows of the same installation (or an existing platform user / a file
uploaded to this installation); otherwise the write fails with `DbError` (`unknown user`, `unknown file`,
`unknown <table> id`). `onDelete` (what happens to *this* row when the referenced row is deleted):

| `onDelete` | Default for | Effect |
|---|---|---|
| `"cascade"` | required refs | this row is deleted too |
| `"set null"` | optional refs | the column becomes `null` (requires `.optional()`) |
| `"restrict"` | — | deleting the referenced row fails |

`t.ref("items", { onDelete: "restrict" })`. Note: deleting a platform user cascades into every row with a
required `t.ref("user")` to them (e.g. their messages).

### Indexes and unique

```ts
t.table({ … }, {
  indexes: [["status"], ["discussion", "createdAt"]],  // speed up where/orderBy
  unique: [["item", "claimant"]],                       // per installation
});
```

Columns may be declared ones or the system columns `createdAt`, `updatedAt`, `createdBy`. Every index is
automatically prefixed with the installation, so `unique` means "unique within one community".
A violated unique constraint throws `DbError("<table>: unique constraint violated")`.

### System fields and naming

Every row has `id: string`, `createdAt: Date`, `updatedAt: Date`, `createdBy: string | null` (the user who
inserted it; `null` when written by the system user in `onInstall`). They are managed by the host, can be
used in `where`/`orderBy`/indexes, and cannot be set.

- Table and column names: camelCase, `^[a-z][a-zA-Z0-9]{0,39}$` (no `_`, no `-`).
- Reserved column names: `id`, `installation`, `installationId`, `createdAt`, `updatedAt`, `createdBy`.
- A table needs ≥ 1 column; refs must target `"user"`, `"file"` or a declared table; indexes must name known
  columns and be non-empty; `onDelete: "set null"` requires `.optional()`.

## Schema evolution (no migrations)

There are no migration files. When a plugin loads, the host compares the declared tables with the shape
stored for the previous version and, in one transaction, applies compatible changes or rejects the whole
version with `SchemaError` (nothing is changed in the database). Tables are shared by all installations of
a plugin, so a change applies to every community at once.

| Change | Result |
|---|---|
| New table | ✅ created as declared |
| New column with `.optional()` | ✅ existing rows get `null` |
| New column with `.default(v)` | ✅ existing rows are **backfilled** with `v` |
| New column that is required (no default, not optional) | ❌ `New column "t.c" must be .optional() or have .default(...)` |
| New `t.ref(...)` column that is not `.optional()` (even with a default) | ❌ `must be .optional()` |
| New enum value(s) (any order) | ✅ |
| Removing enum value(s) | ❌ `removed enum values; add a new column instead` |
| New index / unique | ✅ (a new unique fails with `SchemaError` if existing rows contain duplicates) |
| Changing a column's type | ❌ `changed type (text → integer)` |
| Required → `.optional()` | ✅ |
| `.optional()` → required | ❌ `became required; add a new column instead` |
| Changing a ref's `onDelete` | ✅ |
| Changing a ref's target | ❌ `changed its reference target; add a new column instead` |
| Changing a `.default(v)` value | ✅ affects only future inserts |
| Removing an optional column | ✅ the column **and its data** are dropped; the name can be reused later with any type |
| Removing a required column | ❌ `was removed; make it .optional() first` (two versions: make it optional, then remove it) |
| Removing an index / unique | ✅ dropped (no longer enforced) |
| Removing a table | ✅ no error; its data is kept (re-adding it is checked against the stored shape) |

How to evolve safely:

- Add columns as `.optional()` or `.default(...)`; refs as `.optional()`.
- Need a different type or nullability? Add a new column (e.g. `priorityLevel`), write both, read the new
  one; old data stays readable.
- Bump `version` with every change; the schema is re-checked on every load, so tests catch rejections
  (`testPlugin` runs the same sync on a fresh database).

## `ctx.db`

`ctx.db.<table>` is a `TableClient`. Every call is scoped to the current installation: rows of other
communities are invisible (`get` → `null`, `update` → `null`, `delete` → `false`), and references to them
are rejected.

| Method | Returns | Notes |
|---|---|---|
| `findMany({ where?, orderBy?, limit?, offset?, with? })` | `Row[]` | **`limit` defaults to 100**, max 1000 |
| `findFirst({ … })` | `Row \| null` | `findMany` with `limit: 1` |
| `get(id, { with? })` | `Row \| null` | |
| `count({ where? })` | `number` | |
| `insert(values)` | `Row` | applies defaults, sets system fields |
| `upsert(values, { on })` | `Row` | `on` must equal a declared `unique` (any order) |
| `update(id, patch)` | `Row \| null` | partial; `null` clears an optional column; `null` if not found |
| `updateMany(where, patch)` | `number` | rows changed |
| `delete(id)` | `boolean` | |
| `deleteMany(where)` | `number` | rows deleted |
| `watch({ where?, orderBy?, limit?, with? })` | `AsyncGenerator<WatchEvent>` | snapshot, then live changes |

### Queries

```ts
const open = await ctx.db.issues.findMany({
  where: {
    status: { in: ["open", "accepted"] },        // IN
    votes: { gte: 5 },                           // eq, ne, gt, gte, lt, lte (combinable: { gte: 1, lt: 9 })
    assignee: null,                              // IS NULL
    createdAt: { gt: new Date("2026-01-01") },   // system fields work too
  },
  orderBy: { votes: "desc" },                    // ties: createdAt desc, id desc (also the default order)
  limit: 20,
  offset: 0,
});
const mine = await ctx.db.issues.findFirst({ where: { reporter: ctx.user.id } });
const n = await ctx.db.issues.count({ where: { status: "open" } });
```

- A plain value means equality; all conditions are ANDed (no OR — run two queries or use `in`).
- `where` keys and values are typed from the table; JSON columns are rejected (`DbError`).
- Ref columns are compared by id (`{ reporter: ctx.user.id }`, `{ issue: { in: ids } }`).

**`with`** expands ref columns in the result (types follow):

```ts
const one = await ctx.db.issues.get(id, { with: { reporter: true, photo: true } });
one?.reporter.name;   // reporter: { id, name }        (PublicUser)
one?.photo?.mime;     // photo: { id, mime, size } | null  (FileMeta; null because the column is optional)
const [c] = await ctx.db.comments.findMany({ with: { issue: true } });
c?.issue.title;       // issue: the full row of the referenced table (one level, no nested `with`)
```

### Writes

```ts
const row = await ctx.db.issues.insert({ title: "Latarnia", reporter: ctx.user.id }); // typed: required cols only
await ctx.db.issues.update(row.id, { votes: row.votes + 1, assignee: null });       // null clears optional
await ctx.db.issues.updateMany({ status: "accepted" }, { status: "fixed" });
await ctx.db.claims.upsert(                                                          // insert or update the row
  { item: item.id, claimant: ctx.user.id, message: input.message },                  // with the same (item, claimant)
  { on: ["item", "claimant"] },
);
await ctx.db.issues.deleteMany({ status: "fixed", updatedAt: { lt: ctx.now() } });
```

- Values are validated at runtime too: missing required column, wrong type, unknown column, unknown enum
  value, `null` in a required column → `DbError`.
- `updatedAt` is set on every update; `createdAt` / `createdBy` on insert.
- A failed write leaves nothing behind (the write and its file confirmations run in one transaction).
- `upsert` is "find by the unique columns, then update or insert" — pass **all** `on` columns explicitly
  (see [Known issues](#known-issues)).

### `watch()` — live queries

```ts
for await (const event of ctx.db.issues.watch({ where: { status: "open" }, with: { reporter: true } })) {
  if (event.type === "snapshot") event.rows;              // current matching rows (findMany semantics)
  else if (event.type === "delete") event.id;
  else event.row.reporter.name;                          // "create" | "update": the row, with expansions
  if (done) break;                                       // break / return() closes the live query
}
```

`WatchEvent<Row>` = `{ type: "snapshot", rows }` (always first) | `{ type: "create" | "update", row }` |
`{ type: "delete", id }`. Semantics:

- Only changes of this installation are delivered.
- Events are relative to the rows the subscriber has (the snapshot plus later events); `where` is re-evaluated
  on each change:
  - a row entering the filter (created, or updated to match) → `create`;
  - a change to a row the subscriber has → `update`;
  - a row the subscriber has leaving the filter, or deleted → `delete`;
  - changes to rows the subscriber never had and that still do not match → nothing.
- `orderBy` and `limit` apply only to the snapshot (which, like `findMany`, has a **default limit of 100**);
  live events arrive in change order and are not limited.
- Cascades are streamed too (deleting a discussion yields `delete` for each of its messages).
- The generator never ends by itself; the consumer stops it (`break`, `return()`), which kills the live query.

### Errors

| Error | When | How it surfaces |
|---|---|---|
| `DbError` | invalid value, unknown column/operator/reference, unique violation, file of another user, deleting a row still referenced by a `restrict` ref | thrown from the `ctx.db` call |
| `SchemaError` (→ `PluginError` at load) | invalid declaration or breaking schema change | plugin does not load |

An exception escaping a handler is a plugin bug: the host answers `500 plugin_error` (the harness rethrows
it). For expected situations (not found, not allowed, closed), check first and **return `{ error: "…" }`**
with a Polish message.

## `ctx.files`

Photos are uploaded by the app, never by the plugin; a plugin only handles `FileId`s.

1. A form with `ui.imagePicker({ name: "photo", label })` → the app uploads the file
   (`POST …/plugins/:id/files`, user's session) → gets a `FileId` (status **pending**) → puts it in the tool `args`.
2. Validate it in the tool input with `fileRef()` (format `file_<uuid>`; typed as `FileId`).
3. Store it in a `t.ref("file")` column → the write checks it belongs to this installation and **confirms**
   it (`kept`) in the same transaction. Unreferenced uploads are deleted after 24 h.
4. Render it with `ui.image(fileId, alt)`; the host adds a signed, short-lived URL.

Rules: a pending file can be referenced only by the user who uploaded it (`DbError: file was uploaded by
another user`) — so the system user in `onInstall` cannot attach uploads; once kept, any row of the
installation may reference it.

```ts
input: z.object({ title: z.string().min(3), photo: fileRef().optional() }),
handler: async (ctx, input) => {
  await ctx.db.items.insert({ title: input.title, kind: "found", photo: input.photo ?? null, author: ctx.user.id });
  return { toast: "Dodano ogłoszenie." };
},
```

| Method | Returns |
|---|---|
| `ctx.files.info(id)` | `{ mime, size }` (throws for an unknown id) |
| `ctx.files.remove(id)` | `void` — deletes the file; optional `t.ref("file")` columns pointing to it become `null`, rows with a **required** file ref are deleted (cascade) |

## `ctx.ai`

The model is host configuration (Strands + an OpenAI-compatible endpoint: `AI_API_KEY`, `AI_MODEL`,
optional `AI_BASE_URL`; embeddings: OpenAI's `text-embedding-3-small` on the same key). Tests never call a model —
use the harness mocks.

```ts
// Text
const summary: string = await ctx.ai.call({ prompt: "Streść zgłoszenie w jednym zdaniu: …" });

// Structured output (validated with the Zod schema), with images
const { title, color } = await ctx.ai.call({
  prompt: "Opisz krótko przedmiot na zdjęciu.",
  images: [photo],                                           // FileId[]
  schema: z.object({ title: z.string(), color: z.string().nullable() }),
});

// "Is this the same thing?" over candidate rows (most similar first; [] = none)
const candidates = await ctx.db.items.findMany({ where: { kind: "lost", status: "open" }, limit: 50 });
const [match] = await ctx.ai.findSimilar({ text: input.title, image: input.photo ?? null }, candidates, {
  text: (i) => `${i.title}. ${i.description}`,
  image: (i) => i.photo,       // optional
  limit: 1,                    // optional
});
if (match) match.item.id; match?.score; match?.reason;   // item is your row type; reason is Polish text
```

Without a configured model, `findSimilar` works lexically (shared words) and so does the demo; with a
model, the model decides (using the query image) and writes the `reason`.

### Embeddings: `ctx.ai.embed`

`embed(text)` returns the meaning of a text as a vector (`number[]`, 1536 numbers) from the host's embedding model
(OpenAI's `text-embedding-3-small`). The plugin
stores the vectors in its own table and compares them itself, e.g. to look for a duplicate among all open reports
(`findSimilar` sees at most 30 candidates).

```ts
tables: { issues: t.table({ title: t.text(), status: t.text(), vector: t.json<number[]>() }) },

// On insert: embed once, store the vector with the row
const vector = await ctx.ai.embed(input.title);

// Compare: cosine similarity (1 = the same direction), written in the plugin
const cosine = (a: number[], b: number[]) => {
  const dot = a.reduce((sum, x, i) => sum + x * (b[i] ?? 0), 0);
  const norm = (v: number[]) => Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
  return dot / (norm(a) * norm(b) || 1);
};
const open = await ctx.db.issues.findMany({ where: { status: "open" } });
const nearest = open
  .filter((i) => i.vector.length === vector.length)       // skip vectors of another model
  .map((i) => ({ item: i, score: cosine(i.vector, vector) }))
  .sort((a, b) => b.score - a.score)
  .slice(0, 5);
// Scores depend on the model: pick a threshold on real texts, or let the model judge the nearest few
const [match] = await ctx.ai.findSimilar({ text: input.title }, nearest.map((n) => n.item), { text: (i) => i.title, limit: 1 });
if (!match) await ctx.db.issues.insert({ title: input.title, status: "open", vector });
```

- Vectors of different models are not comparable. When the host switches models, the length usually changes:
  compare only vectors of the same length and embed older rows again when needed.
- Without an AI key (`AI_API_KEY` unset) `embed` throws, like `call` without a model. A plugin
  that must work in a keyless demo catches it and falls back (e.g. to `findSimilar` alone).
- The text is trimmed; empty or longer than 8000 characters → error. At most 600 embeddings per minute per
  installation, counted apart from the 60 model calls (`call`, `findSimilar`).

## `ctx.notify`

Notifications go to residents' inboxes in the app (`"notify"` permission). Recipients are always members of
this community and never the user who triggered the call (the reporter does not get their own alert).

```ts
// "Uwaga, dzik!": residents with a saved place, or a position shared in the last 30 min, within 500 m
await ctx.notify({
  to: { near: { lat: input.lat, lng: input.lng, radius: 500 } },
  title: "Dzik z młodymi przy placu zabaw",
  body: "Ok. 150 m od Lasu Borkowskiego. Nie podchodź, zabierz psa na smycz.",
  tone: "danger",
  open: ui.navigate("sighting", { id: sighting.id }),   // the view the app opens on tap
});
await ctx.notify({ to: { users: [issue.reporter] }, title: "Twoje zgłoszenie naprawione", tone: "success" });
await ctx.notify({ to: { everyone: true }, title: "Alarm: skażenie wody w sieci" });  // all members
```

| Field | Rule |
|---|---|
| `to` | exactly one of `{ users: string[] }` (1–1000 user ids; non-members are skipped), `{ near: { lat, lng, radius } }` (WGS 84, radius in metres, ≤ 50 000), `{ everyone: true }` |
| `title` | 1–120 chars, Polish |
| `body` | ≤ 500 chars, default `""` |
| `tone` | `"info"` (default), `"success"`, `"warning"`, `"danger"` |
| `open` | optional `ui.navigate(view, params?)`; the view must exist |

- **Privacy:** `near` is matched by the host against residents' saved places ("Moje miejsca", `/api/me/places`)
  and positions shared from the open app (`/api/me/location`, fresh for 30 minutes). The plugin never sees
  them, and `ctx.notify` returns nothing about the recipients (not even a count), so it cannot be used to
  locate anyone. Store the reported point in your own tables if the plugin needs it (e.g. a map of sightings).
- Who may trigger what is the plugin's decision: guard broadcast tools with `requires: "admin"` and limit how
  often a resident can trigger `near` alerts (e.g. one sighting per user per 10 minutes, checked in `ctx.db`).
- An invalid call (unknown view, bad audience, radius too big) throws: a plugin bug, the tool fails with
  `500 plugin_error` and nothing is sent.
- Delivery: the in-app inbox (`GET /api/me/notifications`) and a push to every phone the recipient registered
  (Expo Push Service → FCM/APNs). `warning`/`danger` go out with high priority on the Android channel "alerts";
  tapping the push opens `open` (or the community). Pushes are sent in the background: a failing push service
  never fails the tool, and phones Expo reports as uninstalled are forgotten.

## Tools, streams, onInstall

### Tools

```ts
tools: {
  claim: {
    description: "Zgłoś, że przedmiot jest Twój.",   // for humans and AI assistants (MCP)
    input: z.object({ item: z.string().min(1), message: z.string().trim().max(500).default("") }),
    // requires: "admin",                            // optional; default "user"
    // readOnly: true,                               // optional; marks a tool with no side effects
    handler: async (ctx, input) => {                 // input = parsed z.output (defaults applied)
      const item = await ctx.db.items.get(input.item);
      if (!item || item.status !== "open") return { error: "To ogłoszenie jest już nieaktualne." };
      await ctx.db.claims.upsert({ item: item.id, claimant: ctx.user.id, message: input.message }, { on: ["item", "claimant"] });
      return { toast: "Wysłano zgłoszenie.", refresh: true };
    },
  },
},
```

Order in the host and harness: tool exists → `requires` → `input` parsed (invalid → host 400 with Zod issues;
put Polish messages in Zod for user input) → handler → result validated.

**`ToolResult`** (all optional; returning nothing = `{}`):

| Field | Meaning |
|---|---|
| `toast` | success message (Polish) |
| `error` | message for the user (Polish); by convention nothing was saved |
| `navigate` | `ui.navigate(view, params?)` — open a view of this plugin (params are strings) |
| `refresh` | re-render the current view |
| `close` | close the current screen (go back) |
| `data` | result for AI assistants / callers (e.g. `{ id }`); also how tests read results |

### Streams

A stream is an async generator exposed to the app and AI assistants. Usually it checks access, then
delegates to `watch()`:

```ts
streams: {
  claims: {
    description: "Zgłoszenia do mojego ogłoszenia na żywo.",
    input: z.object({ item: z.string().min(1) }),
    // requires: "admin",
    handler: async function* (ctx, input) {
      const item = await ctx.db.items.get(input.item);
      if (!item || !canManage(ctx, item.author)) return;     // ends the stream immediately
      yield* ctx.db.claims.watch({ where: { item: item.id }, orderBy: { createdAt: "asc" }, with: { claimant: true } });
    },
  },
  // Without checks the handler can return the watch directly:
  // discussions: { description, input: z.object({}), handler: (ctx) => ctx.db.discussions.watch() },
},
```

Note: `ctx.user` is fixed for the stream's lifetime; access is checked once, when it is opened.

### `onInstall`

Runs once when the plugin is enabled in a community (seed data). `ctx.user` is the system user
(`{ id: "system", role: "admin" }`, no account): rows get `createdBy: null`, and it cannot be used as a
value for `t.ref("user")` columns or attach pending uploads. Use optional user refs for seeded rows.

## Views (UI)

UI is secondary for now (the backend side comes first). A view `(ctx, params) => UINode` returns a tree of
nodes from a closed catalog (`packages/sdk/src/ui.ts`); the root must be `ui.screen`. Actions are data:
`ui.navigate(view, params?)` or `ui.tool(name, args?)`.

| Node | Builder |
|---|---|
| Screen | `ui.screen(title, children, { eyebrow? })` — always the root; `eyebrow` is a small line above the title (e.g. the place's name) |
| Widget | `ui.widget(title, children, options?)` — the root of a [dashboard widget](#dashboard-widgets); `options`: `onPress` (a `navigate` action) is where tapping the tile leads; `icon` (`alert`, `idea`, `camera`, `megaphone`, `chat`, `plus`; Buttons and Select cards take the same set), `subtitle` and `link` (`{ label, action }`, e.g. "Wszystkie") make the header |
| Highlight | `ui.highlight({ eyebrow, title, image?, votes?, onPress? })` — a widget's featured item: a thumbnail (`image`, a photo from `ctx.files`), a vote count with an up arrow |
| Activity | `ui.activity({ title, text?, person?, at?, unread?, onPress? })` — something a person did and when: their initials (`person`), the title, a line of text and `at` (an ISO date, shown as "5 min temu"); `unread` marks it new. In a widget a compact row (e.g. a discussion's last message), on a screen a card with the text in full (e.g. a message) |
| Stack / Row | `ui.stack([...])`, `ui.row([...], { grow? })` (`grow`: the children share the width equally) |
| List | `ui.list(label, items)` |
| Card | `ui.card({ title, subtitle?, badge?: { text, tone? }, tags?, counter?, onPress?, children? })` — `tags`: `{ text, tone?, icon?, dot? }` (up to 4); `counter`: `{ label, value, pressed, action? }`, a button at the left (votes): pressed, or without `action`, it cannot be pressed |
| Heading / Text | `ui.heading(text, 2 \| 3)`, `ui.text(text, "ink" \| "soft"?)` |
| Badge | `ui.badge(text, tone?)` — `neutral`, `info`, `success`, `warning`, `danger` |
| Button | `ui.button(label, action, "primary" \| "quiet" \| "danger"?, icon?)` |
| Tabs | `ui.tabs({ label, variant?: "segmented" \| "chips", options: [{ label, selected?, action }] })` — options only navigate (sorting, filters); `ui.navigate(view, params, { replace: true })` replaces the view instead of stacking one |
| Fab | `ui.fab({ label, icon?, action })` — a floating button over the screen (bottom right, outside its scroll), e.g. "Zgłoś"; navigates |
| Timeline | `ui.timeline([{ title, at?, text?, tone? }])` — the steps of something that moves on (a report's progress): a dot per step (its tone), the date and an optional note |
| Share | `ui.share(label, path)` — a button that shares a link to a place in the app (`path` starts with `/app/`); the app builds the full address |
| Progress / Stat | `ui.progress({ value, max, label })`, `ui.stat(label, value)` |
| Empty | `ui.empty(text)` |
| Image | `ui.image(fileId, alt)` |
| Form | `ui.form({ submitLabel, submit: ui.tool(name), children })` — field values become tool `args` |
| TextInput / Select / ImagePicker | `ui.textInput({ name, label, multiline?, value? })`, `ui.select({ name, label, options, value? })`, `ui.imagePicker({ name, label })` — inside a Form |
| LocationInput | `ui.locationInput({ name, label, value? })` — inside a Form: the app's location picker (address search, the user's position, a pin); the tool gets `{ lat, lng, address }`, validate it with `geoLocation()` |
| Map | `ui.map({ label, layers, center?, zoom? })` — see [Maps](#maps) |

A new node = schema + builder in `ui.ts` + a branch in `apps/app/src/plugins/Renderer.tsx`.

### Maps

A plugin map is layers over the app's base map (OpenStreetMap): the plugin says what is where and what it means,
the app draws it in its own colours. Each layer is a titled group of items of one kind (its title goes in the
legend); every item has an `id` (unique in its layer), a `title`, optionally a `subtitle`, a `tone` (overrides the
layer's) and an `onPress` action.

```ts
ui.map({
  label: "Utrudnienia w okolicy",
  layers: [
    ui.map.pins("Awarie", issues.map((i) => ({ id: i.id, at: i.location, title: i.title,
      onPress: ui.navigate("detail", { id: i.id }) })), "danger"),
    ui.map.routes("Objazdy", [{ id: "d1", title: "Objazd ul. Długiej", path: [a, b, c], dashed: true }], "info"),
    ui.map.areas("Brak wody", [{ id: "w1", title: "Do 18:00", center: p, radius: 400 }], "warning"),
  ],
})
```

| Layer | Item geometry |
|---|---|
| `ui.map.pins(title, items, tone?)` | `at: { lat, lng }` — places, reports, alerts |
| `ui.map.routes(title, items, tone?)` | `path: [{ lat, lng }, …]` (2–2000 points), `dashed?` — a route, a detour, a closed street |
| `ui.map.areas(title, items, tone?)` | `center` + `radius` (metres, ≤ 50 km) or `polygon` (3–500 points) — a zone, a park, a district |

- **View:** the first view fits everything on the map. `center` (and `zoom`, 1–19) set it instead, e.g.
  `center: ctx.community.location ?? undefined` for a map that may be empty.
- **Tones** are the Badge tones (`neutral`, `info`, `success`, `warning`, `danger`); no tone is the brand red. There
  are no colours or styles of your own: every plugin's map looks like the app.
- **Taps:** tapping an item on the map shows its card under the map; pressing the card runs `onPress`. The app also
  lists every item under the map ("Pokaż listę"): the map is a canvas, the list is what screen readers use.
- **Limits:** 8 layers, 1000 items on a map. In a dashboard widget the map is a still preview (`onPress` may only
  navigate there, like the rest of a widget).
- **Storing a place:** `location: t.json<GeoLocation>().optional()` (a `t.json` column cannot be used in `where`:
  filter places in code). `ctx.community.location` is the place's own pin (`null` when its admins have not set one).

## Dashboard widgets

Every plugin has **exactly one** widget on the community dashboard (`dashboardWidgets` with one entry, checked on load
and upload): its tile is the only way residents open the plugin, the dashboard has no other list of features. The
dashboard is a grid 3 columns wide (`DASHBOARD_COLUMNS`) in rows of fixed height. The widget declares:

| Field | Required | Meaning |
|---|---|---|
| `size` | yes | default size in grid cells: `w` 1-3 columns, `h` 1-3 rows (`{ w: 3, h: 3 }` = full width, 3 rows) |
| `sizes` | no | up to 6 other sizes an admin may switch the widget to (same limits); `size` is always allowed |
| `title` | no | 1-60 characters: the widget's name in the layout editor (defaults to the plugin's `name`) |
| `render(ctx)` | yes | always returns `ui.widget(title, children, options?)`: with no data yet, an empty state (`ui.empty(…)`) and the way to start, never nothing |

Content beyond the size is clipped, so `render` must fit the smallest size the widget offers. With `onPress` (a
`navigate` action, usually the plugin's main list) the whole tile is tappable and shows a chevron (or its `link`,
when it has one); cards, buttons and links inside it keep their own actions.

Default order: plugin installation, each widget at its `size`. Community admins arrange the dashboard in Zarządzaj
miejscem → Układ pulpitu: the order, each widget's size (one of the sizes its plugin allows), and which widgets are on
it (a removed widget can be added back). Removing a widget only hides its tile: the plugin stays enabled, but residents
cannot open it from the dashboard until an admin adds the widget back (links and notifications still open it). Admins can also long-press a tile on the dashboard to reorder it (drag, or earlier/later
buttons). The layout is saved per community; widgets of newly enabled plugins go last, at their default size. A saved
size the plugin no longer allows falls back to its `size`.

```ts
dashboardWidgets: {
  latest: {
    title: "Ogłoszenia",
    size: { w: 3, h: 3 },
    sizes: [{ w: 3, h: 2 }],
    render: async (ctx) => {
      const since = ctx.lastVisit ? { createdAt: { gt: ctx.lastVisit } } : {};
      const fresh = await ctx.db.announcements.findMany({ where: since, orderBy: { createdAt: "desc" }, limit: 2 });
      return ui.widget(
        "Ogłoszenia",
        [
          fresh.length ? ui.text("Nowe od Twojej ostatniej wizyty", "soft") : ui.empty("Nic nowego."),
          ...fresh.map((a) => ui.card({ title: a.title, onPress: ui.navigate("item", { id: a.id }) })),
          ui.button("Wszystkie ogłoszenia", ui.navigate("list"), "quiet"),
        ],
        { onPress: ui.navigate("list") }, // tapping the tile
      );
    },
  },
},
```

- **Read-only:** no `Form`, inputs or tool actions anywhere in the tree (validated); `navigate` opens a view
  of the plugin. A widget that throws or returns invalid UI (`null` included) is left out of the dashboard
  (logged), the rest renders.
- **`ctx.lastVisit`:** when this user last opened any view of this plugin in this community, before the
  current request (`null` = never). The host records it on every view render, so "new since the last
  visit" works without plugin tables. Available in views too (there it is the previous view render).
- Full example: `plugins/announcements`.

## Testing

`testPlugin` from `@app/plugin-sdk/testing` runs the plugin against the **real engine** on embedded
in-memory SurrealDB (platform tables included): tables, references, cascades, unique, defaults and
`watch()` behave as in the host. It also applies `requires`, Zod input parsing and UI/result schemas.
No API, no AI model; connections close after each test.

> Name the harness `plugin` (not `t`) to avoid confusion with the `t` table builders.

| API | Description |
|---|---|
| `await testPlugin(mod, { user?, community? })` | loads, validates and syncs the schema. Default user `{ id: "u_test", role: "user" }` |
| `.tool(name, args?)` | → `ToolResult`; rejects with `ForbiddenError` (requires) or a `ZodError` (input) |
| `.view(name, params?)` | → validated `UINode`; use `textsOf(node)` for layout-independent assertions. Records a visit (`ctx.lastVisit`) like the host |
| `.dashboardWidget(name)` | → validated widget `UINode` |
| `.stream(name, args?)` | → `AsyncIterator`; read with `next()`, finish with `return()` |
| `.invalidInput(name, args)` | Zod issues the host would answer 400 with, or `null` |
| `.as(user)` | the same harness acting as another user (`.tool/.view/.dashboardWidget/.stream/.files.fake/.invalidInput/.ctx`) |
| `.files.fake(mime?)` | a pending upload by the acting user → `FileId` |
| `.files.isKept(id)` | `true` once a `t.ref("file")` column referenced it |
| `.ai.mockSimilar((query, candidates) => matches)` | `findSimilar` result (default `[]`) |
| `.ai.mockCall((req) => value)` | `call` result, parsed with `req.schema` if given (default: throws) |
| `.ai.mockEmbed((text) => vector)` | `embed` result (default: throws) |
| `.notifications()` | what `ctx.notify` sent, validated like in the host, oldest first, each with `from` (sender id); recipients are resolved by the host only |
| `.db` | the plugin database as the system user (assertions); untyped tables → `plugin.db.items!` |
| `.install()` | runs `onInstall` |
| `.setNow(date)` | controls `ctx.now()` and timestamps (default `2026-01-01T00:00:00Z`) |
| `.deleteUser(id)` | deletes a platform user (check cascades) |
| `.ctx()` | a raw `Context` for the acting user |

Users are created on first use (from `{ id, name }`). Every test gets a fresh database.

Complete example (the `lostFound` plugin from this doc; type-checked and passing):

```ts
import { describe, expect, test } from "bun:test";
import { ForbiddenError, testPlugin, textsOf } from "@app/plugin-sdk/testing";
import lostFound from "./index";

const anna = { id: "anna", name: "Anna", role: "user" } as const;
const bartek = { id: "bartek", name: "Bartek", role: "user" } as const;
const moderator = { id: "city", name: "Urząd", role: "admin" } as const;

type Event = { type: string; rows?: unknown[]; row?: { claimant: { name: string } }; id?: string };
const next = async (it: AsyncIterator<unknown>) => (await it.next()).value as Event;

describe("lost-found", () => {
  test("post with photo, AI match, claim, live claims, moderation", async () => {
    const plugin = await testPlugin(lostFound, { user: anna });

    // Anna lost gloves; Bartek finds them and posts a photo. The AI mock says "same thing".
    await plugin.tool("post", { title: "Zgubione rękawiczki", kind: "lost" });
    plugin.ai.mockSimilar((query, candidates) =>
      candidates.map((item) => ({ item, score: 0.9, reason: `To pewnie: ${query.text}` })),
    );
    const photo = await plugin.as(bartek).files.fake(); // pending upload by Bartek
    const found = await plugin.as(bartek).tool("post", { title: "Znalezione rękawiczki", kind: "found", photo });
    expect(found.toast).toBe("Dodano. Może to: Zgubione rękawiczki?");
    expect(await plugin.files.isKept(photo)).toBe(true); // confirmed by the t.ref("file") column
    const itemId = (found.data as { id: string }).id;

    // Bartek watches claims for his item; Anna claims it (twice: upsert keeps one row).
    const live = await plugin.as(bartek).stream("claims", { item: itemId });
    expect(await next(live)).toEqual({ type: "snapshot", rows: [] });
    await plugin.tool("claim", { item: itemId, message: "To moje!" });
    expect(await next(live)).toMatchObject({ type: "create", row: { claimant: { name: "Anna" } } });
    await plugin.tool("claim", { item: itemId, message: "Na pewno moje" });
    expect(await next(live)).toMatchObject({ type: "update", row: { message: "Na pewno moje" } });
    await live.return?.();
    expect(await plugin.db.claims!.count()).toBe(1);

    // Only the author or a moderator can mark it returned; only a moderator can purge.
    expect((await plugin.tool("markReturned", { id: itemId })).error).toBe("Możesz zmieniać tylko swoje ogłoszenia.");
    expect((await plugin.as(moderator).tool("markReturned", { id: itemId })).close).toBe(true);
    await expect(plugin.tool("purgeReturned")).rejects.toBeInstanceOf(ForbiddenError);
    expect((await plugin.as(moderator).tool("purgeReturned")).data).toEqual({ removed: 1 });
    expect(await plugin.db.claims!.count()).toBe(0); // claims cascade with the item

    expect(textsOf(await plugin.view("list"))).toContain("Zgubione rękawiczki");
  });

  test("validation, AI call mock and foreign uploads", async () => {
    const plugin = await testPlugin(lostFound, { user: anna });
    expect(plugin.invalidInput("post", { title: "x", kind: "lost" })?.[0]?.message).toBe(
      "Opisz przedmiot w kilku słowach",
    );

    plugin.ai.mockCall(() => ({ title: "Rękawiczki", color: "czerwone" }));
    const photo = await plugin.files.fake("image/png");
    expect((await plugin.tool("describePhoto", { photo })).data).toEqual({
      title: "Rękawiczki",
      color: "czerwone",
      mime: "image/png",
    });

    const bartekPhoto = await plugin.as(bartek).files.fake();
    await expect(plugin.tool("post", { title: "Cudze zdjęcie", kind: "lost", photo: bartekPhoto })).rejects.toThrow(
      "uploaded by another user",
    );
  });

  test("deleting a user cascades; setNow controls time", async () => {
    const plugin = await testPlugin(lostFound, { user: anna });
    plugin.setNow(new Date("2026-05-01T10:00:00Z"));
    await plugin.tool("post", { title: "Zgubiony klucz", kind: "lost" });
    const [item] = await plugin.db.items!.findMany();
    expect(item?.createdAt).toEqual(new Date("2026-05-01T10:00:00Z"));
    await plugin.deleteUser("anna");
    expect(await plugin.db.items!.count()).toBe(0);
  });
});
```

<details>
<summary>The <code>lostFound</code> plugin used above (tools and stream)</summary>

Tables and `canManage` as in [Tables](#tables); manifest: `id: "lost-found"`, `permissions: ["db", "files", "ai"]`,
`nav: [{ view: "list", label: "Znalezione" }]`, one `list` view, the `claim` tool and `claims` stream shown above, plus:

```ts
post: {
  description: "Dodaj ogłoszenie o zgubionej albo znalezionej rzeczy (opcjonalnie ze zdjęciem).",
  input: z.object({
    title: z.string().trim().min(3, "Opisz przedmiot w kilku słowach"),
    kind: z.enum(["lost", "found"]),
    photo: fileRef().optional(),
  }),
  handler: async (ctx, input) => {
    const opposite = input.kind === "lost" ? "found" : "lost";
    const candidates = await ctx.db.items.findMany({ where: { kind: opposite, status: "open" }, limit: 50 });
    const [match] = await ctx.ai.findSimilar({ text: input.title, image: input.photo ?? null }, candidates, {
      text: (i) => `${i.title}. ${i.description}`,
      image: (i) => i.photo,
      limit: 1,
    });
    const item = await ctx.db.items.insert({
      title: input.title,
      kind: input.kind,
      photo: input.photo ?? null, // storing the FileId confirms the upload
      author: ctx.user.id,
    });
    return {
      toast: match ? `Dodano. Może to: ${match.item.title}?` : "Dodano ogłoszenie.",
      refresh: true,
      data: { id: item.id, similar: match?.item.id ?? null },
    };
  },
},
markReturned: {
  description: "Oznacz przedmiot jako oddany (autor ogłoszenia albo moderator).",
  input: z.object({ id: z.string().min(1) }),
  handler: async (ctx, { id }) => {
    const item = await ctx.db.items.get(id);
    if (!item) return { error: "To ogłoszenie nie istnieje." };
    if (!canManage(ctx, item.author)) return { error: "Możesz zmieniać tylko swoje ogłoszenia." };
    await ctx.db.items.update(id, { status: "returned" });
    return { toast: "Oznaczono jako oddane.", close: true };
  },
},
purgeReturned: {
  description: "Usuń wszystkie oddane przedmioty (tylko moderator).",
  input: z.object({}),
  requires: "admin",
  handler: async (ctx) => {
    const removed = await ctx.db.items.deleteMany({ status: "returned" });
    return { toast: `Usunięto ${removed}.`, refresh: true, data: { removed } };
  },
},
describePhoto: {
  description: "Opisz przedmiot na zdjęciu (AI).",
  input: z.object({ photo: fileRef() }),
  readOnly: true,
  handler: async (ctx, { photo }) => {
    const { title, color } = await ctx.ai.call({
      prompt: "Opisz krótko przedmiot na zdjęciu.",
      images: [photo],
      schema: z.object({ title: z.string(), color: z.string().nullable() }),
    });
    const info = await ctx.files.info(photo);
    return { data: { title, color, mime: info.mime } };
  },
},
```

</details>

## Host

The API host (`apps/api`) runs plugins with the same engine as the harness. Errors map to HTTP the way the
harness reports them: `requires` → 403, invalid input → 400 with Zod issues, a `DbError` or a bad file id
from the plugin → 400, a throwing handler or invalid UI/result → `500 plugin_error` for that request only.
Plugin tables are synced when the host starts (built-in and stored plugins) and when a plugin is uploaded; a
breaking schema change rejects the upload (400 `invalid_plugin`, stage `schema`; see [Checks](#checks)) and the
previous version keeps running. There is no endpoint for `streams` yet.

| Endpoint | Description |
|---|---|
| `GET /api/communities/:slug/nav` | navigation for the app |
| `GET /api/communities/:slug/dashboard` | `{ canEdit, widgets: [{ key, pluginId, widget, size, node }] }` rendered for the user: the widgets on the community's layout, in its order and sizes |
| `PATCH /api/communities/:slug/dashboard` `{ order }` | community admins: widget order (`"<pluginId>/<widget>"` keys), sizes and removed widgets stay; others 403 |
| `GET /api/communities/:slug/dashboard/layout` | community admins: `DashboardLayout` `{ columns, widgets, available }` — widgets on the dashboard (in order, with `title`, `size` and the allowed `sizes`) and the removed ones; others 403 |
| `PUT /api/communities/:slug/dashboard/layout` `{ widgets: [{ key, size }] }` | community admins: the whole layout (declared widgets left out are removed); 400 `invalid_layout` for a key that is not a widget of an enabled plugin or a size it does not allow; returns the new `DashboardLayout` |
| `GET /api/communities/:slug/plugins/:id/views/:view?…` | UI tree of a view |
| `POST /api/communities/:slug/plugins/:id/tools/:tool` `{ args }` | tool call |
| `POST /api/communities/:slug/plugins/:id/files` (multipart `file`) | upload → `{ fileId }` (pending) |
| `GET /api/files/:fileId?exp&sig` | file download via a signed URL |
| `GET /api/me/notifications` | the user's inbox across communities: `{ items: [{ id, community, pluginId, title, body, tone, open, createdAt, read }], unread }` (newest 50) |
| `POST /api/me/notifications/read` `{ ids? }` | mark as read (the given ids, or all) → `{ unread }` |
| `GET` / `POST /api/me/places` `{ label, lat, lng, address? }`, `DELETE /api/me/places/:id` | the user's saved places (private; ≤ 10; the account's addresses for nearby notifications) |
| `PUT /api/me/location` `{ lat, lng }`, `DELETE /api/me/location` | share / stop sharing the current position (counts for `near` for 30 min) |
| `POST` / `DELETE /api/me/push-tokens` `{ token }` | this phone gets / stops getting the user's pushes (Expo push token; moves to whoever registered it last) |
| `GET /api/communities/:slug/plugins` | place admins: the place's plugins with `enabled`, `madeByAi`, `draft`, `working` (built-in ones, then the AI ones) |
| `PUT /api/communities/:slug/plugins/:id` `{ enabled }` | place admins: switch a built-in or published AI plugin on or off |
| `POST /api/communities/:slug/plugins` `{ request }` | place admins: the AI makes a new plugin, a draft (201, its first version is being written; 503 `ai_unavailable`, 429 `rate_limited`) |
| `GET /api/communities/:slug/plugins/:id` | an AI plugin with its versions (`status`, `attempts`, `summary`, `outline`, `source`, `error`) and `published`; poll while `working` |
| `POST /api/communities/:slug/plugins/:id/versions` `{ request }` | a change → a new version (409 `busy` while one is being written) |
| `POST /api/communities/:slug/plugins/:id/publish` | install the latest ready version in the place and switch it on (409 `not_ready`; 400 `invalid_plugin`) |
| `POST /api/admin/plugins` `{ source }` | upload / replace a plugin (`PLUGIN_ADMIN_TOKEN`); a failed [check](#checks) → 400 `{ error: "invalid_plugin", message, stage, errors }` |
| `POST /api/admin/plugins/check` `{ source }` | the upload's [checks](#checks), storing nothing → 200 `PluginCheck` |
| `POST /api/admin/communities/:slug/plugins` `{ pluginId }` | enable a plugin in a community (runs `onInstall` once) |

**Built-in plugin:** package in `plugins/` + dependency in `apps/api/package.json` + entry in
`apps/api/src/plugins/builtin/index.ts`. **Runtime upload:** `bun run plugin:upload plugins/<id> <community>`
(requires `PLUGIN_ADMIN_TOKEN`).

### Checks

Every upload, and `POST /api/admin/plugins/check` (same checks, nothing stored, nothing changed), runs these
stages in order and stops at the first one that fails:

| Stage | How | Catches |
|---|---|---|
| `syntax` | Bun parses the source | the first syntax error |
| `imports` | runtime imports (`import type` is erased) | `import` / `export … from` / `import()` of a value |
| `types` | TypeScript against `@app/plugin-sdk` with `tsconfig.base.json`, but **no ambient types** | wrong tables, columns, UI props, results; Bun/Node/browser globals (`process`, `console`, `fetch`) |
| `safety` | the same program, walked (`apps/api/src/plugins/safety.ts`) | escape hatches out of ctx and the SDK: host globals (`globalThis`, `Function`, `eval`, `Reflect`, `Proxy`…), `.constructor` / `.prototype` / `__proto__` / `defineProperty` (also as strings), `declare`, `import.meta`, `@ts-ignore` / `@ts-expect-error`, calls through `any` or `Function`, changing objects the plugin did not declare (`JSON.parse = …`) |
| `load` | the factory runs, `loadPlugin` validates it | invalid manifest, `nav` → missing view, invalid tables, tools without Zod, built-in ids |
| `schema` | tables vs. the stored shape (`planSchema`, nothing applied) | breaking changes ([Schema evolution](#schema-evolution-no-migrations)) |

The result is `PluginCheck` from `@app/plugin-sdk` (at most 10 errors; `line`/`column` are 1-based, `snippet`
is that source line):

```ts
{ status: "ok", plugin: { id, version, views, dashboardWidgets, tools, streams, tables } }
{ status: "error", stage: "types", errors: [{ message: "Property 'notez' does not exist on type 'Database<…'. Did you mean 'notes'?", line: 21, column: 36, snippet: "const items = await ctx.db.notez.findMany();" }] }
```

`syntax`, `imports`, `types` and `safety` only read the source; `load` runs it in the API process (see Security below).
The `types` stage reads no disk: the compiler sees a recorded snapshot of the SDK types and the ES2023 library
(`apps/api/src/plugins/typecheck.ts`), which the production build writes next to the bundle (`plugin-types.json`).

**Security:** an uploaded plugin runs inside the API process ("trusted administrator" model: the admin token
grants full trust). Plugins written by AI for a place ([Plugin builder](#plugin-builder-ai)) run there too, so
the `safety` stage rejects the known ways out of `ctx` and the SDK, and the SDK object a plugin gets is frozen. It is a
static guard, not a sandbox. The contract is built for isolation — the module imports nothing and all access goes
through the async `ctx` — so moving plugins to a Worker/WASM sandbox changes the host, not plugin code.

### Plugin builder (AI)

The AI writes plugins for a place at its admin's request (Zarządzaj miejscem → Rozszerzenia → "Dodaj rozszerzenie" →
"Stwórz rozszerzenie z AI"; `apps/api/src/plugins/builder.ts`). The admin's description makes a plugin; every later
request changes it:

- **Author** (`PluginAuthor`, `apps/api/src/services/ai/author/`): in the host a Strands Agents agent on the env's
  model (`StrandsPluginAuthor` in `author/strands.ts`; `AI_API_KEY` + `AI_MODEL`, see `.env.example`) with one tool,
  `check_plugin` = the checks above. Its instructions are the host's rules plus this whole guide. It writes, checks,
  fixes (at most 8 checks, 5 minutes) and answers with a Polish summary for the admin. Without a model the builder
  answers `503 ai_unavailable`; tests and E2E use `TestPluginAuthor` (`PLUGIN_AUTHOR=test` in test-server). A place
  gets 20 requests to the AI a day (`429 rate_limited`).
- **Plugin and versions** (`place_plugin`, `plugin_version`): the plugin has a generated id (`ai-…`) owned by the place;
  each request is a version written in the background, with its source, the check outline and the AI's summary stored
  in SurrealDB. A source under another id never becomes ready, and the host checks the final source itself.
- **Draft → published:** until its first publication the plugin is a draft that only the place's admins see (it is in
  the place's plugin list with `draft: true`, and cannot be switched on). Publishing uploads the latest ready version
  (every check again, `schema` against the published tables) and enables it in that place; from then on it is
  switchable like a built-in plugin (`madeByAi`), and no other place can see or install it. The AI can change it any
  time: the new version runs in the place once it is published, and the plugin's data stays.

## Known issues

- The `safety` stage is a static guard over the source, not a sandbox: a determined author may still find a way out
  of `ctx` that it does not know. Plugins written by AI for a place
  run with the same trust as uploads until plugins move to a Worker/WASM sandbox (roadmap in README).

- The system user in `onInstall` has no account: seeded rows get `createdBy: null`, it cannot be stored in a
  `t.ref("user")` column and cannot attach pending uploads. Use optional user refs for seeded rows.
- `testPlugin().db` is untyped (`plugin.db.items!`): the harness gets the module, not its table types.
- The `types` and `safety` stages compile the source with TypeScript synchronously in the API process: ~1-2 s per
  check (the first one in a process much longer; the plugin builder warms the compiler up at start) during which the
  API answers nothing else. The plugin builder's author runs up to 8 checks per version. Fix: run checks in a Worker.
- A check that reaches `load` imports the source as a new module into the API process, and Bun never unloads
  modules: many checks (e.g. an AI agent iterating on a plugin) grow memory. Fix: run `load` in a disposable Worker.
- Tests share one embedded engine per process (`testEngine()`); never open another `mem://` connection
  (with @surrealdb/node 3.0.3, Bun 1.4 crashes on exit). See `docs/testing.md`.
