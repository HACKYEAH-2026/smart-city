# Testy

| Poziom | Runner | Gdzie | Baza |
|---|---|---|---|
| unit | bun test | `packages/shared/src`, `apps/app/src` | — |
| integracja | bun test | `apps/api/test` | SQLite w pamięci ze zrzutu, świeża baza na test |
| E2E | Playwright (web) | `apps/app/e2e` | SQLite w pamięci, osobny proces API per worker |

## Integracja: zrzut SQLite
`@app/testing/db`: raz na proces migracje → `Database.serialize()`; każdy test dostaje
`Database.deserialize(zrzut)` (baza w pamięci, bez ponownych migracji). API wołane przez `app.request()`
(bez portów), `close()` po teście.

## E2E
- Fixture `@app/testing/playwright`: worker-scoped proces API (`apps/api/src/test-server.ts`) na porcie 4100+N,
  auto-fixture `POST /__test/reset` przed każdym testem, adres API przekazany frontowi przez `window.__API_URL__`.
- Front: produkcyjny statyczny eksport Expo (`expo export -p web`) serwowany przez `scripts/serve.ts` jak na Workers.
- Natywne ekrany: pokrywa je build Androida (verify) i iOS (CI); E2E na urządzeniu (Maestro/Detox) świadomie poza szablonem.
- `/__test/reset` istnieje tylko w `test-server.ts` (NODE_ENV=test); `apps/api/scripts/build.ts` failuje, jeśli trafi do bundla.

## Backup
`bun run backup:test` (wymaga `sqlite3` z devShella): migracje + dane → `backup.sh` (`sqlite3 .backup` + gzip) → `restore.sh` do nowego pliku → porównanie.