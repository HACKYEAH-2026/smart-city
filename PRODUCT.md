# PRODUCT

> Prawda produktowa szablonu. Nowa aplikacja z szablonu NADPISUJE ten plik (razem z SPEC.md).

## Produkt
Demonstracyjna aplikacja notatek zbudowana z szablonu "dark-expo": jedna baza kodu
działa w przeglądarce, na Androidzie i iOS. Notatki należą do użytkownika (konto email + hasło).

## Odbiorcy
- Użytkownik końcowy: osoba, która chce szybko zapisywać i edytować krótkie notatki na telefonie i w przeglądarce.
- Właściciel szablonu: zespół/agent, który podmienia treść i tokeny, żeby wystartować nowy produkt.

## Powierzchnie
| Powierzchnia | Tryb | Cel |
|---|---|---|
| `/` landing (prerender) | Persuade | Odwiedzający rozumie, co to jest, i zakłada konto |
| `/about` (prerender) | Read | Krótko o projekcie |
| `/login`, `/register` | Operate | Wejście do aplikacji |
| `/app` notatki | Operate | Dodaj / edytuj / usuń notatkę |

## Języki
Angielski (domyślny) i polski. Na webie strony marketingowe mają język w URL (`/pl/...`), ekrany aplikacji — z preferencji/urządzenia. Teksty wyłącznie w Paraglide (`apps/app/messages`).

## Ton
Spokojny, rzeczowy. Bez obietnic liczbowych i bez wymyślonych opinii klientów.
Żadnych fałszywych dowodów społecznych: sekcje z liczbami/opiniami tylko z prawdziwymi danymi.

## Ograniczenia
- Teksty w `apps/app/messages/<locale>.json`, układ landingu w `apps/app/src/screens/Landing.tsx`. Wygląd w tokenach: `apps/app/src/theme.ts`.
- Strony marketingowe muszą renderować się bez JS (statyczny eksport Expo), działać bez stanu przeglądarki.
- Dostępność: kontrast AA, pełna obsługa klawiaturą, semantyczne nagłówki (E2E wybiera po rolach).

## Platform
natywne iOS i Android (React Native przez Expo) + web (react-native-web, statyczny HTML) z jednego kodu.