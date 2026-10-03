# Twoje Miejsce

**Cyfrowe społeczności dla prawdziwych miejsc: miasta, uczelni, osiedla. Z zweryfikowanymi członkami i funkcjami, które dodajesz jak wtyczki.**

Lokalne grupy na Facebooku są pełne botów, anonimów i chaosu, a oficjalne systemy miejskie rzadko dają ludziom wygodny kanał kontaktu. Twoje Miejsce łączy jedno i drugie: każda społeczność jest przypisana do konkretnego miejsca, a dołączyć do niej mogą tylko ci, którzy faktycznie do niego należą.

## Jak to działa

1. **Tworzysz społeczność** dla miasta, uczelni albo osiedla.
2. **Mieszkańcy dołączają po weryfikacji** tożsamości (np. przez mObywatela), więc wiadomo, że rozmawiasz z prawdziwym mieszkańcem, a nie z botem.
3. **Dodajesz funkcje wtyczkami**: zgłaszanie usterek, rezerwacja sal, ogłoszenia, głosowania. Każda społeczność włącza tylko to, czego potrzebuje.
   Brakuje funkcji? Administrator miejsca opisuje ją własnymi słowami, a AI pisze wtyczkę i sprawdza ją jak każdą inną. Do publikacji wtyczka jest szkicem widocznym tylko dla administratorów, a zmieniać ją przez AI („dodaj zdjęcie”) można zawsze, także po publikacji.
4. **Asystenci AI mogą z tego korzystać**: wtyczki wystawiają narzędzia przez [MCP](https://modelcontextprotocol.io), więc zgłoszenie „zepsutej latarni" możesz zrobić jednym zdaniem do swojego asystenta.

## Przykładowe zastosowania

| Społeczność | Wtyczka            | Co dostajesz                                                        |
| ----------- | ------------------ | ------------------------------------------------------------------- |
| Miasto      | Zgłoszenia usterek | Mieszkańcy zgłaszają problemy, urząd widzi je w jednym miejscu      |
| Uczelnia    | Rezerwacje sal     | Studenci i wykładowcy rezerwują sale, każda uczelnia ma własne dane |
| Osiedle     | Sprawy wspólnoty   | Ogłoszenia, głosowania, zgłoszenia do zarządcy                      |

## Najważniejsze cechy

- **Zweryfikowani członkowie.** Przechowujemy tylko informację „mieszkaniec gminy X", bez danych osobowych typu PESEL.
- **Wtyczki bez ograniczeń domenowych.** Ta sama wtyczka działa w setkach społeczności, a każda ma własny, odizolowany stan.
- **Gotowe pod AI.** Funkcje wtyczek są dostępne dla agentów przez MCP.
- **Bezpieczna rozszerzalność.** Wtyczki nie mają dostępu do bazy danych ani plików, tylko do wąskiego API platformy.
- **Wtyczki pisane przez AI.** Agent (Strands Agents) pisze wtyczkę i poprawia ją, aż przejdzie wszystkie etapy sprawdzania: składnię, importy, typy, blokadę furtek do serwera (`safety`), wczytanie i zgodność tabel.

## Stack

Bun · TypeScript · SurrealDB · Expo (React Native) · MCP

## Struktura repo

```
apps/api        API (Bun + Hono): host wtyczek, REST, admin; SurrealDB, schemat w src/db (bez migracji)
apps/app        aplikacja Expo (iOS, Android, web): renderer Server-Driven UI + ekrany
packages/sdk    @app/plugin-sdk: kontrakt wtyczek (definePlugin, katalog UI, akcje) + test harness
packages/shared kontrakty aplikacji (społeczności, admin)
plugins/        wtyczki: każda to pakiet zależny tylko od SDK (issues, announcements, discussions = wbudowane)
```

## Uruchomienie

```bash
nix develop            # bun, node, just, mprocs (albo: direnv allow); z Android SDK: nix develop .#android
just dev               # bun install + mprocs: API (SurrealDB na dysku w apps/api/.data, demo „Kraków” i 40 pinezek na mapie) i Expo w jednym terminalu
                       # Android przez USB (debugowanie USB włączone): w panelu app wciśnij „a” (Expo Go, bez pushy)
just dev-ios           # iPhone (Expo Go): kabel USB + włączony Hotspot osobisty, albo ta sama sieć Wi-Fi co Mac;
                       # zeskanuj kod QR aparatem iPhone'a; inny adres: just dev-ios 192.168.x.y
just                   # lista skrótów (api, app, usb, plugin, verify, test, e2e…)
bun install
bun run dev            # API + aplikacja Expo bez mprocs (i bez przekierowania portów USB: `just usb`)
bun run plugin:upload <katalog-wtyczki>   # wgraj nową wtyczkę w locie
bun run verify         # lint, typy, testy, schemat bazy, E2E, build, Android (w nix develop .#android)
```

Jak pisać wtyczki: [docs/plugins.md](docs/plugins.md). Jak działa architektura (interaktywnie, otwórz w przeglądarce): [docs/architecture/index.html](docs/architecture/index.html).

## HackYeah 2026

Projekt zgłaszamy do zadania otwartego **SMART CITY** na HackYeah 2026. Prace hackathonowe trwają od 3.10.2026, 23:00 do 4.10.2026, 23:00.

- **Co istniało przed hackathonem:** platforma, czyli rdzeń społeczności, logowanie, SDK wtyczek, renderer Server-Driven UI i wtyczki `issues` i `benches` (`benches` usunęliśmy w trakcie HackYeah). Stan wyjściowy to commit `9533f98`, a wszystko po nim powstało w trakcie HackYeah.
- **Nowe biblioteki (HackYeah):** `@expo-google-fonts/schibsted-grotesk` (krój pisma Google Fonts dla systemu wizualnego aplikacji) oraz `expo-font` (moduł Expo do ładowania fontów), `react-native-svg` (ilustracja mapy na ekranie logowania) oraz `lucide-react-native` (ikony linii), `expo-notifications` (powiadomienia push na Androidzie i iOS), `react-native-keyboard-controller` z wymaganymi przez nią `react-native-reanimated` i `react-native-worklets` (pole formularza i przycisk pod nim zostają nad klawiaturą) oraz `react-native-is-edge-to-edge` (wykrywa rysowanie pod paskami systemu), `expo-haptics` (lekka wibracja przy naciśnięciu przycisku), `@react-native-google-signin/google-signin` (natywne logowanie i zakładanie konta przez Google na Androidzie i iOS), `@gorhom/bottom-sheet` z `react-native-gesture-handler` (wysuwany panel przełącznika miejsc, zamykany gestem), `qrcode-generator` (kod QR z linkiem do dołączenia do miejsca), `date-fns` (czas zaproszeń po polsku: „5 min temu”, „wczoraj” albo data), `expo-location` (położenie użytkownika na mapie miejsc), `react-native-webview` (mapa w aplikacji na Androidzie i iOS) oraz MapLibre GL JS (`maplibre-gl` 5.24.0, ładowana z CDN `unpkg.com` i sprawdzana sumą SRI; rysuje mapę miejsc i wybór lokalizacji miejsca). Nowy system wizualny „Twoje Miejsce” (tokeny i komponenty w `apps/app/src`) również powstał w trakcie hackathonu.
- **Zewnętrzne usługi (HackYeah):** Expo Push Service (`exp.host`) dostarcza powiadomienia push na telefony; przekazuje je dalej do Firebase Cloud Messaging (Android) i Apple Push Notification service (iOS). Logowanie przez Google (Google Identity, OpenID Connect): telefon pobiera od Google ID token, a API sprawdza go kluczami publicznymi Google (`googleapis.com`). Mapa miejsc: kafelki i styl „Positron” z OpenFreeMap (`tiles.openfreemap.org`) na danych OpenStreetMap (© współtwórcy OpenStreetMap, licencja ODbL). Wyszukiwanie adresów: Photon (komoot, `photon.komoot.io`, dane OpenStreetMap). Adres w punkcie mapy: Usługa Uniwersalnego Geokodowania GUGiK (`services.gugik.gov.pl/uug`, państwowy rejestr punktów adresowych PRG), a gdy GUGiK nie zna adresu w pobliżu, Photon. Pinezki demo na mapie miejsc (seed lokalnego API, `apps/api/src/test-routes.ts`) to 39 prawdziwych miejsc publicznych Krakowa (uczelnie, urzędy, biblioteki, muzea, parki, szpitale): nazwy, adresy i współrzędne z OpenStreetMap, wyszukane raz ręcznie w Photon i Nominatim (`nominatim.openstreetmap.org`). Aplikacja nie odpytuje Nominatim. Lektor reklam (`demo-video/scripts/voiceover.ts`, uruchamiany ręcznie): ElevenLabs (`api.elevenlabs.io`) czyta scenariusz po polsku i podaje czas każdego słowa, a jego transkrypcja (Scribe) sprawdza, czy nagranie zgadza się ze scenariuszem. Zdjęcia i klipy reklam (`demo-video/scripts/media.ts`, uruchamiany ręcznie; prompty w `demo-video/src/ads/shared/media.ts`) generuje Gemini API (`generativelanguage.googleapis.com`): zdjęcia model `gemini-3.1-flash-image`, klipy Google Veo 3.1 Fast. To ilustracje wygenerowane przez AI, a nie nagrania prawdziwych użytkowników.
- **Generator wtyczek (HackYeah):** biblioteka `@strands-agents/sdk` (Strands Agents: agent z narzędziem `check_plugin`, który pisze i poprawia wtyczkę; także `ctx.ai` wtyczek) z klientem `openai`; usługa OpenAI API (`api.openai.com`, model z `AI_MODEL`, domyślnie `gpt-5-mini`). Bez klucza generator jest wyłączony. Wtyczki mogą też liczyć embeddingi tekstu (`ctx.ai.embed`, np. do wyłapywania powtórzonych zgłoszeń): ten sam klucz i endpoint embeddingów OpenAI API, model `text-embedding-3-small`.
- **Użycie AI:** kod i dokumentację piszemy z pomocą asystentów AI (Claude Code). Zespół rozumie każdą część rozwiązania i odpowiada za nią.
- **Zgłoszenie:** tytuł, nazwa zespołu, członkowie, opis i prezentacja PDF (maks. 10 slajdów). Opcjonalnie dochodzą repozytorium, demo i zrzuty ekranu.

## Status

Projekt hackathonowy. W demo weryfikacja tożsamości działa na mocku dostawcy, a mObywatel jest planowanym adapterem.

## Roadmapa

- Integracja z mObywatelem i innymi dostawcami tożsamości
- Wtyczki od zewnętrznych developerów, uruchamiane w izolowanym sandboxie (WebAssembly)
- Marketplace wtyczek
