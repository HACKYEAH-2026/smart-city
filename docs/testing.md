# Tests

| Level | Runner | Where | Database |
|---|---|---|---|
| unit | bun test | `packages/*`, `plugins/*` (plugins via `testPlugin`), `apps/app/src` | — |
| integration | bun test | `apps/api/test` | embedded in-memory SurrealDB, a fresh database per test |
| E2E | Playwright (web) | `apps/app/e2e` | embedded in-memory SurrealDB, a separate API process per worker |

## Integration: one engine, a database per test
`apps/api/test/helpers.ts`: every test gets a fresh database (schema applied) on the one embedded engine of the
process (`testEngine()` from `@app/plugin-sdk/testing`). One engine per process on purpose: with
@surrealdb/node 3.0.3, Bun 1.4 crashes on exit (SIGSEGV) after a second embedded engine or `REMOVE DATABASE`,
even when every test passed, and also when the engine is still open at exit (the root `bunfig.toml` preloads
`packages/sdk/src/test-preload.ts`, which closes it after the run). Never open another `mem://` connection in tests. The API is called through
`app.request()` (no ports), `close()` after each test. `t.seed()` adds the demo community, the built-in plugins
and a signed-in community admin. Inject a fake AI model with `setup({}, { ai: { language } })`.

## E2E
- Fixture `apps/app/e2e/fixtures.ts`: a worker-scoped API process (`apps/api/src/test-server.ts`) on port 4100+N,
  an auto-fixture `POST /__test/reset` before every test, the API address passed to the frontend via `window.__API_URL__`.
- Frontend: the production static Expo export (`expo export -p web`) served by `scripts/serve.ts`.
- Native screens: covered by the Android build (verify) and iOS (CI); on-device E2E (Maestro/Detox) is deliberately out of scope.
- `/__test/reset` exists only in `test-server.ts` (NODE_ENV=test); `apps/api/scripts/build.ts` fails if it ends up in the bundle.
