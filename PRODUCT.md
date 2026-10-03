# PRODUCT

> Prawda produktowa. Opis dla ludzi: `README.md`. Tu: to, czego trzyma się kod i teksty UI.

## Produkt
Twoje Miejsce: cyfrowe społeczności dla prawdziwych miejsc (miasto, uczelnia, osiedle). Każda społeczność
włącza tylko potrzebne funkcje, a każda funkcja to wtyczka z własnym, odizolowanym stanem.
Jedna baza kodu działa w przeglądarce, na Androidzie i iOS.

## Odbiorcy
- Członek społeczności: korzysta z funkcji wtyczek (np. zgłasza usterkę).
- Administrator społeczności (np. urząd miasta): zarządza treściami wtyczek (np. zmienia status zgłoszeń).
  Demo: `admin@krakow.test` / `password`.
- Administrator platformy: wgrywa i instaluje wtyczki przez API administracyjne.

## Powierzchnie
| Powierzchnia | Tryb | Cel |
|---|---|---|
| `/login`, `/register` | Operate | Wejście do aplikacji (`/` przekierowuje do `/app`) |
| `/app` | Operate | Lista społeczności użytkownika, wylogowanie |
| `/app/c/<slug>` | Operate | Funkcje (wtyczki) włączone w społeczności |
| `/app/c/<slug>/<wtyczka>/<widok>` | Operate | Widok wtyczki (Server-Driven UI z API) |

## Status demo
Weryfikacja tożsamości działa na mocku dostawcy; mObywatel jest planowanym adapterem. Społeczność demo: „Kraków”.

## Język
Aplikacja jest tylko po polsku. Teksty UI wyłącznie w `apps/app/src/texts.ts`. Treści wtyczek (po polsku)
przychodzą z serwera.

## Ton
Spokojny, rzeczowy. Bez obietnic liczbowych i bez wymyślonych opinii.
Żadnych fałszywych dowodów społecznych: liczby/opinie tylko z prawdziwymi danymi.

## Ograniczenia
- Wygląd w tokenach: `apps/app/src/theme.ts`.
- Dostępność: kontrast AA, pełna obsługa klawiaturą, semantyczne nagłówki (E2E wybiera po rolach).
- Bezpieczna rozszerzalność: wtyczka nie ma dostępu do bazy ani plików, tylko do `ctx` (user z rolą, community, db, files, ai, notify). Lokalizacje mieszkańców zna tylko host.

## Platform
Natywne iOS i Android (React Native przez Expo) + web (react-native-web, statyczny HTML) z jednego kodu.
