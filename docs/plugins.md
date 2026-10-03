# Plugins

Every community feature (issue reports, initiatives, polls…) is a plugin. The core only knows
communities, users and installations; plugins provide everything else.

## How it works

```
 Plugin (API, Bun)                          App (Expo: iOS / Android / web)
 views.list(ctx) ──► { type: "Screen", … } ──► PluginRenderer ──► native primitives from ui.tsx
 tools.report    ◄── POST …/tools/report  ◄── button / form (an action is data, not code)
```

- **Server-Driven UI.** A plugin view returns a tree of nodes from a closed catalog
  (`packages/sdk/src/ui.ts`, package `@app/plugin-sdk`). The app never executes plugin code, so a new
  plugin needs no new app release, and every plugin looks consistent and is accessible (WCAG).
- **Actions are data:** `navigate` (another view of the same plugin) or `tool` (a tool call
  with the form data). See "Tool result" below.
- **Data isolation:** `ctx.storage` and `ctx.files` are scoped to one installation (plugin × community).
  A plugin cannot see the database, the disk, or data of other communities and plugins.
- **Validation at the boundary:** the manifest, tool input (Zod), `requires` and the returned UI are checked by
  the host. A plugin failure yields `500 plugin_error` for that request; the rest of the API keeps working.
- **Language:** plugin code is in English; the content it renders for residents (titles, labels, toasts,
  user-facing validation messages) is in Polish.

## Writing a plugin

The module default-exports a function that receives the SDK from the host (`definePlugin`, `ui`, `z`, `fileRef`).
It imports nothing at runtime (only `import type`), so the same file works as a built-in plugin and as one
uploaded at runtime. Each plugin is a package in `plugins/<id>/` that depends **only** on
`@app/plugin-sdk` — importing anything from `apps/api` fails the typecheck.
Patterns: `plugins/issues` (built-in: photos, AI, roles) and `plugins/benches` (uploaded at runtime).

```ts
import type { PluginModule } from "@app/plugin-sdk";

const benches: PluginModule = ({ definePlugin, ui, z, fileRef }) =>
  definePlugin({
    id: "benches",                          // [a-z][a-z0-9-], unique
    name: "Ławki",                          // shown to residents (Polish)
    version: "1.0.0",
    icon: "🪑",
    permissions: ["storage", "files"],      // without a permission ctx.storage / ctx.files / ctx.ai throws
    nav: [{ view: "main", label: "Ławki" }],
    onInstall: async (ctx) => { /* seed data; ctx.user = system (admin) */ },
    views: {
      main: async (ctx) => ui.screen("Ławki w parkach", [ /* nodes */ ]),
    },
    tools: {
      report: {
        description: "Zgłoś zepsutą ławkę",  // also for AI assistants (MCP)
        input: z.object({ park: z.string().min(1), photo: fileRef().optional() }),
        requires: "user",                   // "user" (default) | "admin" — the host returns 403
        handler: async (ctx, input) => {
          if (input.photo) await ctx.files.keep(input.photo);
          await ctx.storage.create("benches", input);
          return { toast: "Dziękujemy!", refresh: true };
        },
      },
    },
  });

export default benches;
```

## Plugin API (`ctx`)

```ts
ctx.user        { id, name, role: "admin" | "user" }   // role in this community
ctx.community   { id, slug, name }
ctx.now()       Date                                    // controllable in tests (t.setNow)

ctx.storage     // "storage": JSON documents isolated per installation (plugin × community)
  .get(col, id)                          → Doc | null
  .list(col, { where?, order?, limit? }) → Doc[]       // where: equality on fields: { issueId, pinned: true }
  .create(col, data)                     → Doc          // the host generates the id
  .upsert(col, key, data)                → Doc          // id = key: one record per key (e.g. one vote per person)
  .update(col, id, patch)                → Doc | null   // shallow merge
  .remove(col, id)                       → boolean

ctx.files       // "files": photos sent by the app (POST …/files → FileId)
  .keep(id)     // confirm this user's upload; unconfirmed uploads are deleted after 24 h
  .info(id)     → { mime, size }
  .remove(id)

ctx.ai          // "ai": the provider is host configuration (Strands + an OpenAI-compatible model)
  .call({ prompt, images?, schema? })  → text, or an object matching the Zod schema
  .findSimilar({ text, image? }, candidates, { text, image?, limit? }) → { doc, score, reason }[]
```

**Tool result:** `{ toast?, error?, navigate?, close?, refresh?, data? }` — `error` is a message for the user
(nothing was saved), `data` is the result for AI assistants. `readOnly: true` marks a tool without side effects.

Without a configured model `findSimilar` works lexically (shared words), so tests and the demo need no key.
With a model, the model decides "is this the same problem" (using the query image) and returns a reason.
API configuration: `AI_API_KEY`, `AI_MODEL`, optionally `AI_BASE_URL` (any OpenAI-compatible endpoint).

### Plugin tests (no API, database or AI model)

```ts
import { ForbiddenError, testPlugin, textsOf } from "@app/plugin-sdk/testing";
import issues from "./index";

const t = testPlugin(issues, { user: { id: "alice", name: "Alice", role: "user" } });
t.ai.mockSimilar((query, candidates) => []);                       // AI mock
const photo = t.files.fake();                                      // "upload" by the current user
const res = await t.tool("report", { title: "Latarnia", photo });  // Zod validation and requires as in the host
expect(t.files.isKept(photo)).toBe(true);
expect(textsOf(await t.view("detail", res.navigate!.params))).toContain("Latarnia");
await expect(t.tool("setStatus", { id, status: "fixed" })).rejects.toBeInstanceOf(ForbiddenError);
await t.as({ id: "city", name: "Urząd", role: "admin" }).tool("setStatus", { id, status: "fixed" });
```

### Component catalog

| Node | Builder | Notes |
|---|---|---|
| Screen | `ui.screen(title, children)` | always the root of a view |
| Stack / Row | `ui.stack([...])`, `ui.row([...])` | vertical layout / wrapping row |
| List | `ui.list(label, items)` | `role="list"`, children as `listitem` |
| Card | `ui.card({ title, subtitle?, badge?, onPress?, children? })` | with `onPress` it is a button |
| Heading / Text | `ui.heading(text, 2\|3)`, `ui.text(text, "soft"?)` | |
| Badge | `ui.badge(text, tone?)` | tone: neutral, info, success, warning, danger |
| Button | `ui.button(label, action, variant?)` | variant: primary, quiet, danger |
| Progress / Stat | `ui.progress({ value, max, label })`, `ui.stat(label, value)` | |
| Empty | `ui.empty(text)` | empty state |
| Image | `ui.image(fileId, alt)` | a photo from `ctx.files`; the host adds a signed URL (valid 1 h) |
| Form | `ui.form({ submitLabel, submit: ui.tool(name), children })` | field values go into the tool `args` |
| TextInput / Select | `ui.textInput({ name, label, multiline?, value? })`, `ui.select({ name, label, options, value? })` | only inside a Form |
| ImagePicker | `ui.imagePicker({ name, label })` | only inside a Form: the app uploads the photo and puts the FileId into `args` |

A new component: schema in `ui.ts` + builder in `ui` + a branch in `apps/app/src/plugins/Renderer.tsx`.
An older app shows a notice in place of an unknown node instead of crashing.

## Installing

**Built-in:** a package in `plugins/` + a dependency in `apps/api/package.json` + an entry in `apps/api/src/plugins/builtin/index.ts`.

**At runtime (no restart):** the admin API, protected by `PLUGIN_ADMIN_TOKEN`
(without this variable the whole `/api/admin/*` returns 404).

```bash
bun run dev                                    # API :4000 + app
bun run plugin:upload plugins/benches krakow   # upload and enable in a community
```

The open app polls the navigation every 5 s, so a new feature appears without a reload.
The uploaded plugin source is stored in the database (`plugin_sources`) and reloaded after a restart.

| Endpoint | Description |
|---|---|
| `POST /api/admin/plugins` `{ source }` | upload / replace a plugin (validates manifest, views, tools) |
| `GET /api/admin/plugins` | list of loaded plugins |
| `POST /api/admin/communities` `{ slug, name }` | new community |
| `POST /api/admin/communities/:slug/plugins` `{ pluginId }` | enable a plugin in a community (runs `onInstall` once) |
| `POST /api/admin/communities/:slug/admins` `{ email }` | make a user a community admin |
| `GET /api/communities/:slug` | community + the current user's role |
| `GET /api/communities/:slug/nav` | navigation (for the app) |
| `GET /api/communities/:slug/plugins/:id/views/:view?…` | UI tree of a view |
| `POST /api/communities/:slug/plugins/:id/tools/:tool` `{ args }` | tool call |
| `POST /api/communities/:slug/plugins/:id/files` (multipart `file`) | photo upload → `{ fileId }` |
| `GET /api/files/:fileId?exp&sig` | photo download via a signed URL |

## Security (current state and next steps)

An uploaded plugin runs **inside the API process** — a "trusted administrator" model: the
`PLUGIN_ADMIN_TOKEN` grants full trust. The contract is designed for isolation from the start, though:
the module imports nothing and all access goes through the asynchronous `ctx`. Moving plugins into a
Worker or a WebAssembly sandbox changes the `ctx` transport in the host, not the plugin code.

Next: resident verification (`ctx.user.verified`), plugin tools as an MCP server (description, `readOnly`
and `z.toJSONSchema(input)` are already in the contract), embeddings in `findSimilar` for large numbers of
reports, files in R2 instead of on disk (`FileStore`), isolation of third-party plugins.
