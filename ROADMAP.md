# Roadmapa

Co działa w demo na HackYeah 2026 (v1), a co planujemy po hackathonie (v2). Funkcji z v2 nie ma w demo, nawet jeśli
`README.md` opisuje je jako kierunek produktu. W demo pokazujemy tylko to, co jest zbudowane i przechodzi
`bun run verify`; tutaj opisujemy resztę: co już jest gotowe w kodzie i czego brakuje.

| Funkcja                                                      | Kiedy                |
| ------------------------------------------------------------ | -------------------- |
| Generator wtyczek AI: opis → szkic → publikacja              | v1, w demo           |
| Wtyczki: zgłoszenia usterek, ogłoszenia, dyskusje            | v1, w demo           |
| Dołączanie kodem, linkiem, QR, z mapy albo z zaproszenia      | v1, w demo           |
| [Asystenci AI przez MCP](#asystenci-ai-przez-mcp)            | v2                   |
| [Sandbox dla wtyczek](#sandbox-dla-wtyczek)                  | v2                   |
| [Weryfikacja mieszkańców (mObywatel)](#weryfikacja-mieszkańców-mobywatel) | v2      |
| [Dołączanie z akceptacją](#dołączanie-z-akceptacją)          | v2                   |
| [Aktualizacje na żywo](#aktualizacje-na-żywo)                | v2                   |
| [Wtyczki zewnętrznych twórców i marketplace](#wtyczki-zewnętrznych-twórców-i-marketplace) | v2, po sandboxie |
| [Gotowe wtyczki dla miast, uczelni i osiedli](#gotowe-wtyczki-dla-miast-uczelni-i-osiedli) | v2 |
| [Produkcja: pliki w chmurze, wiele instancji API](#produkcja) | v2                  |

## v1: w demo (HackYeah 2026)

- **Miejsca:** miasto, uczelnia, spółdzielnia. Każde ma własny pulpit z widżetami wtyczek; administrator miejsca
  włącza funkcje i układa pulpit.
- **Dołączanie:** kodem, linkiem, kodem QR albo z mapy miejsc (miejsca otwarte) oraz z zaproszenia administratora.
- **Konto:** logowanie e-mailem i hasłem albo przez Google.
- **Wtyczki wbudowane:** zgłoszenia usterek (zdjęcie, miejsce na mapie, statusy, AI łączy zgłoszenia tego samego
  problemu), ogłoszenia, dyskusje.
- **Generator wtyczek AI:** administrator miejsca opisuje funkcję po polsku, a AI pisze wtyczkę i sprawdza ją
  (składnia, importy, typy, `safety`, wczytanie, schemat tabel). Szkic widzą tylko administratorzy. Po publikacji
  wtyczka działa u członków miejsca bez aktualizacji aplikacji i bez restartu serwera.
- **Powiadomienia:** push na Androidzie i iOS oraz powiadomienia o sprawach w pobliżu zapisanych adresów.
- **Mapa miejsc** i jedna baza kodu dla iOS, Androida i przeglądarki.

## v2: po hackathonie (nie ma tego w demo)

### Asystenci AI przez MCP

Każde narzędzie wtyczki (np. „zgłoś usterkę”) jest też narzędziem dla asystentów AI przez otwarty protokół
[MCP](https://modelcontextprotocol.io). Usterkę zgłaszasz jednym zdaniem do swojego asystenta.

- **Gotowe:** narzędzia wtyczek mają opis dla ludzi i AI, wejście opisane w Zod i pole `data` z wynikiem dla
  asystenta (`packages/sdk/src/plugin.ts`, `packages/sdk/src/ui.ts`).
- **Brakuje:** serwera MCP w API i autoryzacji asystenta w imieniu mieszkańca.

### Sandbox dla wtyczek

Każda wtyczka działa w izolowanym Workerze albo w WebAssembly, z własną pamięcią i limitem czasu.

- **Dziś:** wtyczki (wgrane i napisane przez AI) działają w procesie API. Chronią je etap `safety` (statyczne
  sprawdzenie kodu), zamrożone SDK i zakaz importów w czasie działania. To strażnik, nie sandbox
  (`docs/plugins.md`, Known issues).
- **Gotowe:** kontrakt wtyczki jest zaprojektowany pod izolację: wtyczka nic nie importuje i wszystko robi przez
  asynchroniczny `ctx`. Przeniesienie do sandboxu zmienia hosta, a nie kod wtyczek.
- **Przy okazji:** sprawdzanie typów i `safety` w Workerze (dziś każde sprawdzenie blokuje API na ok. 1–2 s) oraz
  etap `load` w jednorazowym Workerze (dziś każde sprawdzenie zostawia moduł w pamięci API).

### Weryfikacja mieszkańców (mObywatel)

Do miasta dołączają tylko jego mieszkańcy. Platforma dostaje jeden fakt, np. „mieszkaniec gminy Kraków”, bez
PESEL-u i innych danych osobowych. Kolejni dostawcy tożsamości działają jako adaptery.

- **Dziś:** w demo nie ma weryfikacji tożsamości, ani prawdziwej, ani udawanej. Do miejsca dołącza się kodem,
  linkiem, kodem QR, z mapy miejsc albo z zaproszenia.
- **Zależą od niej:** funkcje, w których liczy się, kto jest mieszkańcem, np. głosowania i podpisy pod inicjatywą
  ([niżej](#gotowe-wtyczki-dla-miast-uczelni-i-osiedli)).

### Dołączanie z akceptacją

Miejsce z zasadą „Z akceptacją” zbiera prośby o dołączenie, a administrator je zatwierdza.

- **Dziś:** zasadę można wybrać przy tworzeniu miejsca (jest domyślna), ale kolejki próśb nie ma: przy dołączaniu
  kodem API odpowiada `approval_required` (`apps/api/src/routes/communities.ts`). W demo dołącza się do miejsc
  otwartych albo z zaproszenia.

### Aktualizacje na żywo

Ekrany wtyczek odświeżają się same, gdy ktoś inny coś zmieni, np. gdy urząd zmieni status zgłoszenia.

- **Gotowe:** `watch()` i `streams` działają w SDK i w testach wtyczek.
- **Brakuje:** transportu w API (np. SSE albo WebSocket) i subskrypcji w aplikacji. Dziś aplikacja pobiera pulpit
  co 15 s, a widok wtyczki ponownie po akcji użytkownika.

### Wtyczki zewnętrznych twórców i marketplace

Zewnętrzni developerzy publikują wtyczki, a miejsca instalują je z katalogu.

- **Wymaga:** [sandboxu](#sandbox-dla-wtyczek). Dziś wtyczki wgrywa administrator platformy (token administracyjny)
  albo pisze je AI dla jednego miejsca.

### Gotowe wtyczki dla miast, uczelni i osiedli

Pokazujemy je jako przykłady w reklamach i scenariuszach, ale nie ma ich jeszcze jako gotowych wtyczek:

- **Budżet obywatelski:** mieszkańcy głosują w aplikacji, a wyniki widać na pulpicie. Wymaga weryfikacji
  mieszkańców.
- **Rezerwacja sal:** student wybiera salę i godzinę, a dziekanat widzi grafik.
- **Podpisy pod inicjatywą uchwałodawczą:** zweryfikowane i policzalne, bez PESEL-u na papierowej liście. Wymaga
  weryfikacji mieszkańców.
- **Odbiór odpadów:** harmonogram odbioru gabarytów w dzielnicy. Wymaga danych miasta, a wtyczka nie ma dostępu
  do sieci.

Generator AI może spróbować napisać każdą z nich, ale nie przygotowaliśmy ich ani nie sprawdziliśmy na demo.

### Produkcja

- **Pliki w chmurze:** zdjęcia są dziś na dysku serwera; docelowo R2 albo S3
  (`apps/api/src/services/files/store.ts`).
- **Wiele instancji API:** rejestr wtyczek jest w pamięci procesu. Nowo opublikowana wtyczka działa od razu w
  instancji, która ją przyjęła, a pozostałe wczytują ją dopiero po restarcie. Demo działa na jednej instancji.
