# AGENTS.md — rules for agents (Twoje Miejsce)

Product: `README.md` and `PRODUCT.md`. New code is written by copying existing patterns (tables below).

Stack: Bun + Hono + Drizzle (SQLite via bun:sqlite; in-memory in tests) + Better Auth + Expo (React Native,
Expo Router; web via react-native-web with static HTML) + i18n with JSON files (en is the default).

## HackYeah 2026 (SMART CITY challenge)
Context and timeline: the "HackYeah 2026" section in `README.md`.
- The pre-hackathon state is commit `9533f98`. Do not rewrite history before it: the jury must be able to tell
  HackYeah work apart from what already existed.
- Judging criteria: idea 30%, relation to category 20%, usability 20%, design 20%, completeness 10%.
  New features must solve a concrete problem of the city or its residents and work in the demo ("Kraków").
- New external library, API or dataset: add it to the HackYeah section of `README.md` (disclosure requirement).

## Local settings
Local rules (outside git): @AGENTS.local.md
If `AGENTS.local.md` exists, read it at the start of the session and treat it as binding.
It only adds rules, it never overrides them. On conflict, AGENTS.md wins.

## Language
- The app UI (everything a user sees) must be in Polish. UI text lives only in `apps/app/messages/<locale>.json`
  and in the Polish content that plugins render (screen titles, labels, toasts, user-facing validation messages).
- Everything else is in English: identifiers (variables, functions, types, files, API routes, DB columns,
  i18n keys), code comments and JSDoc, test names, log/console output, developer-facing error messages,
  script and CI output, commit messages and developer docs (`AGENTS.md`, `docs/`).
- Exceptions: `README.md` and `PRODUCT.md` describe the product for the team and the jury and stay in Polish.
- In tests, Polish strings are allowed only as data or as selectors/assertions that must match the Polish UI.

## Definition of done (the only one)
A task is done only when `bun run verify` exits with code 0 and the report contains its real
output (the summary table). "Should work" is not evidence.
`VERIFY_SKIP` is not a green verify — report every skipped stage with a reason.
Run commands in `nix develop` (or via direnv: `.envrc`); the full `verify` (with the Android build)
in `nix develop .#android`.

## Order of work
1. E2E tests from the acceptance criteria first (`apps/app/e2e/*.spec.ts`); they must fail.
2. Then implement bottom-up: schema → migration → contract → API + integration test → screen.
3. `bun run verify` → commit → push.

## New platform resource = copy the "communities" pattern
| Layer | Pattern file |
|---|---|
| Table | `apps/api/src/db/schema.ts` (`communities`) → `bun run db:generate` |
| Contract (Zod + type) | `packages/shared/src/communities.ts` |
| API router | `apps/api/src/routes/communities.ts`, mounted in `apps/api/src/app.ts` |
| Integration test | `apps/api/test/plugins.test.ts` (communities/navigation: 401 without a session, 404) |
| Frontend data | `apps/app/src/data/communities.ts` (TanStack Query: useQuery + useMutation) |
| Screen | `apps/app/src/screens/Communities.tsx`, route (thin file) in `apps/app/app/` |
| E2E | `apps/app/e2e/plugins.spec.ts` |
A feature for residents (issue reports, bookings, announcements…) is NOT a new resource but a plugin (below).

## New community feature = plugin (docs/plugins.md)
| Layer | Pattern file |
|---|---|
| Plugin (views, tools) | `plugins/issues/` (a package that depends ONLY on `@app/plugin-sdk`); built-in = entry in `apps/api/src/plugins/builtin/index.ts` |
| Plugin test (no API) | `plugins/issues/issues.test.ts` (`testPlugin` from `@app/plugin-sdk/testing`) |
| Contract and UI catalog | `packages/sdk/src/` (new UI node = schema + builder + `apps/app/src/plugins/Renderer.tsx`) |
| Host test (API) | `apps/api/test/plugins.test.ts` (routing, admin, isolation via `app.request()`) |
| E2E | `apps/app/e2e/plugins.spec.ts` |
A plugin gets no access to the app database and no disk: only `ctx` (user with role, community, now, db, files, ai;
docs/plugins.md). Do not add tables for a single plugin — its data lives in `ctx.db` (isolated per installation).

## Single source of truth (no parallel code paths)
- Types and validation: only `packages/shared` (app contracts) and `packages/sdk` (plugin contract).
  The frontend imports API types via Hono RPC (`AppType`) and never writes them by hand.
- Database schema: only `apps/api/src/db/schema.ts`. Migrations are generated only (`bun run db:generate`).
- Database client: only `createDb()` from `apps/api/src/db`. Application code receives `Db` (Drizzle on SQLite).
- App configuration: only `apps/app/app.config.ts`. `android/` and `ios/` are GENERATED (`expo prebuild`) —
  do not edit or commit them. A native change = a config plugin or a field in `app.config.ts`.
- Routes: only `apps/app/app/` (Expo Router, thin files). Screen logic: `apps/app/src/screens/`.
- API address: only `apps/app/src/lib/config.ts`. Persistent device data: only `src/lib/storage.ts`.
- `Platform.OS` branches only in `src/lib/` and in routes, never in screens.
- UI text: ONLY `apps/app/messages/<locale>.json` via `const { t } = useI18n(); t.key()`.
  English (`en`) is the base locale; every key must exist in all locales (test `src/lib/i18n.test.ts`).
- Look and feel: only tokens from `apps/app/src/theme.ts`; build screens from the primitives in `src/components/ui.tsx`.
- Product truth and tone: `PRODUCT.md`. No made-up numbers or opinions.
- One test runner: `bun test` (unit + integration) and Playwright (E2E). No Jest/Vitest.
- One linter/formatter: Biome. Tool versions: `flake.nix` + `bun.lock`. Expo/RN package versions only
  as compatible with the SDK (`bunx expo install --check` in `apps/app`).

## Tests
- Unit: pure logic, next to the code (`*.test.ts` in `packages/*`, `plugins/*`, `apps/app/src`).
- Integration: `apps/api/test`, always through `setup()` (a fresh in-memory SQLite DB from a snapshot +
  `app.request()`), `close()` in `afterEach`.
- E2E: web (production static export), import `test`/`expect` from `e2e/fixtures.ts`
  (the DB is reset automatically before every test). Select by roles and labels — that is why UI primitives
  set `role`, `aria-level`, `aria-label`. Native screens are covered by the Android/iOS build (no on-device E2E).
- `/__test/*` exists only in `apps/api/src/test-server.ts`. Never import `test-*.ts` from production code.

## Frontend
Patterns, i18n and forbidden APIs: `docs/expo.md`.

## Don'ts
- No secrets in the repo (`.env` is gitignored). Secrets only in GitHub Secrets.
- No deploys from a local machine.
- No TODOs without a reason and a task number. No dead code "for later".
- Do not disable Biome/TS rules globally; a local `biome-ignore` only with a reason.
- If something requires clicking in a dashboard (Cloudflare, GitHub, stores), say so plainly in the report — do not fake a fix.

## Final agent report
commit hash · `bun run verify` output (summary) · CI status · skipped items with reasons · things for a human.
