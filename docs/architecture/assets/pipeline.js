/*
 * Page script of pipeline.html: the check-stage runner and the schema-change simulator.
 *
 * The results below are not made up: they were produced at commit 48d8d7f by sending each sample to
 * POST /api/admin/plugins/check (createApp on an in-memory SurrealDB, as in apps/api/test/plugin-check.test.ts) and by
 * running planSchema/syncSchema from @app/plugin-sdk/engine on a fresh in-memory database. When the checks or the
 * schema engine change, regenerate them the same way.
 */
(() => {
  const STAGES = ["syntax", "imports", "types", "safety", "load", "schema"];
  const STEP_MS = 260;
  const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  const escapeHtml = (text) =>
    text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

  /** Replaces the code element inside `pre` with fresh, highlighted content. */
  const setCode = (pre, lang, html) => {
    const code = document.createElement("code");
    code.dataset.lang = lang;
    code.innerHTML = html;
    pre.replaceChildren(code);
    window.Docs?.highlight(pre);
  };

  // ───────────────────────────── check runner ─────────────────────────────

  /** apps/api/test/fixtures/notes-plugin.ts at 48d8d7f: the smallest uploadable plugin (line numbers matter). */
  const NOTES = `import type { PluginModule } from "@app/plugin-sdk";

/**
 * Smallest plugin with a table, a form and a tool, for tests of plugins uploaded at runtime (apps/api/test and
 * apps/app/e2e send this file's source to POST /api/admin/plugins). A test fixture, not a product feature.
 */
const notes: PluginModule = ({ definePlugin, ui, z, t }) =>
  definePlugin({
    id: "notes",
    name: "Notatki",
    version: "1.0.0",
    icon: "📝",
    description: "Wspólne notatki członków społeczności.",
    permissions: ["db"],
    nav: [{ view: "main", label: "Notatki" }],
    tables: {
      notes: t.table({ title: t.text(), body: t.text().default(""), author: t.ref("user").optional() }),
    },
    views: {
      main: async (ctx) => {
        const items = await ctx.db.notes.findMany();
        return ui.screen("Tablica notatek", [
          ui.form({
            submitLabel: "Dodaj notatkę",
            submit: ui.tool("add"),
            children: [ui.textInput({ name: "title", label: "Tytuł" }), ui.textInput({ name: "body", label: "Treść" })],
          }),
          ui.list(
            "Wszystkie notatki",
            items.length
              ? items.map((n) => ui.card({ title: n.title, subtitle: n.body }))
              : [ui.empty("Nie ma jeszcze notatek.")],
          ),
        ]);
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
`;

  const must = (source, from, to) => {
    if (!source.includes(from)) throw new Error(`pipeline.js: sample edit not found: ${from}`);
    return source.replace(from, to);
  };

  const SAMPLES = [
    {
      id: "valid",
      label: "Valid plugin",
      intro:
        "The upload-test fixture <code>apps/api/test/fixtures/notes-plugin.ts</code>: one table, one view with a form, one tool. Every stage passes and the host answers with what the plugin declares.",
      source: () => NOTES,
      result: {
        status: "ok",
        plugin: {
          id: "notes",
          version: "1.0.0",
          name: "Notatki",
          icon: "📝",
          description: "Wspólne notatki członków społeczności.",
          views: ["main"],
          dashboardWidgets: [],
          tools: ["add"],
          streams: [],
          tables: ["notes"],
        },
      },
    },
    {
      id: "syntax",
      label: "Syntax error",
      intro: "A missing <code>)</code> in the tool handler. Bun's parser reports the first syntax error it meets.",
      source: () =>
        must(
          NOTES,
          "await ctx.db.notes.insert({ ...input, author: ctx.user.id });",
          "await ctx.db.notes.insert({ ...input, author: ctx.user.id };",
        ),
      result: {
        status: "error",
        stage: "syntax",
        errors: [
          {
            message: 'Expected ")" but found ";"',
            line: 42,
            column: 70,
            snippet: "await ctx.db.notes.insert({ ...input, author: ctx.user.id };",
          },
        ],
      },
    },
    {
      id: "imports",
      label: "Runtime import",
      intro:
        "The author imports Zod instead of using the <code>z</code> the factory receives. Only <code>import type</code> survives: the SDK arrives as the factory argument.",
      source: () => `import { z } from "zod";\n${NOTES}`,
      result: {
        status: "error",
        stage: "imports",
        errors: [
          {
            message:
              'Runtime import of "zod": a plugin may only use `import type`; the SDK (definePlugin, ui, z, fileRef, t) is the factory argument',
            line: 1,
            snippet: 'import { z } from "zod";',
          },
        ],
      },
    },
    {
      id: "types",
      label: "Type error",
      intro:
        "A typo in a table name. TypeScript knows the plugin's tables from its own declaration, suggests the right name, and the typo makes <code>n</code> lose its type too.",
      source: () => must(NOTES, "ctx.db.notes.findMany()", "ctx.db.notez.findMany()"),
      result: {
        status: "error",
        stage: "types",
        errors: [
          {
            message:
              "Property 'notez' does not exist on type 'Database<{ readonly notes: TableDef<{ readonly title: Column…'. Did you mean 'notes'?",
            line: 21,
            column: 36,
            snippet: "const items = await ctx.db.notez.findMany();",
          },
          {
            message: "Parameter 'n' implicitly has an 'any' type.",
            line: 31,
            column: 28,
            snippet: "? items.map((n) => ui.card({ title: n.title, subtitle: n.body }))",
          },
        ],
      },
    },
    {
      id: "safety",
      label: "Escape hatch",
      intro:
        "Valid TypeScript, but it reaches for the host: <code>globalThis</code> and a function constructor through <code>.constructor</code>. Both type-check, so the <code>safety</code> stage stops them.",
      source: () =>
        must(
          NOTES,
          "const items = await ctx.db.notes.findMany();",
          "const items = await ctx.db.notes.findMany();\n        const host = globalThis;\n        const AsyncFunction = (async () => {}).constructor;",
        ),
      result: {
        status: "error",
        stage: "safety",
        errors: [
          {
            message: "'globalThis' is not available to plugins: use only ctx and the SDK (ui, z, t, fileRef)",
            line: 22,
            column: 22,
            snippet: "const host = globalThis;",
          },
          {
            message: "'.constructor' is not allowed in plugins: it reaches the host's constructors and prototypes",
            line: 23,
            column: 31,
            snippet: "const AsyncFunction = (async () => {}).constructor;",
          },
        ],
      },
    },
    {
      id: "load",
      label: "Missing view",
      intro:
        "The navigation points to a view called <code>list</code>, but the plugin only has <code>main</code>. Types cannot see it (a view name is a string); <code>loadPlugin</code> runs the factory and checks it.",
      source: () =>
        must(NOTES, 'nav: [{ view: "main", label: "Notatki" }]', 'nav: [{ view: "list", label: "Notatki" }]'),
      result: {
        status: "error",
        stage: "load",
        errors: [{ message: 'Nav entry "Notatki" points to missing view "list"' }],
      },
    },
    {
      id: "builtin",
      label: "Built-in id",
      intro:
        "A valid plugin that claims the id of a built-in plugin. Built-in ids are reserved, so an upload can never replace <code>issues</code>.",
      source: () => must(NOTES, 'id: "notes"', 'id: "issues"'),
      result: { status: "error", stage: "load", errors: [{ message: '"issues" is a built-in plugin' }] },
    },
    {
      id: "schema",
      label: "Breaking table change",
      intro:
        "Version 1.1.0 of <code>notes</code>, checked after 1.0.0 was uploaded. The code is fine (it even writes <code>pinned</code>), but rows stored by 1.0.0 have no value for a new required column.",
      source: () =>
        must(
          must(
            must(NOTES, 'version: "1.0.0"', 'version: "1.1.0"'),
            'author: t.ref("user").optional() }),',
            'author: t.ref("user").optional(), pinned: t.boolean() }),',
          ),
          "await ctx.db.notes.insert({ ...input, author: ctx.user.id });",
          "await ctx.db.notes.insert({ ...input, pinned: false, author: ctx.user.id });",
        ),
      result: {
        status: "error",
        stage: "schema",
        errors: [{ message: 'New column "notes.pinned" must be .optional() or have .default(...)' }],
      },
    },
  ];

  /** What an upload of the same source answers (routes/admin.ts + PluginCheckError in packages/sdk/src/check.ts). */
  const uploadAnswer = (result) => {
    if (result.status === "ok") {
      return `POST /api/admin/plugins → <strong class="ok-text">201</strong> with the parsed manifest; the plugin is stored and registered`;
    }
    const describe = (issue) =>
      issue.line === undefined ? issue.message : `line ${issue.line}:${issue.column ?? 1}: ${issue.message}`;
    const body = {
      error: "invalid_plugin",
      message: `${result.stage}: ${result.errors.map(describe).join("; ")}`,
      stage: result.stage,
      errors: "[…as above]",
    };
    return `POST /api/admin/plugins → <strong class="bad-text">400</strong> ${escapeHtml(JSON.stringify(body))}`;
  };

  /** Source lines as numbered spans; lines that differ from the fixture and lines with errors are marked. */
  const sourceHtml = (source, result) => {
    const original = new Set(NOTES.split("\n"));
    const errorLines = new Set(result.status === "error" ? result.errors.map((e) => e.line).filter(Boolean) : []);
    const lines = source.replace(/\n$/, "").split("\n");
    const inComment = (index) => {
      const opened = lines.slice(0, index + 1).findLastIndex((l) => l.trim().startsWith("/**"));
      const closed = lines.slice(0, index).findLastIndex((l) => l.trim().endsWith("*/"));
      return opened !== -1 && opened > closed;
    };
    return lines
      .map((line, i) => {
        const n = i + 1;
        const classes = ["ln", original.has(line) ? "" : "is-changed", errorLines.has(n) ? "is-error" : ""];
        const text = escapeHtml(line);
        const content = inComment(i) ? `<span class="tok-comment">${text}</span>` : text;
        return `<span class="${classes.filter(Boolean).join(" ")}" data-line="${n}">${content}</span>`;
      })
      .join("");
  };

  const initRunner = (runner) => {
    const pills = runner.querySelector("[data-sample-pills]");
    const intro = runner.querySelector("[data-sample-intro]");
    const stages = new Map([...runner.querySelectorAll("[data-stage]")].map((li) => [li.dataset.stage, li]));
    const sourcePre = runner.querySelector("[data-sample-source]");
    const resultPre = runner.querySelector("[data-sample-result]");
    const http = runner.querySelector("[data-sample-http]");
    const status = runner.querySelector("[data-sample-status]");
    const run = { token: 0 };

    const setStage = (stage, state, text) => {
      const li = stages.get(stage);
      li.dataset.state = state;
      li.querySelector(".stage-state").textContent = text;
    };

    const finish = (sample) => {
      const { result } = sample;
      setCode(resultPre, "json", escapeHtml(JSON.stringify(result, null, 2)));
      http.innerHTML = `POST /api/admin/plugins/check → <strong>200</strong> (always; the verdict is in the body)<br />${uploadAnswer(result)}`;
      status.textContent =
        result.status === "ok"
          ? `${sample.label}: every stage passed.`
          : `${sample.label}: failed at the ${result.stage} stage with ${result.errors.length} issue(s).`;
    };

    const animate = (sample, token) => {
      const failedAt = sample.result.status === "error" ? STAGES.indexOf(sample.result.stage) : STAGES.length;
      const delay = reducedMotion() ? 0 : STEP_MS;
      const step = (i) => {
        if (token !== run.token) return;
        if (i > 0) {
          const previous = STAGES[i - 1];
          if (i - 1 === failedAt) {
            setStage(previous, "failed", "✕ failed");
            for (const later of STAGES.slice(i)) setStage(later, "skipped", "not run");
            finish(sample);
            return;
          }
          setStage(previous, "passed", "✓ passed");
        }
        if (i === STAGES.length) {
          finish(sample);
          return;
        }
        setStage(STAGES[i], "running", "running…");
        setTimeout(() => step(i + 1), delay);
      };
      step(0);
    };

    const select = (id) => {
      const sample = SAMPLES.find((s) => s.id === id) ?? SAMPLES[0];
      run.token += 1;
      for (const pill of pills.querySelectorAll("[data-sample]")) {
        pill.setAttribute("aria-pressed", String(pill.dataset.sample === sample.id));
      }
      intro.innerHTML = sample.intro;
      const source = sample.source();
      setCode(sourcePre, "ts", sourceHtml(source, sample.result));
      const marked = sourcePre.querySelector(".is-error") ?? sourcePre.querySelector(".is-changed");
      sourcePre.scrollTop = marked ? Math.max(0, marked.offsetTop - sourcePre.clientHeight / 3) : 0;
      for (const stage of STAGES) setStage(stage, "pending", "waiting");
      setCode(resultPre, "json", "…");
      http.textContent = "";
      animate(sample, run.token);
    };

    for (const sample of SAMPLES) {
      const pill = document.createElement("button");
      pill.type = "button";
      pill.className = "pill";
      pill.dataset.sample = sample.id;
      pill.textContent = sample.label;
      pill.addEventListener("click", () => select(sample.id));
      pills.append(pill);
    }
    select("valid");
  };

  // ───────────────────────────── schema simulator ─────────────────────────────

  /** One change to the `notes` table declared in the page; `diff` lines start with "+" or "-". */
  const CHANGES = [
    {
      id: "addOptional",
      group: "Add",
      label: "Optional column",
      diff: ["+     pinned: t.boolean().optional(),"],
      note: "Existing rows read <code>pinned</code> as <code>null</code>. The field is declared with an <code>option&lt;…&gt;</code> type, so SCHEMAFULL accepts rows without it.",
      ok: true,
      statements: [
        "DEFINE FIELD IF NOT EXISTS pinned ON p_notes__notes TYPE option<bool>;",
        'UPSERT plugin_schema:p_notes__notes SET columns = { …stored shape… }, indexes = ["p_notes__notes__i_status"];',
      ],
      total: 9,
    },
    {
      id: "addDefault",
      group: "Add",
      label: "Column with a default",
      diff: ["+     pinned: t.boolean().default(false),"],
      note: "The field is declared first (SCHEMAFULL rejects undeclared fields), then rows written before it existed are <strong>backfilled</strong> with the default, in the same transaction.",
      ok: true,
      statements: [
        "DEFINE FIELD IF NOT EXISTS pinned ON p_notes__notes TYPE bool;",
        "UPDATE p_notes__notes SET pinned = false WHERE pinned = NONE;",
        'UPSERT plugin_schema:p_notes__notes SET columns = { …stored shape… }, indexes = ["p_notes__notes__i_status"];',
      ],
      total: 10,
    },
    {
      id: "addRequired",
      group: "Add",
      label: "Required column",
      diff: ["+     pinned: t.boolean(),"],
      note: "Rows stored by the previous version have no value for it. Make it <code>.optional()</code> or give it a <code>.default(…)</code>.",
      ok: false,
      error: 'SchemaError: New column "notes.pinned" must be .optional() or have .default(...)',
    },
    {
      id: "addRef",
      group: "Add",
      label: "Reference with a default",
      diff: ['+     editor: t.ref("user").default("system"),'],
      note: "A new <code>t.ref(…)</code> column must be <code>.optional()</code>; a default is not enough.",
      ok: false,
      error: 'SchemaError: New reference column "notes.editor" must be .optional()',
    },
    {
      id: "addEnum",
      group: "Add",
      label: "Enum value",
      diff: [
        '-     status: t.enum(["open", "done"]).default("open"),',
        '+     status: t.enum(["open", "done", "archived"]).default("open"),',
      ],
      note: "The field is redefined (<code>OVERWRITE</code>) with the wider type. New values may go anywhere in the list.",
      ok: true,
      statements: [
        'DEFINE FIELD OVERWRITE status ON p_notes__notes TYPE "open" | "done" | "archived";',
        'UPSERT plugin_schema:p_notes__notes SET columns = { …stored shape… }, indexes = ["p_notes__notes__i_status"];',
      ],
      total: 9,
    },
    {
      id: "addIndex",
      group: "Add",
      label: "Index",
      diff: ['-   { indexes: [["status"]] },', '+   { indexes: [["status"], ["author", "createdAt"]] },'],
      note: "Every index starts with <code>installation</code>, so it serves the queries of one community. System columns (<code>createdAt</code>, <code>updatedAt</code>, <code>createdBy</code>) may be indexed too.",
      ok: true,
      statements: [
        "DEFINE INDEX IF NOT EXISTS p_notes__notes__i_author_createdAt ON p_notes__notes FIELDS installation, author, created_at;",
        'UPSERT plugin_schema:p_notes__notes SET columns = { …stored shape… }, indexes = ["p_notes__notes__i_status","p_notes__notes__i_author_createdAt"];',
      ],
      total: 9,
    },
    {
      id: "addUnique",
      group: "Add",
      label: "Unique",
      diff: ['-   { indexes: [["status"]] },', '+   { indexes: [["status"]], unique: [["title"]] },'],
      note: "Unique <em>within one installation</em> (the index starts with <code>installation</code>). The plan passes, but if stored rows already hold duplicates, applying it fails and the whole sync rolls back: <code>SchemaError: Cannot apply tables of &quot;notes&quot;: The query was not executed due to a failed transaction</code>.",
      ok: true,
      statements: [
        "DEFINE INDEX IF NOT EXISTS p_notes__notes__u_title ON p_notes__notes FIELDS installation, title UNIQUE;",
        'UPSERT plugin_schema:p_notes__notes SET columns = { …stored shape… }, indexes = ["p_notes__notes__i_status","p_notes__notes__u_title"];',
      ],
      total: 9,
    },
    {
      id: "addTable",
      group: "Add",
      label: "Table",
      diff: ['+ tags: t.table({ label: t.text(), note: t.ref("notes") }),'],
      note: "A new table has no rows, so every column is created as declared, required ones included. It gets the system fields and the <code>installation</code> index like every plugin table.",
      ok: true,
      statements: [
        "DEFINE TABLE IF NOT EXISTS p_notes__tags SCHEMAFULL;",
        "DEFINE FIELD IF NOT EXISTS installation ON p_notes__tags TYPE record<plugin_installation> REFERENCE ON DELETE CASCADE;",
        "DEFINE FIELD IF NOT EXISTS created_at ON p_notes__tags TYPE datetime;",
        "DEFINE FIELD IF NOT EXISTS updated_at ON p_notes__tags TYPE datetime;",
        "DEFINE FIELD IF NOT EXISTS created_by ON p_notes__tags TYPE option<record<user>> REFERENCE ON DELETE UNSET;",
        "DEFINE INDEX IF NOT EXISTS p_notes__tags__created ON p_notes__tags FIELDS installation, created_at;",
        "DEFINE FIELD IF NOT EXISTS label ON p_notes__tags TYPE string;",
        "DEFINE FIELD IF NOT EXISTS note ON p_notes__tags TYPE record<p_notes__notes> REFERENCE ON DELETE CASCADE;",
        "UPSERT plugin_schema:p_notes__tags SET columns = { …stored shape… }, indexes = [];",
      ],
      total: 17,
    },
    {
      id: "changeType",
      group: "Change",
      label: "Column type",
      diff: ["-     title: t.text(),", "+     title: t.integer(),"],
      note: "Stored strings would not be integers. Add a new column (e.g. <code>titleNumber</code>), write both, read the new one.",
      ok: false,
      error: 'SchemaError: Column "notes.title" changed type (text → integer); add a new column instead',
    },
    {
      id: "relax",
      group: "Change",
      label: "Required → optional",
      diff: ["-     title: t.text(),", "+     title: t.text().optional(),"],
      note: "Relaxing: every stored value stays valid, so the field is redefined with an <code>option&lt;…&gt;</code> type.",
      ok: true,
      statements: [
        "DEFINE FIELD OVERWRITE title ON p_notes__notes TYPE option<string>;",
        'UPSERT plugin_schema:p_notes__notes SET columns = { …stored shape… }, indexes = ["p_notes__notes__i_status"];',
      ],
      total: 9,
    },
    {
      id: "tighten",
      group: "Change",
      label: "Optional → required",
      diff: ['-     author: t.ref("user").optional(),', '+     author: t.ref("user"),'],
      note: "Stored rows may hold <code>null</code>. Add a new required-by-convention column instead.",
      ok: false,
      error: 'SchemaError: Column "notes.author" became required; add a new column instead',
    },
    {
      id: "onDelete",
      group: "Change",
      label: "Ref onDelete",
      diff: [
        '-     author: t.ref("user").optional(),',
        '+     author: t.ref("user", { onDelete: "restrict" }).optional(),',
      ],
      note: 'Only the reference clause changes: an optional ref defaults to <code>"set null"</code> (<code>UNSET</code>); <code>"restrict"</code> becomes <code>REJECT</code>.',
      ok: true,
      statements: [
        "DEFINE FIELD OVERWRITE author ON p_notes__notes TYPE option<record<user>> REFERENCE ON DELETE REJECT;",
        'UPSERT plugin_schema:p_notes__notes SET columns = { …stored shape… }, indexes = ["p_notes__notes__i_status"];',
      ],
      total: 9,
    },
    {
      id: "retarget",
      group: "Change",
      label: "Ref target",
      diff: ['-     author: t.ref("user").optional(),', '+     author: t.ref("file").optional(),'],
      note: "Stored ids point to users, not files. Add a new column instead.",
      ok: false,
      error: 'SchemaError: Column "notes.author" changed its reference target; add a new column instead',
    },
    {
      id: "changeDefault",
      group: "Change",
      label: "Default value",
      diff: ['-     body: t.text().default(""),', '+     body: t.text().default("(brak treści)"),'],
      note: "Nothing to apply: defaults are filled in by the engine on insert (<code>ctx.db</code>), not by the database, and the stored shape does not include them. Existing rows keep their values; only future inserts change.",
      ok: true,
      statements: [],
      total: 8,
    },
    {
      id: "removeEnum",
      group: "Remove",
      label: "Enum value",
      diff: [
        '-     status: t.enum(["open", "done"]).default("open"),',
        '+     status: t.enum(["open"]).default("open"),',
      ],
      note: "Stored rows may hold the removed value. Add a new column instead.",
      ok: false,
      error: 'SchemaError: Column "notes.status" removed enum values; add a new column instead',
    },
    {
      id: "removeOptional",
      group: "Remove",
      label: "Optional column",
      diff: ['-     author: t.ref("user").optional(),'],
      note: "The field <strong>and its data</strong> are dropped, in every community at once. The name can be reused later with any type.",
      ok: true,
      statements: [
        "REMOVE FIELD IF EXISTS author ON p_notes__notes;",
        "UPDATE p_notes__notes UNSET author;",
        'UPSERT plugin_schema:p_notes__notes SET columns = { …stored shape… }, indexes = ["p_notes__notes__i_status"];',
      ],
      total: 10,
    },
    {
      id: "removeRequired",
      group: "Remove",
      label: "Required column",
      diff: ["-     title: t.text(),"],
      note: "Two versions: first make it <code>.optional()</code> and ship that, then remove it.",
      ok: false,
      error: 'SchemaError: Required column "notes.title" was removed; make it .optional() first',
    },
    {
      id: "removeIndex",
      group: "Remove",
      label: "Index",
      diff: ['-   { indexes: [["status"]] },', "+   {},"],
      note: "The index is dropped and no longer used or enforced.",
      ok: true,
      statements: [
        "REMOVE INDEX IF EXISTS p_notes__notes__i_status ON p_notes__notes;",
        "UPSERT plugin_schema:p_notes__notes SET columns = { …stored shape… }, indexes = [];",
      ],
      total: 8,
    },
    {
      id: "removeTable",
      group: "Remove",
      label: "Table",
      diff: ["- notes: t.table({ … }),"],
      note: "No error and no statements: the table, its rows and its stored shape stay. Declaring it again later is checked against that stored shape.",
      ok: true,
      statements: [],
      total: 0,
    },
  ];

  const diffHtml = (lines) =>
    lines
      .map((line) => {
        const kind = line.startsWith("+") ? "d-add" : line.startsWith("-") ? "d-del" : "";
        return `<span class="d ${kind}">${escapeHtml(line)}</span>`;
      })
      .join("");

  const initSimulator = (sim) => {
    const groups = sim.querySelector("[data-change-groups]");
    const diff = sim.querySelector("[data-change-diff]");
    const verdict = sim.querySelector("[data-change-verdict]");
    const note = sim.querySelector("[data-change-note]");
    const statements = sim.querySelector("[data-change-statements]");
    const count = sim.querySelector("[data-change-count]");

    const select = (id) => {
      const change = CHANGES.find((c) => c.id === id) ?? CHANGES[0];
      for (const pill of groups.querySelectorAll("[data-change]")) {
        pill.setAttribute("aria-pressed", String(pill.dataset.change === change.id));
      }
      setCode(diff, "ts", diffHtml(change.diff));
      verdict.innerHTML = change.ok
        ? `<span class="chip ok">✓ applied</span><span class="muted small">compatible: every stored row stays valid</span>`
        : `<span class="chip bad">✕ rejected</span><span class="message">${escapeHtml(change.error)}</span>`;
      note.innerHTML = change.note;
      if (!change.ok) {
        setCode(
          statements,
          "sql",
          '-- nothing runs: planSchema throws before the transaction,\n-- the upload answers 400 (stage "schema") and the previous version keeps running',
        );
        count.textContent = "";
        return;
      }
      const sql = change.statements.length ? change.statements.join("\n") : "-- no statements specific to this change";
      setCode(statements, "sql", escapeHtml(sql));
      count.textContent = `${change.total} statements in one transaction; ${change.statements.length} differ from a sync of the unchanged declaration (the rest repeat what is already there: DEFINE … IF NOT EXISTS and the same stored shape).`;
    };

    for (const group of ["Add", "Change", "Remove"]) {
      const row = document.createElement("div");
      row.className = "sim-group";
      const label = document.createElement("span");
      label.className = "sim-group-label";
      label.textContent = group;
      row.append(label);
      for (const change of CHANGES.filter((c) => c.group === group)) {
        const pill = document.createElement("button");
        pill.type = "button";
        pill.className = "pill";
        pill.dataset.change = change.id;
        pill.textContent = change.label;
        pill.addEventListener("click", () => select(change.id));
        row.append(pill);
      }
      groups.append(row);
    }
    select(CHANGES[0].id);
  };

  // ───────────────────────────── start ─────────────────────────────

  for (const runner of document.querySelectorAll("[data-check-runner]")) initRunner(runner);
  for (const sim of document.querySelectorAll("[data-schema-sim]")) initSimulator(sim);
})();
