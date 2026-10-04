# Tests

| Level | Runner | Where | Database |
|---|---|---|---|
| unit | bun test | `packages/*`, `plugins/*` (plugins via `testPlugin`), `apps/app/src`, `apps/api/src` | — (plugins: embedded in-memory SurrealDB via `testPlugin`) |
| integration | bun test | `apps/api/test` | embedded in-memory SurrealDB, a fresh database per test |
| E2E | Playwright (web) | `apps/app/e2e` | embedded in-memory SurrealDB, a separate API process per worker |

## Integration: one engine, a database per test
`apps/api/test/helpers.ts`: every test gets a fresh database (schema applied) on the one embedded engine of the
process (`testEngine()` from `@app/plugin-sdk/testing`). One engine per process on purpose: with
@surrealdb/node 3.0.3, Bun 1.4 crashes on exit (SIGSEGV) after a second embedded engine or `REMOVE DATABASE`,
even when every test passed, and also when the engine is still open at exit (the root `bunfig.toml` preloads
`packages/sdk/src/test-preload.ts`, which closes it after the run). Never open another `mem://` connection in tests.
That makes the crash rare, not impossible: now and then Bun still segfaults while exiting after a fully green run.
`test:unit` and `test:int` therefore run through `scripts/bun-test.ts`, which counts a SIGSEGV after a summary with
"0 fail" and no "N errors" as green (with a note), the same for a SIGABRT whose output shows the engine's
"failed to lock mutex" panic (the same teardown), and keeps every other exit code. The API is called through
`app.request()` (no ports), `close()` after each test. `t.seed()` adds the demo community, the built-in plugins
and a signed-in community admin; `t.signIn({ email, password })` signs in another seeded account. Inject a fake AI
model with `setup({}, { ai: { language } })`.

## Logs in tests
The API's log (`apps/api/src/log.ts`) is silent in `test:unit` and `test:int` (`scripts/bun-test.ts` sets
`LOG_LEVEL=silent` unless it is set): `LOG_LEVEL=debug bun run test:int` shows every line next to the test that
wrote it. The E2E API process logs warnings and errors only (`LOG_LEVEL=warn` in `fixtures.ts`).

## E2E
- Fixture `apps/app/e2e/fixtures.ts`: a worker-scoped API process (`apps/api/src/test-server.ts`) on a free port the
  OS picks,
  an auto-fixture `POST /__test/reset` before every test, the API address passed to the frontend via `window.__API_URL__`.
- Frontend: the production static Expo export (`expo export -p web`) served by `scripts/serve.ts` on a random port
  (`playwright.config.ts`). `bun run e2e` exports first; `E2E_PREBUILT=1 bun run e2e` serves the existing `dist/`
  (use it when only specs changed). E2E is not part of `bun run verify`: run the specs a change touches.
- Shared helpers (`register`, `loginAdmin`, `signOut`, `PASSWORD`, `DEMO_ADMIN`) live in `fixtures.ts`; import them
  instead of copying (`plugins.spec.ts` still has its own copies, not migrated yet).
- Native screens: covered by the Android build (`bun run android`) and iOS (CI); on-device E2E (Maestro/Detox) is deliberately out of scope.
- `/__test/reset` exists only in `test-server.ts` (NODE_ENV=test); `apps/api/scripts/build.ts` fails if it ends up in the bundle.
