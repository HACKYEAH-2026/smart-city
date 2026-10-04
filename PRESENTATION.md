---
marp: true
lang: pl
size: 16:9
paginate: true
title: Twoje Miejsce
description: Prezentacja na HackYeah 2026 (SMART CITY)
footer: Twoje Miejsce · HackYeah 2026 · SMART CITY
style: |
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600&family=Schibsted+Grotesk:wght@400;500;600;700&display=swap');
  section {
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    font-family: 'Schibsted Grotesk', sans-serif;
    background: #F5F3EE;
    color: #3E3E46;
    font-size: 25px;
    line-height: 1.45;
    padding: 52px 72px 64px;
  }
  h1 {
    font-family: 'Schibsted Grotesk', sans-serif;
    font-weight: 700;
    font-size: 46px;
    line-height: 1.12;
    letter-spacing: -0.01em;
    color: #1B1B1F;
    margin: 0 0 26px;
  }
  h2 {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 600;
    font-size: 24px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    background: linear-gradient(135deg, #D81B60 0%, #F2545B 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    color: transparent;
    margin: 0 0 8px;
  }
  h3 {
    font-size: 32px;
    font-weight: 600;
    background: linear-gradient(135deg, #D81B60 0%, #F2545B 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    color: transparent;
    margin: 28px 0 0;
  }
  strong { color: #1B1B1F; font-weight: 600; }
  em { color: #5E5E66; }
  ul, ol { padding-left: 1.1em; margin: 0; }
  li { margin: 0.35em 0; }
  li::marker { color: #D81B60; font-weight: 600; }
  code {
    background: #EAE7E0;
    color: #1B1B1F;
    border-radius: 6px;
    padding: 0.05em 0.35em;
    font-size: 0.85em;
  }
  /* Slides with a screenshot (class "shot"): the text keeps left of a phone-sized frame on the right. */
  section.shot { padding-right: 420px; }
  /* A screenshot slot. Replace it with ![bg right:34%](zrzut.png) once the screenshot exists. */
  blockquote {
    position: absolute;
    top: 52px;
    right: 72px;
    width: 270px;
    height: 560px;
    margin: 0;
    box-sizing: border-box;
    padding: 28px;
    border: 2px dashed #D3CEC2;
    border-radius: 32px;
    background: #EAE7E0;
    color: #5E5E66;
    font-size: 19px;
    line-height: 1.4;
    display: flex;
    align-items: center;
    text-align: center;
  }
  blockquote p { margin: 0; }
  /* The theme's tabular-nums gives commas and colons a digit's width in this font. */
  table { display: table; border-collapse: collapse; width: 100%; font-size: 21px; font-variant: normal; margin: 6px 0 24px; }
  table tr, table tr:nth-child(2n) { background: transparent; }
  table th {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #5E5E66;
    text-align: left;
    background: transparent;
    border: none;
    border-bottom: 2px solid #DDD9CF;
    padding: 8px 14px;
  }
  table td {
    background: #FFFFFF;
    border: none;
    border-bottom: 1px solid #EEEBE4;
    padding: 11px 14px;
    color: #1B1B1F;
    vertical-align: top;
  }
  footer { color: #8A8A92; font-size: 15px; left: 72px; }
  section::after { color: #8A8A92; font-size: 16px; right: 72px; }
  /* A process drawn as a row of numbered steps (the ordered list of the slide). */
  section.flow ol {
    display: flex;
    gap: 14px;
    list-style: none;
    padding: 0;
    margin: 6px 0 30px;
    counter-reset: step;
  }
  section.flow ol li {
    flex: 1;
    margin: 0;
    padding: 16px 16px 18px;
    background: #FFFFFF;
    border: 1px solid #E3E0D8;
    border-radius: 18px;
    font-size: 19px;
    line-height: 1.3;
    color: #5E5E66;
    counter-increment: step;
  }
  section.flow ol li::before {
    content: counter(step);
    display: table;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 600;
    font-size: 22px;
    background: linear-gradient(135deg, #D81B60 0%, #F2545B 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    color: transparent;
    margin-bottom: 4px;
  }
  section.flow ol li strong { display: block; font-size: 21px; margin-bottom: 2px; }
  section.flow ul { font-size: 23px; }
  /* Places side by side (class "places"): each top-level item is a card, its nested list the place's functions. */
  section.places > ul {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 14px;
    list-style: none;
    padding: 0;
    margin: 6px 0 28px;
  }
  section.places > ul > li {
    margin: 0;
    padding: 18px 18px 20px;
    background: #FFFFFF;
    border: 1px solid #E3E0D8;
    border-radius: 18px;
  }
  section.places > ul > li > strong { display: block; font-size: 22px; line-height: 1.2; margin-bottom: 10px; }
  section.places ul ul { padding-left: 1em; font-size: 19px; line-height: 1.3; color: #5E5E66; }
  section.places ul ul li { margin: 0.35em 0; }
  section.places p { font-size: 23px; }
  /* Title and closing slides: the accent gradient, from the first colour to the second. */
  section.lead {
    display: flex;
    flex-direction: column;
    justify-content: center;
    background: linear-gradient(135deg, #D81B60 0%, #F2545B 100%);
    color: #FFFFFF;
  }
  section.lead h1 { color: #FFFFFF; font-size: 72px; margin: 18px 0 10px; }
  section.lead h2 {
    font-family: 'Schibsted Grotesk', sans-serif;
    text-transform: none;
    letter-spacing: 0;
    font-weight: 500;
    font-size: 36px;
    background: none;
    -webkit-text-fill-color: #FFFFFF;
    color: #FFFFFF;
    margin: 0 0 28px;
  }
  section.lead p { color: #FFFFFF; font-size: 24px; margin: 6px 0; }
  section.lead strong { color: #FFFFFF; }
  section.lead img { border-radius: 24px; }
---

<!-- _class: lead -->
<!-- _paginate: false -->
<!-- _footer: "" -->

![w:120](apps/app/assets/brand-tile.svg)

# Twoje Miejsce

## Rośnie razem z Twoimi potrzebami.

Cyfrowe społeczności dla prawdziwych miejsc: miasta, uczelni, osiedla.

**HackYeah 2026 · SMART CITY · Twój Team**

<!--
Notatki: jedno zdanie o tym, czym jest Twoje Miejsce. Hasło pada tu i na końcu. Problem tylko mówimy (bez slajdu):
lokalne sprawy giną w grupach na Facebooku (boty, anonimy, chaos) i w formularzach miasta, a każda nowa usługa to
nowe zamówienie i nowa aplikacja. Bez liczb (PRODUCT.md: żadnych wymyślonych danych).
-->

---

<!-- _class: shot -->

> 📸 Zrzut: pulpit Krakowa z widżetami wtyczek i przełącznikiem miejsc

## Rozwiązanie

# Jedna aplikacja, która dopasowuje się do miejsca

- **Każde miejsce ma swoją społeczność.**
- **Funkcje to wtyczki:** miejsce włącza tylko potrzebne.
- **Jedno konto, wiele miejsc.**
- **iOS, Android i przeglądarka.**

<!--
Notatki: administrator miejsca włącza wtyczki i układa pulpit mieszkańców. Jedna baza kodu dla trzech platform.
W demo konto anna@krakow.test należy do czterech miejsc: Kraków, Tauron Arena Kraków, Kampus Główny,
Spółdzielnia Słoneczna, i przełącza się między nimi.
-->

---

<!-- _class: shot -->

> 📸 Zrzut: nowe zgłoszenie ze zdjęciem i miejscem na mapie, obok arkusz „Czy to ten sam problem?”

## Dla mieszkańca

# Usterkę zgłaszasz zdjęciem

1. **Zdjęcie i miejsce na mapie.**
2. **AI pyta: „Czy to ten sam problem?”**
3. **Podbijasz i komentujesz.**
4. **Push, gdy urząd odpowie.**

<!--
Notatki: to jest kryterium „użyteczność”. Pokazać, że cała ścieżka to kilka dotknięć, bez logowania do osobnego systemu miasta.
Zgłoszenie może być anonimowe, jeśli miejsce na to pozwala. Gdy AI znajdzie to samo zgłoszenie, mieszkaniec dołącza do
niego zamiast tworzyć nowe. Push przychodzi też, gdy urząd zamknie zgłoszenie.
-->

---

<!-- _class: shot -->

> 📸 Zrzut: panel administratora zgłoszeń z kategorią i odpowiedzią urzędu

## Dla urzędu

# Jedno zgłoszenie zamiast wielu takich samych

- **Takie same zgłoszenia łączą się w jedno.** Urząd widzi, ilu mieszkańców to dotyczy.
- **AI nadaje kategorię,** urząd może ją zmienić.
- **Odpowiedź dociera do każdego,** kto zgłosił sprawę.

<!--
Notatki: to jest kryterium „związek z kategorią SMART CITY”. Mniej duplikatów to mniej pracy urzędu; mieszkaniec widzi odpowiedź zamiast ciszy.
Kategorie: drogi i chodniki, oświetlenie, czystość, zieleń. Odpowiedź dla mieszkańców i notatka wewnętrzna; zamknięcie
powiadamia autora i osoby, które dołączyły. W tym samym miejscu ogłoszenia i dyskusje. Ustawienia miejsca: głosowanie,
komentarze, widoczność, zgłoszenia anonimowe, wymagane zdjęcie.
-->

---

<!-- _class: flow -->

## Przykład: Spółdzielnia Słoneczna

# Nowa potrzeba to nowa funkcja, nie nowa aplikacja

1. **Dziś** Usterki, ogłoszenia, dyskusje.
2. **Nowa potrzeba** Dziki na osiedlu. Dobre meble przy śmietniku.
3. **Administrator opisuje** „Uwaga, dzik!” i „Oddam za darmo”.
4. **Mieszkańcy dostają** ostrzeżenie o dziku w pobliżu i tablicę rzeczy do oddania.

- **Bez programisty i bez zamówienia.** AI pisze wtyczkę, administrator ją publikuje.

<!--
Notatki: to jest hasło „Rośnie razem z Twoimi potrzebami” w praktyce. Sprawne meble lądują przy śmietniku, choć sąsiad
chętnie by je wziął. Administrator opisuje obie funkcje własnymi słowami. Nic nowego do instalowania i uczenia się: to
samo konto, te same powiadomienia, ten sam pulpit.
Ostrzeżenie dostają tylko mieszkańcy w promieniu np. 500 m (zapisane miejsce albo pozycja z otwartej aplikacji z ostatnich
30 minut), a wtyczka nie zna niczyjej lokalizacji: dopasowuje ją serwer. Następny slajd: to samo w skali miasta.
Bez liczb, których nie zmierzyliśmy.
-->

---

<!-- _class: flow -->

## Przykład: Kraków

# Potrzeby mieszkańców zmieniają się szybciej niż narzędzia miasta

1. **Dziś** Zgłoszenia usterek, ogłoszenia urzędu, dyskusje.
2. **Nowa potrzeba** Remont, objazd, brak wody. Komunikat nie trafia do tych, których dotyczy.
3. **Urząd opisuje** „Utrudnienia w okolicy”.
4. **Mieszkańcy dostają** mapę utrudnień i powiadomienie tylko o tych w swojej okolicy.

- **Wtyczka nie zna niczyjego adresu.** Okolicę dopasowuje serwer.

<!--
Notatki: ta sama droga co w spółdzielni, tylko skala inna. W spółdzielni ostrzeżenie dotyczy prawie wszystkich, w mieście
powiadomienie dla wszystkich byłoby spamem, więc dostaje je tylko okolica utrudnienia.
Urząd zaznacza na mapie obszar (np. ulicę w remoncie albo rejon bez wody), a powiadomienie dostają mieszkańcy z zapisanym
adresem albo niedawną pozycją w tym promieniu. Adresy mieszkańcy dodają sami w koncie („adresy do powiadomień w okolicy”).
SDK ma do tego gotowe elementy: obszary na mapie (`ui.map.areas`) i powiadomienia „w pobliżu” (promień do 50 km).
Tej wtyczki nie przygotowaliśmy na demo: to przykład opisu dla generatora, nie gotowa funkcja.
-->

---

<!-- _class: places -->

## Od miasta po dom

# Każde miejsce włącza swoje funkcje

- **Miasto**
  - Zgłoszenia usterek
  - Utrudnienia w okolicy
  - Budżet obywatelski
  - Konsultacje społeczne
- **Uczelnia**
  - Rezerwacja sal
  - Ogłoszenia dziekanatu
  - Zmiany w planie zajęć
  - Rzeczy znalezione
- **Spółdzielnia mieszkaniowa**
  - Uwaga, dzik!
  - Oddam za darmo
  - Odczyty liczników
  - Usterki w bloku
- **Dom**
  - Lista zakupów
  - Grafik sprzątania
  - Wspólne wydatki
  - Kalendarz rodziny

**Zgłoszenia, ogłoszenia i dyskusje działają w demo.** Resztę administrator opisuje, a AI pisze.

<!--
Notatki: ta sama aplikacja i ten sam generator od całego miasta po jedno mieszkanie; zmienia się tylko zestaw wtyczek.
Wbudowane wtyczki to zgłoszenia usterek, ogłoszenia i dyskusje. Pozostałe funkcje to przykłady opisów dla generatora:
nie przygotowaliśmy ich na demo (ROADMAP.md). Budżet obywatelski wymaga weryfikacji mieszkańców (mObywatel, v2).
-->

---

<!-- _class: flow -->

## Innowacja

# Brakuje funkcji? Administrator opisuje ją jednym zdaniem

1. **Opis** po polsku
2. **AI pisze** wtyczkę
3. **Sprawdzenie** automatyczne
4. **Szkic** dla administratorów
5. **Publikacja** u mieszkańców

- **Bez aktualizacji w sklepach i bez restartu serwera.**
- **Zmiany też jednym zdaniem:** „dodaj zdjęcie”.

<!--
Notatki: najważniejszy slajd (kryterium „pomysł”, 30%). Najlepiej pokazać na żywo, w Spółdzielni Słonecznej (pierwszy
przykład): „Uwaga, dzik!: mieszkaniec zgłasza dzika ze zdjęciem i miejscem na mapie, a sąsiedzi w promieniu 500 m
dostają ostrzeżenie.” Drugi telefon (konto mieszkańca z zapisanym miejscem przy osiedlu) pokazuje ostrzeżenie.
Nowy widżet pojawia się na otwartych telefonach w ciągu kilkunastu sekund (pulpit odświeża się co 15 s). Zmiana
(„dodaj zdjęcie”) tworzy nową wersję, a dane wtyczki zostają.
Uwaga: napisanie wersji przez AI trwa dłużej (limit 5 minut), więc na demo przygotować wtyczkę wcześniej albo zagadać czas.
-->

---

<!-- _footer: "Bun · Hono · SurrealDB · Expo (React Native) · Strands Agents · TypeScript" -->

## Technologia

# Wtyczki + Server-Driven UI

| Wtyczka na serwerze | Aplikacja na telefonie |
| --- | --- |
| Jeden plik TypeScript, tylko SDK | Rysuje ekrany opisane przez serwer |
| Własne tabele w każdym miejscu | 36 elementów UI: formularze, mapa, galeria… |
| Akcje z walidacją (Zod) | Nowa funkcja bez nowej wersji aplikacji |

### Kod od AI przechodzi te same bramki co każda wtyczka.

*Składnia → importy → typy → safety → wczytanie → schemat bazy*

<!--
Notatki: serwer przysyła opis ekranu, a aplikacja go rysuje. Dlatego wtyczka napisana przez AI działa od razu na iOS,
Androidzie i w przeglądarce. Wtyczka ma widoki, widżety i akcje; jej tabele są osobne dla każdego miejsca.
Samo połączenie wtyczek i Server-Driven UI jest znane (np. aplikacje Slacka). Nowe jest to, że na tym fundamencie
AI pisze funkcje bezpiecznie: pisze tylko kod serwera przeciw wąskiemu SDK, nigdy kod aplikacji.
Bramki: wtyczka widzi tylko `ctx` (bez dostępu do bazy aplikacji, dysku, sieci i lokalizacji mieszkańców); dane każdej
instalacji są odizolowane; błędy wracają do agenta AI, który poprawia kod (najwyżej 3 sprawdzenia na wersję); niezgodna
zmiana tabel odrzuca nową wersję, a poprzednia działa dalej.
Pytanie jury „a jeśli AI napisze coś złośliwego?”: safety to statyczny strażnik, nie sandbox; kontrakt wtyczki jest gotowy
na Worker/WASM i to jest v2 (ROADMAP.md).
-->

---

<!-- _class: lead -->
<!-- _paginate: false -->
<!-- _footer: "" -->

![w:96](apps/app/assets/brand-tile.svg)

# Twoje Miejsce. Rośnie razem z Twoimi potrzebami.

**Twój Team**

Karol Jażdrzyk · Marcin Niemczyk · Dawid Danieluk

<!--
Notatki: zakończyć hasłem.
-->
