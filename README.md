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

Bun · TypeScript · SurrealDB · Expo (React Native) · MCP

## Struktura repo

```
apps/api        API (Bun + Hono): host wtyczek, REST, admin; SurrealDB, schemat w src/db (bez migracji)
apps/app        aplikacja Expo (iOS, Android, web): renderer Server-Driven UI + ekrany
packages/sdk    @app/plugin-sdk: kontrakt wtyczek (definePlugin, katalog UI, akcje) + test harness
packages/shared kontrakty aplikacji (społeczności, admin)
plugins/        wtyczki: każda to pakiet zależny tylko od SDK (issues = wbudowana, benches = wgrywana w locie)
```

## Uruchomienie

```bash
nix develop            # bun, node, just, mprocs (albo: direnv allow); z Android SDK: nix develop .#android
just dev               # bun install + mprocs: API (SurrealDB w pamięci, demo „Kraków”) i Expo w jednym terminalu
                       # Android przez USB (debugowanie USB włączone): w panelu app wciśnij „a” (Expo Go, bez pushy)
just                   # lista skrótów (api, app, usb, plugin, verify, test, e2e…)
bun install
bun run dev            # API + aplikacja Expo bez mprocs (i bez przekierowania portów USB: `just usb`)
bun run plugin:upload plugins/benches   # wgraj wtyczkę w locie
bun run verify         # lint, typy, testy, schemat bazy, E2E, build, Android (w nix develop .#android)
```

Jak pisać wtyczki: [docs/plugins.md](docs/plugins.md).

## HackYeah 2026

Projekt zgłaszamy do zadania otwartego **SMART CITY** na HackYeah 2026. Prace hackathonowe trwają od 3.10.2026, 23:00 do 4.10.2026, 23:00.

- **Co istniało przed hackathonem:** platforma, czyli rdzeń społeczności, logowanie, SDK wtyczek, renderer Server-Driven UI i wtyczki `issues` i `benches`. Stan wyjściowy to commit `9533f98`, a wszystko po nim powstało w trakcie HackYeah.
- **Nowe biblioteki (HackYeah):** `@expo-google-fonts/schibsted-grotesk` (krój pisma Google Fonts dla systemu wizualnego aplikacji) oraz `expo-font` (moduł Expo do ładowania fontów), `react-native-svg` (ilustracja mapy na ekranie logowania) oraz `lucide-react-native` (ikony linii), `expo-notifications` (powiadomienia push na Androidzie i iOS), `react-native-keyboard-controller` z wymaganymi przez nią `react-native-reanimated` i `react-native-worklets` (pole formularza i przycisk pod nim zostają nad klawiaturą). Nowy system wizualny „Twoje Miejsce” (tokeny i komponenty w `apps/app/src`) również powstał w trakcie hackathonu.
- **Zewnętrzne usługi (HackYeah):** Expo Push Service (`exp.host`) dostarcza powiadomienia push na telefony; przekazuje je dalej do Firebase Cloud Messaging (Android) i Apple Push Notification service (iOS).
- **Użycie AI:** kod i dokumentację piszemy z pomocą asystentów AI (Claude Code). Zespół rozumie każdą część rozwiązania i odpowiada za nią.
- **Zgłoszenie:** tytuł, nazwa zespołu, członkowie, opis i prezentacja PDF (maks. 10 slajdów). Opcjonalnie dochodzą repozytorium, demo i zrzuty ekranu.

## Status

Projekt hackathonowy. W demo weryfikacja tożsamości działa na mocku dostawcy, a mObywatel jest planowanym adapterem.

## Roadmapa

- Integracja z mObywatelem i innymi dostawcami tożsamości
- Wtyczki od zewnętrznych developerów, uruchamiane w izolowanym sandboxie (WebAssembly)
- Marketplace wtyczek
