# AGENTS.md — reguły dla agentów (Twoje Miejsce)

Produkt: `README.md` i `PRODUCT.md`. Nowy kod powstaje przez kopiowanie istniejących wzorców (tabele niżej).

Stack: Bun + Hono + Drizzle (SQLite przez bun:sqlite; w pamięci w testach) + Better Auth + Expo (React Native,
Expo Router; web przez react-native-web ze statycznym HTML) + i18n na plikach JSON (en domyślny).

## Definicja gotowości (jedyna)
Zadanie jest skończone tylko wtedy, gdy `bun run verify` kończy się kodem 0, a w raporcie jest
jego realny output (tabela podsumowania). "Powinno działać" nie jest dowodem.
`VERIFY_SKIP` nie jest zielonym verify — każde pominięcie musisz zgłosić z powodem.
Komendy uruchamiaj w `nix develop` (albo przez direnv: `.envrc`); pełny `verify` (z buildem Androida)
w `nix develop .#android`.

## Kolejność pracy
1. Najpierw testy E2E z kryteriów akceptacji (`apps/app/e2e/*.spec.ts`), mają failować.
2. Potem implementacja od dołu: schemat → migracja → kontrakt → API + test integracyjny → ekran.
3. `bun run verify` → commit → push.

## Nowy zasób platformy = skopiuj wzorzec "communities"
| Warstwa | Plik wzorcowy |
|---|---|
| Tabela | `apps/api/src/db/schema.ts` (`communities`) → `bun run db:generate` |
| Kontrakt (Zod + typ) | `packages/shared/src/communities.ts` |
| Router API | `apps/api/src/routes/communities.ts`, montaż w `apps/api/src/app.ts` |
| Test integracyjny | `apps/api/test/plugins.test.ts` (`describe("społeczności i nawigacja")`: 401 bez sesji, 404) |
| Dane frontu | `apps/app/src/data/communities.ts` (TanStack Query: useQuery + useMutation) |
| Ekran | `apps/app/src/screens/Communities.tsx`, trasa (cienki plik) w `apps/app/app/` |
| E2E | `apps/app/e2e/plugins.spec.ts` |
Funkcja dla mieszkańców (zgłoszenia, rezerwacje, ogłoszenia…) to NIE nowy zasób, tylko wtyczka (niżej).

## Nowa funkcja społeczności = wtyczka (docs/plugins.md)
| Warstwa | Plik wzorcowy |
|---|---|
| Wtyczka (widoki, narzędzia) | `plugins/issues/` (pakiet zależny TYLKO od `@app/plugin-sdk`); wbudowana = wpis w `apps/api/src/plugins/builtin/index.ts` |
| Test wtyczki (bez API) | `plugins/issues/issues.test.ts` (`testPlugin` z `@app/plugin-sdk/testing`) |
| Kontrakt i katalog UI | `packages/sdk/src/` (nowy węzeł UI = schemat + builder + `apps/app/src/plugins/Renderer.tsx`) |
| Test hosta (API) | `apps/api/test/plugins.test.ts` (routing, admin, izolacja przez `app.request()`) |
| E2E | `apps/app/e2e/plugins.spec.ts` |
Wtyczka nie dostaje bazy: tylko `ctx` (user, community, storage). Nie dopisuj tabel dla pojedynczej wtyczki —
dane trzyma `ctx.storage` (odizolowany per instalacja).

## Jedno źródło prawdy (zakaz równoległych ścieżek kodu)
- Typy i walidacja: tylko `packages/shared`. Front importuje typy API przez Hono RPC (`AppType`), nie pisze ich ręcznie.
- Schemat bazy: tylko `apps/api/src/db/schema.ts`. Migracje wyłącznie generowane (`bun run db:generate`).
- Klient bazy: tylko `createDb()` z `apps/api/src/db`. Kod aplikacji dostaje `Db` (Drizzle na SQLite).
- Konfiguracja aplikacji: tylko `apps/app/app.config.ts`. `android/` i `ios/` są GENEROWANE (`expo prebuild`) —
  nie edytuj ich i nie commituj. Zmiana natywna = config plugin albo pole w `app.config.ts`.
- Trasy: tylko `apps/app/app/` (Expo Router, cienkie pliki). Logika ekranów: `apps/app/src/screens/`.
- Adres API: tylko `apps/app/src/lib/config.ts`. Trwałe dane urządzenia: tylko `src/lib/storage.ts`.
- Rozgałęzienia `Platform.OS` tylko w `src/lib/` i w trasach, nigdy w ekranach.
- Teksty UI: WYŁĄCZNIE `apps/app/messages/<locale>.json` przez `const { t } = useI18n(); t.klucz()`.
  Angielski (`en`) jest bazowy; każdy klucz musi istnieć we wszystkich językach (test `src/lib/i18n.test.ts`).
- Wygląd: tylko tokeny z `apps/app/src/theme.ts`; ekrany składaj z prymitywów `src/components/ui.tsx`.
- Prawda produktowa i ton: `PRODUCT.md`. Bez wymyślonych liczb i opinii.
- Jeden runner testów: `bun test` (unit + integracja) i Playwright (E2E). Bez Jest/Vitest.
- Jeden linter/formatter: Biome. Wersje narzędzi: `flake.nix` + `bun.lock`. Wersje paczek Expo/RN tylko zgodne
  z SDK (`bunx expo install --check` w `apps/app`).

## Testy
- Unit: czysta logika, obok kodu (`*.test.ts` w `packages/shared`, `apps/app/src`).
- Integracja: `apps/api/test`, zawsze przez `setup()` (świeża baza SQLite w pamięci ze zrzutu + `app.request()`), `close()` w `afterEach`.
- E2E: web (produkcyjny statyczny eksport), import `test`/`expect` z `e2e/fixtures.ts`
  (reset bazy przed każdym testem jest automatyczny). Selektory przez role i etykiety — dlatego prymitywy UI
  ustawiają `role`, `aria-level`, `aria-label`. Natywne ekrany sprawdza build Androida/iOS (brak E2E na urządzeniu).
- `/__test/*` istnieje tylko w `apps/api/src/test-server.ts`. Nigdy nie importuj `test-*.ts` z kodu produkcyjnego.

## Frontend
Wzorce, i18n i zakazane API: `docs/expo.md`.

## Zakazy
- Żadnych sekretów w repo (`.env` jest w .gitignore). Sekrety tylko w GitHub Secrets.
- Żadnego deployu z maszyny lokalnej.
- Żadnych TODO bez uzasadnienia i numeru zadania. Żadnego martwego kodu "na później".
- Nie wyłączaj reguł Biome/TS globalnie; lokalny `biome-ignore` tylko z powodem.
- Jeśli coś wymaga kliknięcia w panelu (Cloudflare, GitHub, sklepy), napisz to wprost w raporcie — nie udawaj naprawy.

## Raport końcowy agenta
hash commita · output `bun run verify` (podsumowanie) · status CI · lista pominięć z powodem · rzeczy dla człowieka.
