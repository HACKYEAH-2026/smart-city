# Twoje Miejsce

**Cyfrowe społeczności dla prawdziwych miejsc: miasta, uczelni, osiedla. Z zweryfikowanymi członkami i funkcjami, które dodajesz jak wtyczki.**

Lokalne grupy na Facebooku są pełne botów, anonimów i chaosu, a oficjalne systemy miejskie rzadko dają ludziom wygodny kanał kontaktu. Twoje Miejsce łączy jedno i drugie: każda społeczność jest przypisana do konkretnego miejsca, a dołączyć do niej mogą tylko ci, którzy faktycznie do niego należą.

## Jak to działa

1. **Tworzysz społeczność** dla miasta, uczelni albo osiedla.
2. **Mieszkańcy dołączają po weryfikacji** tożsamości (np. przez mObywatela), więc wiadomo, że rozmawiasz z prawdziwym mieszkańcem, a nie z botem.
3. **Dodajesz funkcje wtyczkami**: zgłaszanie usterek, rezerwacja sal, ogłoszenia, głosowania. Każda społeczność włącza tylko to, czego potrzebuje.
4. **Asystenci AI mogą z tego korzystać**: wtyczki wystawiają narzędzia przez [MCP](https://modelcontextprotocol.io), więc zgłoszenie „zepsutej latarni" możesz zrobić jednym zdaniem do swojego asystenta.

## Przykładowe zastosowania

| Społeczność | Wtyczka | Co dostajesz |
|---|---|---|
| Miasto | Zgłoszenia usterek | Mieszkańcy zgłaszają problemy, urząd widzi je w jednym miejscu |
| Uczelnia | Rezerwacje sal | Studenci i wykładowcy rezerwują sale, każda uczelnia ma własne dane |
| Osiedle | Sprawy wspólnoty | Ogłoszenia, głosowania, zgłoszenia do zarządcy |

## Najważniejsze cechy

- **Zweryfikowani członkowie.** Przechowujemy tylko informację „mieszkaniec gminy X", bez danych osobowych typu PESEL.
- **Wtyczki bez ograniczeń domenowych.** Ta sama wtyczka działa w setkach społeczności, a każda ma własny, odizolowany stan.
- **Gotowe pod AI.** Funkcje wtyczek są dostępne dla agentów przez MCP.
- **Bezpieczna rozszerzalność.** Wtyczki nie mają dostępu do bazy danych ani plików, tylko do wąskiego API platformy.

## Stack

Bun · TypeScript · SQLite · Expo (React Native) · MCP

## Struktura repo

```
apps/api        API (Bun + Hono): host wtyczek, REST, admin; baza SQLite w src/db, migracje w migrations/
apps/app        aplikacja Expo (iOS, Android, web): renderer Server-Driven UI + ekrany
packages/sdk    @app/plugin-sdk: kontrakt wtyczek (definePlugin, katalog UI, akcje) + test harness
packages/shared kontrakty aplikacji (społeczności, admin)
plugins/        wtyczki: każda to pakiet zależny tylko od SDK (issues = wbudowana, benches = wgrywana w locie)
```

## Uruchomienie

```bash
nix develop            # bun, node, sqlite (albo: direnv allow); z Android SDK: nix develop .#android
bun install
bun run dev            # API (SQLite w pamięci, demo: społeczność „Kraków”) + aplikacja Expo
bun run plugin:upload plugins/benches   # wgraj wtyczkę w locie
bun run verify         # lint, typy, testy, migracje, E2E, build, Android (w nix develop .#android)
```

Jak pisać wtyczki: [docs/plugins.md](docs/plugins.md).

## Status

Projekt hackathonowy. W demo weryfikacja tożsamości działa na mocku dostawcy, a mObywatel jest planowanym adapterem.

## Roadmapa

- Integracja z mObywatelem i innymi dostawcami tożsamości
- Wtyczki od zewnętrznych developerów, uruchamiane w izolowanym sandboxie (WebAssembly)
- Marketplace wtyczek
