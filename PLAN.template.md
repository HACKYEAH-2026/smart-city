# PLAN: <nazwa aplikacji>

> Skopiuj do `PLAN.md`. To pamięć między rundami agenta: na starcie rundy przeczytaj,
> na końcu zaktualizuj (odhacz, dopisz hash commita i output verify). Jedna runda = jeden kamień milowy.

## Stan
- Ostatni zielony `bun run verify`: <data> @ <hash>
- CI na main: <link / status>
- Blokery (wymagają człowieka):

## Kamienie milowe
- [ ] M0 SPEC.md uzupełniony, kryteria akceptacji ponumerowane
- [ ] M1 Testy E2E dla wszystkich AC (czerwone), commit
- [ ] M2 Model danych: schema.ts + `bun run db:generate` + kontrakt w `packages/shared` + unit
- [ ] M3 API: routery wg wzorca notes + testy integracyjne (w tym autoryzacja)
- [ ] M4 Ekrany + dane (query/action) — E2E zielone
- [ ] M5 Strony marketingowe (prerender) + treści
- [ ] M6 Mobile: appId/appName, ikony, `bun run android` zielone, iOS w CI zielone
- [ ] M7 Wdrożenie: sekrety w GitHub, `infra` apply staging, deploy staging, smoke OK
- [ ] M8 Release: tag v0.1.0 → prod + artefakty mobilne

## Dziennik rund
| Runda | Kamień | Wynik verify | Commit | Uwagi |
|---|---|---|---|---|
| 1 | | | | |
