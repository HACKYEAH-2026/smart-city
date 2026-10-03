# Plugins

Every community feature (issue reports, discussions, lost & found…) is a plugin. The core only knows
communities, users and installations; plugins bring everything else: their own typed tables, tools
(actions), live streams and views.

> **Status (read first)**
> - **Ready and tested:** the plugin SDK (`packages/sdk`) — contract, typed tables on SurrealDB, `watch()`
>   streams, files, AI — and the test harness (`@app/plugin-sdk/testing`). You can write and test the
>   backend side of a plugin today, without the API.
> - **Ready:** the API host (`apps/api`) on SurrealDB — views, tools, file uploads, runtime plugin uploads
>   (tables synced on upload) and `onInstall`; see [Host](#host).
> - **Not yet:** an HTTP transport for `streams` (they work in the harness; the app cannot subscribe yet).

Contents: [Mental model](#mental-model) · [New plugin](#creating-a-plugin-package) ·
[Manifest](#manifest-permissions-roles) · [Tables](#tables) · [Schema evolution](#schema-evolution-no-migrations) ·
[`ctx.db`](#ctxdb) · [Files](#ctxfiles) · [AI](#ctxai) · [Tools & streams](#tools-streams-oninstall) ·
[Views](#views-ui) · [Widgets](#widgets-dashboard) · [Testing](#testing) · [Host](#host)

## Mental model

- A plugin is a package in `plugins/<id>/` that depends **only** on `@app/plugin-sdk`.
- The module imports **nothing at runtime** (only `import type`). Its default export is a factory
  `(sdk) => definePlugin({...})`; the host passes the SDK: `{ definePlugin, ui, z, fileRef, t }`
  (`t` = table builders, `z` = Zod 4, `fileRef` = Zod schema for an uploaded file id).
  This lets the same file run built-in, uploaded at runtime, or later in a sandbox.
- A plugin sees only `ctx`: `user` (with role in this community), `community`, `now()`, `lastVisit`, `db`, `files`, `ai`.
  No app database, no disk, no network.
- All data is **isolated per installation** (plugin × community): every query, reference and live
  stream is scoped to it.
- Code, identifiers and comments are in English; everything a resident sees (view titles, labels, toasts,
  `error` messages, Zod messages for user input, tool descriptions) is in Polish.

```
 plugin factory(sdk) ──► definePlugin({ tables, views, widgets, tools, streams })
                                │
 host ── ctx { user, community, now, lastVisit, db, files, ai } ──► view / widget / tool / stream handler
```

Reference plugins: `plugins/discussions` (best full example: two tables, refs, moderator rules, streams),
`plugins/announcements` (dashboard widget with `ctx.lastVisit`, admin-only tools),
`plugins/issues` (photos, `ai.findSimilar`, `upsert` on a unique key), `plugins/benches` (minimal).

## Creating a plugin package

1. `plugins/<id>/package.json` (copy from `plugins/benches`):

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

   const benches: PluginModule = ({ definePlugin, ui, z, t }) =>
     definePlugin({
       id: "benches",
       name: "Ławki",
       version: "1.0.0",
       permissions: ["db"],
       nav: [{ view: "main", label: "Ławki" }],
       tables: {
         benches: t.table({ park: t.text(), problem: t.text().default(""), reporter: t.ref("user").optional() }),
       },
       views: {
         main: async (ctx) => {
           const items = await ctx.db.benches.findMany();
           return ui.screen("Ławki w parkach", items.map((b) => ui.card({ title: b.park, subtitle: b.problem })));
         },
       },
       tools: {
         report: {
           description: "Zgłoś zepsutą ławkę w parku",
           input: z.object({ park: z.string().trim().min(1), problem: z.string().trim().max(200).default("") }),
           handler: async (ctx, input) => {
             await ctx.db.benches.insert({ ...input, reporter: ctx.user.id });
             return { toast: "Dziękujemy!", refresh: true };
           },
         },
       },
     });

   export default benches;
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
| `permissions` | subset of `"db"`, `"files"`, `"ai"`, default `[]` |
| `nav` | ≥ 1 entry `{ view, label (≤ 40) }`; each `view` must exist in `views` |
| `tables` | optional, see [Tables](#tables) |
| `views`, `widgets`, `tools`, `streams`, `onInstall` | see below |

**Permissions.** In the host, using `ctx.db` / `ctx.files` / `ctx.ai` without the matching permission rejects
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
optional `AI_BASE_URL`). Tests never call a model — use the harness mocks.

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
| Screen | `ui.screen(title, children)` — always the root |
| Widget | `ui.widget(title, children)` — the root of a [widget](#widgets-dashboard) |
| Stack / Row | `ui.stack([...])`, `ui.row([...])` |
| List | `ui.list(label, items)` |
| Card | `ui.card({ title, subtitle?, badge?: { text, tone? }, onPress?, children? })` |
| Heading / Text | `ui.heading(text, 2 \| 3)`, `ui.text(text, "ink" \| "soft"?)` |
| Badge | `ui.badge(text, tone?)` — `neutral`, `info`, `success`, `warning`, `danger` |
| Button | `ui.button(label, action, "primary" \| "quiet" \| "danger"?)` |
| Progress / Stat | `ui.progress({ value, max, label })`, `ui.stat(label, value)` |
| Empty | `ui.empty(text)` |
| Image | `ui.image(fileId, alt)` |
| Form | `ui.form({ submitLabel, submit: ui.tool(name), children })` — field values become tool `args` |
| TextInput / Select / ImagePicker | `ui.textInput({ name, label, multiline?, value? })`, `ui.select({ name, label, options, value? })`, `ui.imagePicker({ name, label })` — inside a Form |

A new node = schema + builder in `ui.ts` + a branch in `apps/app/src/plugins/Renderer.tsx`.

## Widgets (dashboard)

A plugin may put widgets on the community dashboard (optional). Each widget declares a fixed `size` in grid
cells — the dashboard is 2 columns wide, `w` is 1-2 columns and `h` is 1-3 rows — and a `render(ctx)` that
returns `ui.widget(title, children)`, or `null` to show nothing (e.g. no data yet). Widgets appear in the
order of installation, then declaration; content beyond the size is clipped.

```ts
widgets: {
  latest: {
    size: { w: 2, h: 3 },
    render: async (ctx) => {
      const since = ctx.lastVisit ? { createdAt: { gt: ctx.lastVisit } } : {};
      const fresh = await ctx.db.announcements.findMany({ where: since, orderBy: { createdAt: "desc" }, limit: 2 });
      return ui.widget("Ogłoszenia", [
        ...fresh.map((a) => ui.card({ title: a.title, onPress: ui.navigate("item", { id: a.id }) })),
        ui.button("Wszystkie ogłoszenia", ui.navigate("list"), "quiet"),
      ]);
    },
  },
},
```

- **Read-only:** no `Form`, inputs or tool actions anywhere in the tree (validated); `navigate` opens a view
  of the plugin. A widget that throws or returns invalid UI is left out of the dashboard (logged), the rest renders.
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
| `.widget(name)` | → validated widget `UINode` or `null` |
| `.stream(name, args?)` | → `AsyncIterator`; read with `next()`, finish with `return()` |
| `.invalidInput(name, args)` | Zod issues the host would answer 400 with, or `null` |
| `.as(user)` | the same harness acting as another user (`.tool/.view/.widget/.stream/.files.fake/.invalidInput/.ctx`) |
| `.files.fake(mime?)` | a pending upload by the acting user → `FileId` |
| `.files.isKept(id)` | `true` once a `t.ref("file")` column referenced it |
| `.ai.mockSimilar((query, candidates) => matches)` | `findSimilar` result (default `[]`) |
| `.ai.mockCall((req) => value)` | `call` result, parsed with `req.schema` if given (default: throws) |
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
breaking schema change rejects the upload (400 `invalid_plugin` with the `SchemaError` message) and the
previous version keeps running. There is no endpoint for `streams` yet.

| Endpoint | Description |
|---|---|
| `GET /api/communities/:slug/nav` | navigation for the app |
| `GET /api/communities/:slug/widgets` | dashboard: `[{ pluginId, widget, size, node }]` rendered for the user |
| `GET /api/communities/:slug/plugins/:id/views/:view?…` | UI tree of a view |
| `POST /api/communities/:slug/plugins/:id/tools/:tool` `{ args }` | tool call |
| `POST /api/communities/:slug/plugins/:id/files` (multipart `file`) | upload → `{ fileId }` (pending) |
| `GET /api/files/:fileId?exp&sig` | file download via a signed URL |
| `POST /api/admin/plugins` `{ source }` | upload / replace a plugin (`PLUGIN_ADMIN_TOKEN`) |
| `POST /api/admin/communities/:slug/plugins` `{ pluginId }` | enable a plugin in a community (runs `onInstall` once) |

**Built-in plugin:** package in `plugins/` + dependency in `apps/api/package.json` + entry in
`apps/api/src/plugins/builtin/index.ts`. **Runtime upload:** `bun run plugin:upload plugins/<id> <community>`
(requires `PLUGIN_ADMIN_TOKEN`).

**Security:** an uploaded plugin runs inside the API process ("trusted administrator" model: the admin token
grants full trust). The contract is built for isolation — the module imports nothing and all access goes
through the async `ctx` — so moving plugins to a Worker/WASM sandbox changes the host, not plugin code.

## Known issues

- The system user in `onInstall` has no account: seeded rows get `createdBy: null`, it cannot be stored in a
  `t.ref("user")` column and cannot attach pending uploads. Use optional user refs for seeded rows.
- `testPlugin().db` is untyped (`plugin.db.items!`): the harness gets the module, not its table types.
- Tests share one embedded engine per process (`testEngine()`); never open another `mem://` connection
  (with @surrealdb/node 3.0.3, Bun 1.4 crashes on exit). See `docs/testing.md`.
