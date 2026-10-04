/*
 * Widgets of plugins.html: the tool-call walkthrough, ctx permissions, isolation, the ctx.db query builder, the
 * watch() simulator and the Server-Driven UI simulator. Every behaviour mirrors the code it explains (paths in the
 * page); when the code changes, change this file with it.
 */
(() => {
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  const $ = (id) => document.getElementById(id);

  /** Puts plain text into a highlighted <code> element (re-highlighting it). */
  const setCode = (el, text) => {
    el.textContent = text;
    delete el.dataset.highlighted;
    window.Docs.highlight(el.parentElement);
  };

  /** Like setCode, with some lines wrapped in a class (e.g. denied calls). */
  const setCodeLines = (el, lines) => {
    el.innerHTML = lines
      .map(([text, cls]) => (cls ? `<span class="${cls}">${esc(text)}</span>` : esc(text)))
      .join("\n");
    delete el.dataset.highlighted;
    window.Docs.highlight(el.parentElement);
  };

  const snippet = (path, lang, src) =>
    `<figure class="snippet"><figcaption><span>${esc(path)}</span></figcaption><pre class="code"><code data-lang="${lang}">${esc(src)}</code></pre></figure>`;

  /** Pill buttons acting as tabs; calls `onPick(value)` with the selected one. */
  const pills = (container, options, onPick) => {
    container.innerHTML = options
      .map(
        ([value, label], i) =>
          `<button class="pill" type="button" role="tab" data-value="${esc(value)}" aria-selected="${i === 0}">${esc(label)}</button>`,
      )
      .join("");
    const buttons = [...container.querySelectorAll("button")];
    const pick = (value) => {
      for (const b of buttons) b.setAttribute("aria-selected", String(b.dataset.value === value));
      onPick(value);
    };
    for (const b of buttons) b.addEventListener("click", () => pick(b.dataset.value));
    pick(options[0][0]);
  };

  // ───────────────────────────── 1. a tap, step by step ─────────────────────────────

  const LANE = {
    app: "App",
    route: "Route",
    host: "PluginHost",
    plugin: "Plugin",
    engine: "ctx.db engine",
    db: "SurrealDB",
  };
  const LAYER = { app: "app", route: "api", host: "api", plugin: "plugin", engine: "sdk", db: "db" };

  const step = (lane, title, body, ...codes) => ({ lane, title, body, codes });

  const PUBLISH_CALL = `POST /api/communities/krakow/plugins/announcements/tools/publish
Authorization: Bearer <session token>

{ "args": { "title": "Przerwa w dostawie wody", "body": "We wtorek od 8 do 14." } }`;

  const AUTH = step(
    "route",
    "Session and body checked",
    `<p><code>requireUser</code> asks Better Auth for the session (no session → <code>401 unauthorized</code>). The
     router's second middleware awaits <code>plugins.ready()</code> (tables synced, stored plugins loaded), and
     <code>zValidator("json", toolCallSchema)</code> checks that the body is <code>{ args }</code>.</p>`,
    snippet(
      "apps/api/src/routes/communities.ts",
      "ts",
      `export const communitiesRoutes = new Hono<AppEnv>()
  .use(requireUser)
  .use(async (c, next) => {
    await c.var.plugins.ready();
    await next();
  })
  // …
  .post("/:slug/plugins/:pluginId/tools/:tool", zValidator("json", toolCallSchema), async (c) => {
    const target = await resolve(c, c.req.param("slug"), c.req.param("pluginId"));
    if (!target) return c.json({ error: "not_found" }, 404);
    const tool = c.req.param("tool");
    if (!target.plugin.definition.tools?.[tool]) return c.json({ error: "not_found" }, 404);
    try {
      const result = await c.var.plugins.callTool(target.plugin, tool, target.ctx, c.req.valid("json").args);
      return c.json(result, 200);
    } catch (err) {
      return pluginFailure(c, err);
    }
  })`,
    ),
  );

  const RESOLVE_CODE = snippet(
    "apps/api/src/routes/communities.ts",
    "ts",
    `async function resolve(c: Context<AppEnv>, slug: string, pluginId: string) {
  const row = await first<{ id: RecordId; community: CommunityRow }>(
    c.var.db,
    surql\`SELECT id, community FROM plugin_installation
            WHERE community.slug = \${slug} AND plugin = \${pluginId} AND enabled FETCH community;\`,
  );
  const plugin = row ? c.var.plugins.get(pluginId) : undefined;
  if (!row || !plugin) return null;
  const community = toPluginCommunity(row.community);
  const role = await memberRole(c.var.db, community.id, c.var.user.id);
  if (!role) return null;
  const installationId = keyOf(row.id);
  const lastVisit = await c.var.plugins.lastVisit(installationId, c.var.user.id);
  const ctx = c.var.plugins.context(plugin, {
    installationId,
    community,
    user: { id: c.var.user.id, name: c.var.user.name, role },
    lastVisit,
  });
  return { plugin, ctx, installationId };
}`,
  );

  const RESOLVE = (role) =>
    step(
      "route",
      "resolve(): installation, membership, role",
      `<p>One query finds an <em>enabled</em> installation of this plugin in the place with this slug; the plugin
       must be in the registry. <code>memberRole</code> reads <code>membership:[community, user]</code>: the role
       is <code>${role}</code>. Then the user's last visit to this installation is read for <code>ctx.lastVisit</code>.</p>`,
      RESOLVE_CODE,
    );

  const CONTEXT = step(
    "host",
    "A context for this one call",
    `<p><code>createPluginContext</code> gives the plugin the user with their role in <em>this</em> community, the
     community (with its pin), a clock, the last visit, and only the services its manifest declares
     (<code>announcements</code> declares <code>["db"]</code>, so <code>files</code>, <code>ai</code> and
     <code>notify</code> are denying proxies).</p>`,
    snippet(
      "apps/api/src/plugins/context.ts",
      "ts",
      `const can = (p: Permission) => plugin.manifest.permissions.includes(p);
const userId = user === SYSTEM_USER ? null : user.id;
return {
  user,
  community,
  now: () => new Date(),
  lastVisit: args.lastVisit ?? null,
  db: can("db") ? createPluginDb(services.db, plugin, installationId, userId) : deniedService("db"),
  files: can("files") ? services.files.forPlugin(installationId) : deniedService("files"),
  ai: can("ai") ? services.ai.forPlugin(installationId) : deniedService("ai"),
  notify: can("notify") ? services.notifications.forPlugin({ … }) : deniedService("notify"),
};`,
    ),
  );

  const CALL_TOOL_CODE = snippet(
    "apps/api/src/plugins/host.ts",
    "ts",
    `async callTool(plugin: LoadedPlugin, name: string, ctx: Context, args: unknown): Promise<ToolResult> {
  const tool = plugin.definition.tools?.[name];
  if (!tool) throw new PluginError(\`tool_not_found:\${name}\`);
  if (tool.requires === "admin" && ctx.user.role !== "admin") throw new ForbiddenError(\`\${name} requires admin\`);
  const input = tool.input.safeParse(args);
  if (!input.success) throw new PluginInputError(input.error.issues);
  const out = (await guard(plugin, \`tool \${name}\`, () => tool.handler(ctx, input.data))) ?? {};
  const parsed = toolResultSchema.safeParse(out);
  if (!parsed.success) throw new PluginError(\`… returned invalid result …\`);
  return parsed.data;
}`,
  );

  const CALL_TOOL_OK = step(
    "host",
    "callTool: role, then input, then the handler",
    `<p>In this order: the tool exists, <code>requires: "admin"</code> is satisfied, <code>args</code> parse with the
     tool's Zod schema (the title is trimmed, a missing body defaults to <code>""</code>). Only then does the plugin's
     code run, inside <code>guard()</code>.</p>`,
    CALL_TOOL_CODE,
  );

  const PUBLISH_HANDLER = step(
    "plugin",
    "The plugin's handler runs",
    `<p>The first and only plugin code in this request. It gets the parsed input and writes through
     <code>ctx.db</code>; it never sees SurrealQL, the installation id or other communities.</p>`,
    snippet(
      "plugins/announcements/index.ts",
      "ts",
      `publish: {
  description: "Opublikuj ogłoszenie dla użytkowników (tylko administrator).",
  input: z.object({
    title: z.string().trim().min(3, "Tytuł jest za krótki").max(120, "Tytuł jest za długi"),
    body: z.string().trim().max(5000, "Treść jest za długa").default(""),
  }),
  requires: "admin",
  handler: async (ctx, input) => {
    const item = await ctx.db.announcements.insert({ ...input, author: ctx.user.id });
    return { toast: "Ogłoszenie opublikowane.", refresh: true, data: { id: item.id } };
  },
},`,
    ),
  );

  const ENGINE_INSERT = step(
    "engine",
    "The engine validates, checks references, writes in a transaction",
    `<p><code>encodeValues</code> checks every column (string, defaults, unknown columns) and turns
     <code>author</code> into a record id. <code>checkRefs</code> confirms the user exists. <code>content()</code>
     adds <code>installation</code>, <code>created_at</code>, <code>updated_at</code> and <code>created_by</code>.
     The write runs in one transaction (with file confirmations, if any) and is retried on a retryable conflict.</p>`,
    snippet(
      "SurrealQL sent by packages/sdk/src/engine/client.ts",
      "sql",
      `RETURN [record::exists($bind__1)];               -- user:<id> exists?

BEGIN TRANSACTION;
LET $result = (CREATE $bind__2 CONTENT $bind__3 RETURN AFTER);
COMMIT TRANSACTION;
RETURN $result;
-- $bind__2 = p_announcements__announcements:⟨uuid⟩
-- $bind__3 = { installation, created_at, updated_at, created_by, title, body, author }`,
    ),
  );

  const DB_WRITE = step(
    "db",
    "SurrealDB enforces the schema again",
    `<p><code>p_announcements__announcements</code> is SCHEMAFULL: field types, the <code>record&lt;user&gt;</code>
     reference and the <code>installation</code> link are checked by the database too. The created row comes back and
     the engine decodes it to <code>{ id, createdAt, updatedAt, createdBy, title, body, author }</code>.</p>`,
  );

  const RESULT_OK = step(
    "host",
    "The result is validated and sent",
    `<p><code>toolResultSchema</code> accepts it, the route answers <code>200</code>.</p>`,
    snippet(
      "HTTP response",
      "json",
      `{ "toast": "Ogłoszenie opublikowane.", "refresh": true, "data": { "id": "3f1c…" } }`,
    ),
  );

  const APP_OK = step(
    "app",
    "The app follows the result",
    `<p>The mutation invalidates every query of this plugin (the list refetches and shows the new announcement), the
     toast becomes a flash message, and the renderer remounts so the form is empty again. Residents will see
     "1 nowe ogłoszenie od Twojej ostatniej wizyty" on their dashboard widget.</p>`,
    snippet(
      "apps/app/src/screens/PluginView.tsx",
      "ts",
      `onSuccess: (result) => {
  if (result.error) {
    setToolError(result.error);
    return;
  }
  if (result.close && !result.navigate) {
    flash.show(null);
    router.back();
    return;
  }
  const next = result.navigate ? pluginHref(slug, plugin, result.navigate.view, result.navigate.params) : here;
  flash.show(result.toast ? { text: result.toast, href: next } : null);
  setGeneration((g) => g + 1);
  if (next !== here) router.push(next as never);
},`,
    ),
  );

  const APP_ERROR = step(
    "app",
    "The app shows its generic error",
    `<p><code>parseResponse</code> throws for a non-2xx answer, so <code>call.isError</code> is true and the screen
     shows <code>t.plugin_action_error</code>: "Coś poszło nie tak. Sprawdź formularz i spróbuj ponownie." The form
     keeps what was typed (no remount).</p>`,
  );

  const PLUGIN_FAILURE = snippet(
    "apps/api/src/routes/communities.ts",
    "ts",
    `function pluginFailure(c: Context<AppEnv>, err: unknown) {
  if (err instanceof PluginInputError) return c.json({ error: "invalid_input", issues: err.issues }, 400);
  if (err instanceof ForbiddenError) return c.json({ error: "forbidden" }, 403);
  if (err instanceof PluginError) {
    console.error(err.message);
    return c.json({ error: "plugin_error" }, 500);
  }
  throw err;
}`,
  );

  const GUARD = snippet(
    "apps/api/src/plugins/host.ts",
    "ts",
    `async function guard<T>(plugin: LoadedPlugin, what: string, fn: () => T | Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof PluginError || err instanceof PluginInputError || err instanceof ForbiddenError) throw err;
    if (err instanceof FileInputError || err instanceof DbError) {
      throw new PluginInputError([{ path: [], message: err.message }]);
    }
    throw new PluginError(\`\${plugin.manifest.id}: \${what} threw: \${(err as Error).message}\`);
  }
}`,
  );

  const SCENARIOS = [
    {
      id: "ok",
      label: "Success",
      steps: [
        step(
          "app",
          "The admin taps “Opublikuj ogłoszenie”",
          `<p>The view put a <code>Form</code> node on screen. <code>PluginForm</code> merges the field values into
           the submit action's <code>args</code> and calls <code>onAction</code>; <code>PluginView</code> sends it with
           the <code>useToolCall</code> mutation, a Hono RPC call typed from the API's <code>AppType</code>.</p>`,
          snippet("Request", "http", PUBLISH_CALL),
        ),
        AUTH,
        RESOLVE('"admin"'),
        CONTEXT,
        CALL_TOOL_OK,
        PUBLISH_HANDLER,
        ENGINE_INSERT,
        DB_WRITE,
        RESULT_OK,
        APP_OK,
      ],
    },
    {
      id: "member",
      label: "Not a member",
      steps: [
        step(
          "app",
          "Someone outside the place calls the tool",
          `<p>A signed-in user who is not a member of <code>krakow</code> sends the same request (the app never offers
           it to them, but the API must not trust the app).</p>`,
          snippet("Request", "http", PUBLISH_CALL),
        ),
        AUTH,
        step(
          "route",
          "resolve() finds no membership → 404",
          `<p>The installation exists, but <code>memberRole</code> returns <code>null</code>, so
           <code>resolve</code> returns <code>null</code> and the route answers <code>404 { error: "not_found" }</code>,
           exactly as for a place that does not exist: an outsider cannot even learn whether the place exists.</p>`,
          RESOLVE_CODE,
        ),
        APP_ERROR,
      ],
    },
    {
      id: "forbidden",
      label: "Not an admin",
      steps: [
        step(
          "app",
          "A resident calls publish",
          `<p>The <code>list</code> view shows the form only to admins, but a tool is an API: an AI assistant or a
           script can call it directly. <code>requires</code> is what protects it.</p>`,
          snippet("Request", "http", PUBLISH_CALL),
        ),
        AUTH,
        RESOLVE('"user"'),
        CONTEXT,
        step(
          "host",
          'requires: "admin" fails → ForbiddenError',
          `<p>Checked before the input is even parsed. The handler never runs.</p>`,
          CALL_TOOL_CODE,
        ),
        step(
          "route",
          "pluginFailure → 403",
          `<p>The route maps the error to <code>403 { error: "forbidden" }</code>.</p>`,
          PLUGIN_FAILURE,
        ),
        APP_ERROR,
      ],
    },
    {
      id: "invalid",
      label: "Invalid input",
      steps: [
        step(
          "app",
          "The admin submits a two-letter title",
          `<p>The app does not validate plugin forms: the schema lives in the plugin, on the server.</p>`,
          snippet("Request body", "json", `{ "args": { "title": "Ok", "body": "" } }`),
        ),
        AUTH,
        RESOLVE('"admin"'),
        CONTEXT,
        step(
          "host",
          "Zod rejects the input → PluginInputError",
          `<p><code>tool.input.safeParse(args)</code> fails on <code>.min(3, "Tytuł jest za krótki")</code>. The handler
           never runs, so nothing can be half-saved.</p>`,
          CALL_TOOL_CODE,
        ),
        step(
          "route",
          "pluginFailure → 400 with the Zod issues",
          `<p>The issues (with the plugin's Polish messages) are in the response for API callers and AI assistants;
           tests get the same list from <code>plugin.invalidInput(name, args)</code>.</p>`,
          snippet(
            "HTTP 400",
            "json",
            `{ "error": "invalid_input", "issues": [{ "code": "too_small", "path": ["title"], "message": "Tytuł jest za krótki", "…": "…" }] }`,
          ),
        ),
        APP_ERROR,
      ],
    },
    {
      id: "refused",
      label: "Plugin says no",
      steps: [
        step(
          "app",
          "The admin taps “Usuń ogłoszenie” on an announcement that is already gone",
          `<p>Another admin deleted it a moment ago; this screen still shows it.</p>`,
          snippet(
            "Request",
            "http",
            `POST /api/communities/krakow/plugins/announcements/tools/remove\n\n{ "args": { "id": "3f1c…" } }`,
          ),
        ),
        AUTH,
        RESOLVE('"admin"'),
        CONTEXT,
        CALL_TOOL_OK,
        step(
          "plugin",
          "The handler returns { error }",
          `<p>Expected situations are results, not exceptions: the plugin answers in Polish and, by convention,
           saves nothing.</p>`,
          snippet(
            "plugins/announcements/index.ts",
            "ts",
            `handler: async (ctx, input) => {
  if (!(await ctx.db.announcements.delete(input.id))) return { error: "To ogłoszenie nie istnieje." };
  return { toast: "Ogłoszenie usunięte.", navigate: ui.navigate("list") };
},`,
          ),
        ),
        step(
          "engine",
          "Delete scoped to the installation",
          `<p>No row with this id in this installation: zero rows deleted, <code>delete()</code> returns
           <code>false</code>.</p>`,
          snippet("SurrealQL", "sql", "DELETE $bind__1 WHERE installation = $bind__2 RETURN BEFORE;"),
        ),
        step(
          "host",
          "A normal 200 result",
          `<p><code>{ error }</code> is a valid <code>ToolResult</code>.</p>`,
          snippet("HTTP 200", "json", `{ "error": "To ogłoszenie nie istnieje." }`),
        ),
        step(
          "app",
          "The plugin's message is shown",
          `<p><code>PluginView</code> sets <code>toolError</code> and renders it with <code>role="alert"</code>; no
           flash, no navigation. The plugin's queries are still invalidated, so the stale card disappears.</p>`,
        ),
      ],
    },
    {
      id: "db",
      label: "Database refuses",
      steps: [
        step(
          "app",
          "A resident sends a second report for the same issue",
          `<p>Suppose a handler used <code>insert</code> on a table declared with
           <code>unique: [["issue", "author"]]</code> (the real <code>issues</code> plugin uses <code>upsert</code> for
           exactly this reason).</p>`,
        ),
        AUTH,
        RESOLVE('"user"'),
        CONTEXT,
        CALL_TOOL_OK,
        step(
          "plugin",
          "The handler writes",
          "",
          snippet(
            "handler (hypothetical)",
            "ts",
            `await ctx.db.reports.insert({ issue: issue.id, author: ctx.user.id, description });`,
          ),
        ),
        step(
          "db",
          "The unique index rejects the row",
          `<p>The index is <code>p_issues__reports__u_issue_author</code> on <code>installation, issue, author</code>.
           The transaction rolls back: nothing is written, and a photo the write referenced stays pending.</p>`,
        ),
        step(
          "engine",
          "translateError → DbError",
          `<p>SurrealDB's "already contains" becomes <code>DbError("reports: unique constraint violated")</code>, a
           message that is safe to show.</p>`,
        ),
        step(
          "host",
          "guard() maps DbError to bad input → 400",
          `<p>A <code>DbError</code> (or a bad file id) is treated as the caller's fault:
           <code>400 { error: "invalid_input", issues: [{ path: [], message: "reports: unique constraint violated" }] }</code>.</p>`,
          GUARD,
        ),
        APP_ERROR,
      ],
    },
    {
      id: "bug",
      label: "Plugin bug",
      steps: [
        step("app", "The admin taps “Opublikuj ogłoszenie”", "", snippet("Request", "http", PUBLISH_CALL)),
        AUTH,
        RESOLVE('"admin"'),
        CONTEXT,
        CALL_TOOL_OK,
        step(
          "plugin",
          "The handler throws",
          `<p>Say a refactor left <code>undefined.title</code> somewhere: a <code>TypeError</code> escapes the
           handler. (Returning an invalid result, e.g. <code>{ toast: 42 }</code>, ends the same way.)</p>`,
        ),
        step(
          "host",
          "guard() wraps it in PluginError",
          `<p>Anything that is not a known error type becomes
           <code>PluginError('announcements: tool "publish" threw: …')</code>.</p>`,
          GUARD,
        ),
        step(
          "route",
          "500 plugin_error, for this request only",
          `<p>The message goes to the API log, the client gets <code>{ error: "plugin_error" }</code>. Other requests,
           other plugins and the dashboard keep working.</p>`,
          PLUGIN_FAILURE,
        ),
        APP_ERROR,
      ],
    },
  ];

  const renderRequest = () => {
    const stepper = $("request-stepper");
    const list = $("request-steps");
    if (!stepper || !list) return;
    pills(
      $("request-scenarios"),
      SCENARIOS.map((s) => [s.id, s.label]),
      (id) => {
        const scenario = SCENARIOS.find((s) => s.id === id);
        list.innerHTML = scenario.steps
          .map(
            (s) => `<li data-hl="${s.lane}">
              <button class="step-title" type="button">${esc(s.title)}<span class="chip" data-layer="${LAYER[s.lane]}">${LANE[s.lane]}</span></button>
              <div class="step-body">${s.body}${s.codes.join("")}</div>
            </li>`,
          )
          .join("");
        window.Docs.highlight(list);
        window.Docs.initStepper(stepper);
      },
    );
  };

  // ───────────────────────────── 2. ctx and permissions ─────────────────────────────

  const SERVICE = {
    db: "createPluginDb(services.db, plugin, installationId, userId)",
    files: "services.files.forPlugin(installationId)",
    ai: "services.ai.forPlugin(installationId)",
    notify: "services.notifications.forPlugin({ views, pluginId, installationId, community, from: userId })",
  };
  const USES = [
    ["db", "const items = await ctx.db.items.findMany();"],
    ["files", "const info = await ctx.files.info(input.photo);"],
    ["ai", 'const summary = await ctx.ai.call({ prompt: "Streść ogłoszenie…" });'],
    ["notify", 'await ctx.notify({ to: { everyone: true }, title: "Nowe ogłoszenie" });'],
  ];

  const renderPermissions = () => {
    const set = $("perm-set");
    if (!set) return;
    const update = () => {
      const granted = new Set([...set.querySelectorAll("input:checked")].map((i) => i.value));
      const ctxLines = [
        ["{", ""],
        ["  user,       // { id, name, role } — role in this community", ""],
        ["  community,  // { id, slug, name, location }", ""],
        ["  now: () => new Date(),", ""],
        ["  lastVisit,  // Date | null", ""],
        ...Object.entries(SERVICE).map(([p, real]) =>
          granted.has(p) ? [`  ${p}: ${real},`, "line-ok"] : [`  ${p}: deniedService("${p}"),`, "line-denied"],
        ),
        ["}", ""],
      ];
      setCodeLines($("perm-ctx"), ctxLines);
      setCodeLines(
        $("perm-call"),
        USES.map(([p, line]) => [line, granted.has(p) ? "" : "line-denied"]),
      );
      const missing = USES.find(([p]) => !granted.has(p));
      $("perm-outcome").innerHTML = missing
        ? `<span class="chip bad">rejects</span> <code>Error: Plugin did not declare the "${missing[0]}" permission</code>
           at the first undeclared call; inside a tool, <code>guard()</code> turns it into
           <code>500 plugin_error</code>. <span class="muted">The manifest would be <code>permissions: [${[...granted]
             .map((p) => `"${p}"`)
             .join(", ")}]</code>.</span>`
        : `<span class="chip ok">all four reach real services</span> each one scoped to this installation.`;
    };
    set.addEventListener("change", update);
    update();
  };

  // ───────────────────────────── 3. isolation ─────────────────────────────

  const INSTALLATIONS = [
    { id: "x8k2", place: "Kraków" },
    { id: "p4n9", place: "Osiedle Zielone" },
    { id: "q1z7", place: "Politechnika" },
  ];
  const ISO_ROWS = [
    { id: "r1", inst: "x8k2", title: "Zepsuta latarnia na Floriańskiej", status: "open" },
    { id: "r2", inst: "p4n9", title: "Dziura w chodniku przy bloku 7", status: "open" },
    { id: "r3", inst: "x8k2", title: "Przepełniony kosz na Plantach", status: "fixed" },
    { id: "r4", inst: "q1z7", title: "Nie działa winda w budynku B", status: "accepted" },
    { id: "r5", inst: "p4n9", title: "Zniszczona ławka na placu zabaw", status: "fixed" },
    { id: "r6", inst: "x8k2", title: "Brak oświetlenia w przejściu podziemnym", status: "open" },
  ];
  const ORDER = "ORDER BY created_at DESC, id DESC";

  const isoActions = (inst) => {
    const foreign = ISO_ROWS.find((r) => r.inst !== inst);
    const own = ISO_ROWS.filter((r) => r.inst === inst);
    return [
      {
        label: "findMany open",
        call: 'await ctx.db.issues.findMany({ where: { status: "open" } });',
        sql: `SELECT * FROM p_issues__issues WHERE installation = $bind__2 AND status = $bind__1 ${ORDER} LIMIT $bind__3 START $bind__4;`,
        hit: own.filter((r) => r.status === "open").map((r) => r.id),
        result: (hits) => `→ ${hits.length} row(s), all from this installation`,
      },
      {
        label: "count",
        call: "await ctx.db.issues.count();",
        sql: "SELECT count() FROM p_issues__issues WHERE installation = $bind__1 GROUP ALL;",
        hit: own.map((r) => r.id),
        result: (hits) => `→ ${hits.length}`,
      },
      {
        label: `get("${foreign.id}")`,
        call: `await ctx.db.issues.get("${foreign.id}"); // a row of ${INSTALLATIONS.find((i) => i.id === foreign.inst).place}`,
        sql: `SELECT * FROM p_issues__issues WHERE installation = $bind__2 AND id = $bind__1 ${ORDER} LIMIT $bind__3 START $bind__4;`,
        hit: [],
        result: () => "→ null (the row exists, but not here)",
      },
      {
        label: `update("${foreign.id}")`,
        call: `await ctx.db.issues.update("${foreign.id}", { status: "fixed" });`,
        sql: `BEGIN TRANSACTION;
LET $result = (UPDATE $bind__3 SET status = $bind__1, updated_at = $bind__2 WHERE installation = $bind__4 RETURN AFTER);
COMMIT TRANSACTION;
RETURN $result;`,
        hit: [],
        result: () => "→ null (nothing changed)",
      },
      {
        label: "reference it",
        call: `await ctx.db.reports.insert({ issue: "${foreign.id}", author: ctx.user.id });`,
        sql: `SELECT installation FROM $bind__1;   -- p_issues__issues:${foreign.id}`,
        hit: [],
        result: () => `→ throws DbError: reports.issue: unknown issues id`,
        bad: true,
      },
    ];
  };

  const renderIsolation = () => {
    const holder = $("iso-installations");
    if (!holder) return;
    const state = { inst: INSTALLATIONS[0].id, action: 0 };
    const draw = () => {
      const actions = isoActions(state.inst);
      const action = actions[state.action];
      const hits = new Set(action.hit);
      $("iso-rows").innerHTML = ISO_ROWS.map((r) => {
        const place = INSTALLATIONS.find((i) => i.id === r.inst).place;
        const cls = r.inst !== state.inst ? "iso-foreign" : hits.has(r.id) ? "iso-hit" : "";
        return `<tr class="${cls}"><td><code>${r.id}</code></td><td><code>…:${r.inst}</code> <span class="muted small">${esc(place)}</span></td><td>${esc(r.title)}</td><td>${r.status}</td></tr>`;
      }).join("");
      $("iso-actions").innerHTML = actions
        .map(
          (a, i) =>
            `<button class="pill" type="button" data-i="${i}" aria-pressed="${i === state.action}">${esc(a.label)}</button>`,
        )
        .join("");
      setCode($("iso-call"), action.call);
      setCode($("iso-sql"), `${action.sql}\n-- installation binding: plugin_installation:${state.inst}`);
      $("iso-result").innerHTML =
        `<span class="chip ${action.bad ? "bad" : "ok"}">${action.bad ? "rejected" : "scoped"}</span> ${esc(action.result([...hits]))}`;
    };
    $("iso-actions").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-i]");
      if (!button) return;
      state.action = Number(button.dataset.i);
      draw();
    });
    pills(
      holder,
      INSTALLATIONS.map((i) => [i.id, `as ${i.place}`]),
      (id) => {
        state.inst = id;
        draw();
      },
    );
  };

  // ───────────────────────────── 4. query builder ─────────────────────────────

  const renderQueryBuilder = () => {
    const fields = ["status", "votes", "photo", "mine", "order", "limit", "with"];
    if (!$("qb-status")) return;
    const update = () => {
      const v = Object.fromEntries(fields.map((f) => [f, $(`qb-${f}`).value]));
      const binds = [];
      const bind = (value) => {
        binds.push(value);
        return `$bind__${binds.length}`;
      };
      // Same order as the engine: condition values are bound first, then the installation, then limit/start.
      const where = [];
      const whereTs = [];
      if (v.status === "eq") {
        where.push(`status = ${bind("open")}`);
        whereTs.push('status: "open"');
      }
      if (v.status === "in") {
        where.push(`status IN ${bind(["open", "accepted"])}`);
        whereTs.push('status: { in: ["open", "accepted"] }');
      }
      if (v.votes === "gte") {
        where.push(`votes >= ${bind(5)}`);
        whereTs.push("votes: { gte: 5 }");
      }
      if (v.votes === "range") {
        where.push(`votes >= ${bind(1)}`, `votes < ${bind(10)}`);
        whereTs.push("votes: { gte: 1, lt: 10 }");
      }
      if (v.photo === "null") {
        where.push("photo = NONE");
        whereTs.push("photo: null");
      }
      if (v.mine === "me") {
        where.push(`reporter = ${bind("user:anna")}`);
        whereTs.push("reporter: ctx.user.id");
      }
      const installation = bind("plugin_installation:x8k2");
      const order = { "": [], votes: ["votes DESC"], created: ["created_at ASC"] }[v.order];
      const limitValue = v.limit === "" ? 100 : Math.min(Number(v.limit), 1000);
      const limit = bind(limitValue);
      const start = bind(0);
      const statements = [
        `SELECT * FROM p_issues__issues\n  WHERE ${[`installation = ${installation}`, ...where].join("\n    AND ")}\n  ORDER BY ${[...order, "created_at DESC", "id DESC"].join(", ")}\n  LIMIT ${limit} START ${start};`,
      ];
      if (v.with === "reporter") {
        statements.push(
          `-- with: { reporter: true } → one lookup for the distinct ids found\nSELECT id, name FROM user WHERE id IN ${bind(["user:anna", "user:bartek"])};`,
        );
      }
      const opts = [
        whereTs.length ? `  where: { ${whereTs.join(", ")} },` : null,
        v.order === "votes"
          ? '  orderBy: { votes: "desc" },'
          : v.order === "created"
            ? '  orderBy: { createdAt: "asc" },'
            : null,
        v.limit ? `  limit: ${v.limit},` : null,
        v.with === "reporter" ? "  with: { reporter: true }," : null,
      ].filter(Boolean);
      setCode(
        $("qb-call"),
        opts.length ? `await ctx.db.issues.findMany({\n${opts.join("\n")}\n});` : "await ctx.db.issues.findMany();",
      );
      setCode($("qb-sql"), statements.join("\n\n"));
      setCode($("qb-bindings"), `{\n${binds.map((b, i) => `  "bind__${i + 1}": ${JSON.stringify(b)}`).join(",\n")}\n}`);
      const notes = [
        "The installation condition is always first and always there; the plugin cannot remove it.",
        "Every value is a bound variable (the <code>surql</code> tag); identifiers come from the validated declaration.",
        v.order
          ? "<code>created_at DESC, id DESC</code> are always appended as tie-breakers (and are the default order)."
          : "No <code>orderBy</code>: newest first, ties by id.",
        v.limit === "" ? "No <code>limit</code>: at most 100 rows. Ask for more explicitly." : null,
        v.limit === "5000" ? "<code>limit</code> is capped at 1000 (<code>MAX_LIMIT</code>)." : null,
        v.photo === "null"
          ? "<code>null</code> compiles to <code>= NONE</code>: how SurrealDB stores a missing optional value."
          : null,
        v.with === "reporter"
          ? "A user expands to <code>{ id, name }</code> only, never the e-mail; a file to <code>{ id, mime, size }</code> of this installation; an own-table ref to the full row (one level)."
          : null,
        "Conditions are ANDed; there is no OR (use <code>in</code> or two queries). JSON columns cannot be filtered.",
        "Bindings are numbered here from 1; the real <code>surql</code> counter is process-wide.",
      ].filter(Boolean);
      $("qb-notes").innerHTML = notes.map((n) => `<li>${n}</li>`).join("");
    };
    for (const f of fields) $(`qb-${f}`).addEventListener("change", update);
    update();
  };

  // ───────────────────────────── 5. watch() simulator ─────────────────────────────

  const renderWatch = () => {
    if (!$("watch-rows")) return;
    const initial = () => [
      { id: 1, title: "Latarnia", status: "open" },
      { id: 2, title: "Kosz", status: "fixed" },
      { id: 3, title: "Chodnik", status: "open" },
    ];
    const state = { rows: initial(), seen: new Set(), next: 4, log: [] };
    const matches = (row) => row.status === "open";
    const show = (row) => `{ id: "${row.id}", title: "${row.title}", status: "${row.status}" }`;

    const push = (change, event, quiet) => {
      state.log.push({ change, event, quiet });
      draw();
    };

    /** The engine's rule (packages/sdk/src/engine/client.ts, watch): events relative to the rows the subscriber has. */
    const notify = (action, row, change) => {
      const had = state.seen.delete(row.id);
      const visible = action !== "DELETE" && matches(row);
      if (!visible) {
        if (had) push(change, `{ type: "delete", id: "${row.id}" }`);
        else push(change, "nothing (not visible before or after)", true);
        return;
      }
      state.seen.add(row.id);
      push(change, `{ type: "${had ? "update" : "create"}", row: ${show(row)} }`);
    };

    const reset = () => {
      state.rows = initial();
      state.next = 4;
      const snapshot = state.rows.filter(matches);
      state.seen = new Set(snapshot.map((r) => r.id));
      state.log = [{ change: "subscribe", event: `{ type: "snapshot", rows: [${snapshot.map(show).join(", ")}] }` }];
      draw();
    };

    const draw = () => {
      $("watch-rows").innerHTML = state.rows
        .map(
          (
            r,
          ) => `<tr><td><code>${r.id}</code></td><td>${esc(r.title)}</td><td><span class="chip ${r.status === "open" ? "info" : "ok"}">${r.status}</span></td>
            <td class="watch-btns">
              <button class="btn" type="button" data-act="toggle" data-id="${r.id}">${r.status === "open" ? "fix" : "reopen"}</button>
              <button class="btn" type="button" data-act="rename" data-id="${r.id}">rename</button>
              <button class="btn" type="button" data-act="delete" data-id="${r.id}">delete</button>
            </td></tr>`,
        )
        .join("");
      $("watch-log").innerHTML = state.log
        .map(
          (e) =>
            `<li class="${e.quiet ? "is-quiet" : ""}"><span class="event-change">${esc(e.change)}</span><code>${esc(e.event)}</code></li>`,
        )
        .join("");
      $("watch-log").scrollTop = $("watch-log").scrollHeight;
      $("watch-seen").textContent = state.seen.size ? [...state.seen].sort((a, b) => a - b).join(", ") : "none";
    };

    $("watch-rows").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-act]");
      if (!button) return;
      const row = state.rows.find((r) => r.id === Number(button.dataset.id));
      if (button.dataset.act === "toggle") {
        row.status = row.status === "open" ? "fixed" : "open";
        notify("UPDATE", row, `UPDATE #${row.id} status → ${row.status}`);
      } else if (button.dataset.act === "rename") {
        row.title = `${row.title.replace(/ \(\d+\)$/, "")} (${state.next++})`;
        notify("UPDATE", row, `UPDATE #${row.id} title`);
      } else {
        state.rows = state.rows.filter((r) => r !== row);
        notify("DELETE", row, `DELETE #${row.id}`);
      }
    });
    const add = (status) => {
      const row = { id: state.next++, title: status === "open" ? "Nowe zgłoszenie" : "Stara sprawa", status };
      state.rows.push(row);
      notify("CREATE", row, `CREATE #${row.id} (${status})`);
    };
    $("watch-add-open").addEventListener("click", () => add("open"));
    $("watch-add-fixed").addEventListener("click", () => add("fixed"));
    $("watch-other").addEventListener("click", () =>
      push("CREATE in another installation (open)", "nothing (installation differs: dropped first)", true),
    );
    $("watch-reset").addEventListener("click", reset);
    reset();
  };

  // ───────────────────────────── 6. Server-Driven UI simulator ─────────────────────────────

  /** The SDK's builders (packages/sdk/src/ui.ts), producing the same JSON. */
  const ui = {
    screen: (title, children) => ({ type: "Screen", title, children }),
    widget: (title, children, onPress) => ({ type: "Widget", title, children, ...(onPress ? { onPress } : {}) }),
    list: (label, children) => ({ type: "List", label, children }),
    card: (props) => ({ type: "Card", ...props }),
    form: (props) => ({ type: "Form", ...props }),
    text: (text, tone) => ({ type: "Text", text, ...(tone ? { tone } : {}) }),
    button: (label, action, variant) => ({ type: "Button", label, action, ...(variant ? { variant } : {}) }),
    empty: (text) => ({ type: "Empty", text }),
    textInput: (props) => ({ type: "TextInput", ...props }),
    navigate: (view, params) => ({ type: "navigate", view, ...(params ? { params } : {}) }),
    tool: (tool, args) => ({ type: "tool", tool, ...(args ? { args } : {}) }),
  };

  /** "1 nowe ogłoszenie", "3 nowe ogłoszenia", "5 nowych ogłoszeń" (as in plugins/announcements/index.ts). */
  const newCount = (n) => {
    const few = n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14);
    const noun = n === 1 ? "nowe ogłoszenie" : few ? "nowe ogłoszenia" : "nowych ogłoszeń";
    return `${n} ${noun} od Twojej ostatniej wizyty`;
  };

  const renderSdui = () => {
    const phone = $("sdui-phone");
    if (!phone) return;
    const state = {
      role: "admin",
      surface: "view",
      view: { name: "list", params: {} },
      clock: 3,
      items: [
        { id: "a2", title: "Zbiórka elektrośmieci w sobotę", body: "Kontener stanie przy ul. Lipowej 4, 9–15.", at: 2 },
        { id: "a1", title: "Przerwa w dostawie wody", body: "We wtorek od 8 do 14.", at: 1 },
      ],
      visits: { admin: null, user: null },
      message: null,
      log: [],
    };
    const isAdmin = () => state.role === "admin";
    const base = "/api/communities/krakow/plugins/announcements";

    const publishForm = () =>
      ui.form({
        submitLabel: "Opublikuj ogłoszenie",
        submit: ui.tool("publish"),
        children: [
          ui.textInput({ name: "title", label: "Tytuł" }),
          ui.textInput({ name: "body", label: "Treść", multiline: true }),
        ],
      });

    const views = {
      list: () =>
        ui.screen("Ogłoszenia", [
          ...(isAdmin() ? [publishForm()] : []),
          ui.list(
            "Lista ogłoszeń",
            state.items.length
              ? state.items.map((a) => ui.card({ title: a.title, onPress: ui.navigate("item", { id: a.id }) }))
              : [ui.empty("Nie ma jeszcze ogłoszeń.")],
          ),
        ]),
      item: (params) => {
        const item = state.items.find((a) => a.id === params.id);
        if (!item) return ui.screen("Nie znaleziono", [ui.empty("To ogłoszenie nie istnieje.")]);
        return ui.screen(item.title, [
          ui.text(item.body || "Brak treści."),
          ...(isAdmin() ? [ui.button("Usuń ogłoszenie", ui.tool("remove", { id: item.id }), "danger")] : []),
          ui.button("Wszystkie ogłoszenia", ui.navigate("list"), "quiet"),
        ]);
      },
    };

    const widget = () => {
      const since = state.visits[state.role];
      const fresh = state.items.filter((a) => since === null || a.at > since);
      return ui.widget(
        "Ogłoszenia",
        [
          state.items.length
            ? ui.text(fresh.length ? newCount(fresh.length) : "Nic nowego od Twojej ostatniej wizyty.", "soft")
            : ui.empty("Nie ma jeszcze ogłoszeń."),
          ...fresh.slice(0, 2).map((a) => ui.card({ title: a.title, onPress: ui.navigate("item", { id: a.id }) })),
          ui.button("Wszystkie ogłoszenia", ui.navigate("list"), "quiet"),
        ],
        { onPress: ui.navigate("list") },
      );
    };

    const log = (kind, text) => {
      state.log.push({ kind, text });
      state.log = state.log.slice(-8);
    };

    // A tiny renderer mirroring apps/app/src/plugins/Renderer.tsx; actions are collected by index.
    const render = (node, actions, inWidget) => {
      const act = (action) => actions.push(action) - 1;
      const kids = (nodes) => (nodes ?? []).map((n) => render(n, actions, inWidget)).join("");
      switch (node.type) {
        case "Screen":
          return `<div class="pv-screen"><h3 class="pv-title">${esc(node.title)}</h3>${kids(node.children)}</div>`;
        case "Widget": {
          const inner = `<div class="pv-widget-head"><strong>${esc(node.title)}</strong>${node.onPress ? "<span aria-hidden='true'>›</span>" : ""}</div>${node.children.map((n) => render(n, actions, true)).join("")}`;
          return node.onPress
            ? `<div class="pv-widget is-pressable" data-action="${act(node.onPress)}" role="button" tabindex="0">${inner}</div>`
            : `<div class="pv-widget">${inner}</div>`;
        }
        case "List":
          return `<ul class="pv-list" aria-label="${esc(node.label)}">${node.children.map((n) => `<li>${render(n, actions, inWidget)}</li>`).join("")}</ul>`;
        case "Card": {
          const inner = `<span class="pv-card-title">${esc(node.title)}</span>${node.subtitle ? `<span class="pv-card-sub">${esc(node.subtitle)}</span>` : ""}${kids(node.children)}`;
          const cls = inWidget ? "pv-row" : "pv-card";
          return node.onPress
            ? `<button type="button" class="${cls} is-pressable" data-action="${act(node.onPress)}">${inner}</button>`
            : `<div class="${cls}">${inner}</div>`;
        }
        case "Text":
          return `<p class="pv-text${node.tone === "soft" ? " is-soft" : ""}">${esc(node.text)}</p>`;
        case "Empty":
          return `<p class="pv-empty">${esc(node.text)}</p>`;
        case "Button":
          return `<button type="button" class="pv-btn is-${node.variant ?? "primary"}" data-action="${act(node.action)}">${esc(node.label)}</button>`;
        case "TextInput":
          return `<label class="pv-field"><span>${esc(node.label)}</span>${
            node.multiline
              ? `<textarea name="${esc(node.name)}" rows="2"></textarea>`
              : `<input name="${esc(node.name)}" />`
          }</label>`;
        case "Form":
          return `<form class="pv-form" data-submit="${act(node.submit)}">${kids(node.children)}<button type="submit" class="pv-btn is-primary">${esc(node.submitLabel)}</button></form>`;
        default:
          return `<p class="pv-text is-soft">Ten element wymaga nowszej wersji aplikacji.</p>`;
      }
    };

    const state2 = { actions: [] };

    const viewRequest = () => {
      const query = new URLSearchParams(state.view.params).toString();
      return `GET ${base}/views/${state.view.name}${query ? `?${query}` : ""}`;
    };

    const draw = () => {
      const json = $("sdui-json");
      const actions = [];
      if (state.surface === "view") {
        const tree = views[state.view.name](state.view.params);
        setCode(json, JSON.stringify(tree, null, 2));
        $("sdui-json-title").textContent = `UI tree returned by views.${state.view.name}`;
        $("sdui-request").textContent = viewRequest();
        phone.innerHTML = `<div class="pv-bar"><span>‹ Wróć</span><span>Kraków</span></div><div class="pv-messages" id="pv-messages"></div>${render(tree, actions, false)}`;
      } else {
        const node = widget();
        const response = {
          canEdit: isAdmin(),
          widgets: [
            { key: "announcements/latest", pluginId: "announcements", widget: "latest", size: { w: 3, h: 3 }, node },
          ],
        };
        setCode(json, JSON.stringify(response, null, 2));
        $("sdui-json-title").textContent = "Dashboard response (widget rendered for this user)";
        $("sdui-request").textContent = "GET /api/communities/krakow/dashboard";
        phone.innerHTML = `<div class="pv-bar"><span>Pulpit</span><span>Kraków</span></div><div class="pv-messages" id="pv-messages"></div>${render(node, actions, false)}`;
      }
      state2.actions = actions;
      showMessage();
      $("sdui-log").innerHTML = state.log
        .map((e) => `<li class="is-${e.kind}"><code>${esc(e.text)}</code></li>`)
        .join("");
    };

    const showMessage = () => {
      const box = $("pv-messages");
      if (!box || !state.message) return;
      box.innerHTML = `<p class="pv-msg is-${state.message.kind}" role="${state.message.kind === "toast" ? "status" : "alert"}">${esc(state.message.text)}</p>`;
    };

    const openView = (name, params) => {
      state.view = { name, params: params ?? {} };
      state.surface = "view";
      for (const b of $("sdui-surfaces").querySelectorAll("button")) {
        b.setAttribute("aria-selected", String(b.dataset.surface === "view"));
      }
      log(
        "nav",
        `router.push("/app/c/krakow/announcements/${name}${params ? `?${new URLSearchParams(params)}` : ""}")`,
      );
      log("http", viewRequest());
      state.visits[state.role] = state.clock;
    };

    const fail = (status, body) => {
      log("bad", `${status} ${body}`);
      state.message = { kind: "alert", text: "Coś poszło nie tak. Sprawdź formularz i spróbuj ponownie." };
      $("sdui-log").innerHTML = state.log
        .map((e) => `<li class="is-${e.kind}"><code>${esc(e.text)}</code></li>`)
        .join("");
      showMessage();
    };

    const tools = {
      publish: (args) => {
        const title = String(args.title ?? "").trim();
        const body = String(args.body ?? "").trim();
        if (title.length < 3)
          return {
            status: 400,
            body: '{ "error": "invalid_input", "issues": [{ "path": ["title"], "message": "Tytuł jest za krótki" }] }',
          };
        if (title.length > 120)
          return {
            status: 400,
            body: '{ "error": "invalid_input", "issues": [{ "path": ["title"], "message": "Tytuł jest za długi" }] }',
          };
        state.clock += 1;
        const id = `a${state.clock}`;
        state.items.unshift({ id, title, body, at: state.clock });
        return { status: 200, result: { toast: "Ogłoszenie opublikowane.", refresh: true, data: { id } } };
      },
      remove: (args) => {
        const before = state.items.length;
        state.items = state.items.filter((a) => a.id !== args.id);
        if (state.items.length === before) return { status: 200, result: { error: "To ogłoszenie nie istnieje." } };
        return { status: 200, result: { toast: "Ogłoszenie usunięte.", navigate: ui.navigate("list") } };
      },
    };

    const runTool = (action, args) => {
      log("http", `POST ${base}/tools/${action.tool}  ${JSON.stringify({ args })}`);
      if (!isAdmin()) return fail(403, '{ "error": "forbidden" }   (requires: "admin")');
      const answer = tools[action.tool](args);
      if (answer.status !== 200) return fail(answer.status, answer.body);
      const result = answer.result;
      log("ok", `200 ${JSON.stringify(result)}`);
      log("nav", 'invalidateQueries(["communities", "krakow", "plugin", "announcements"]) → views refetch');
      if (result.error) {
        state.message = { kind: "alert", text: result.error };
        draw();
        return;
      }
      state.message = result.toast ? { kind: "toast", text: result.toast } : null;
      if (result.navigate) openView(result.navigate.view, result.navigate.params);
      draw();
    };

    const onAction = (action, args) => {
      state.message = null;
      if (action.type === "navigate") {
        openView(action.view, action.params);
        draw();
        return;
      }
      runTool(action, { ...(action.args ?? {}), ...args });
    };

    phone.addEventListener("click", (event) => {
      const target = event.target.closest("[data-action]");
      if (!target) return;
      event.preventDefault();
      onAction(state2.actions[Number(target.dataset.action)], {});
    });
    phone.addEventListener("keydown", (event) => {
      const target = event.target.closest("[data-action][role='button']");
      if (!target || (event.key !== "Enter" && event.key !== " ")) return;
      event.preventDefault();
      onAction(state2.actions[Number(target.dataset.action)], {});
    });
    phone.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.target;
      const values = Object.fromEntries([...new FormData(form)].filter(([, v]) => v !== ""));
      onAction(state2.actions[Number(form.dataset.submit)], values);
    });

    const pick = (container, attr, apply) => {
      for (const b of container.querySelectorAll("button")) {
        b.addEventListener("click", () => {
          for (const other of container.querySelectorAll("button"))
            other.setAttribute("aria-selected", String(other === b));
          state.message = null;
          apply(b.dataset[attr]);
          draw();
        });
      }
    };
    pick($("sdui-roles"), "role", (role) => {
      state.role = role;
      log("nav", `signed in as ${role === "admin" ? "an admin" : "a resident"}: same view, different tree`);
    });
    pick($("sdui-surfaces"), "surface", (surface) => {
      state.surface = surface;
      if (surface === "view") {
        log("http", viewRequest());
        state.visits[state.role] = state.clock;
      } else log("http", "GET /api/communities/krakow/dashboard");
    });

    log("http", viewRequest());
    state.visits.admin = state.clock;
    draw();
  };

  renderRequest();
  renderPermissions();
  renderIsolation();
  renderQueryBuilder();
  renderWatch();
  renderSdui();
})();
