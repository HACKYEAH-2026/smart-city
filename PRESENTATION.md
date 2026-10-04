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
    color: #E50101;
    margin: 0 0 8px;
  }
  h3 {
    font-size: 32px;
    font-weight: 600;
    color: #E50101;
    margin: 28px 0 0;
  }
  strong { color: #1B1B1F; font-weight: 600; }
  em { color: #5E5E66; }
  ul, ol { padding-left: 1.1em; margin: 0; }
  li { margin: 0.35em 0; }
  li::marker { color: #E50101; font-weight: 600; }
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
    display: block;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 600;
    font-size: 22px;
    color: #E50101;
    margin-bottom: 4px;
  }
  section.flow ol li strong { display: block; font-size: 21px; margin-bottom: 2px; }
  section.flow ul { font-size: 23px; }
  /* Title and closing slides: the brand red. */
  section.lead {
    display: flex;
    flex-direction: column;
    justify-content: center;
    background: #E50101;
    color: #FFFFFF;
  }
  section.lead h1 { color: #FFFFFF; font-size: 72px; margin: 18px 0 10px; }
  section.lead h2 {
    font-family: 'Schibsted Grotesk', sans-serif;
    text-transform: none;
    letter-spacing: 0;
    font-weight: 500;
    font-size: 36px;
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

![w:120](apps/app/assets/icon.png)

# Twoje Miejsce

## Rośnie razem z Twoimi potrzebami.

Cyfrowe społeczności dla prawdziwych miejsc: miasta, uczelni, osiedla.

**HackYeah 2026 · SMART CITY · [nazwa zespołu]**

<!--
Notatki: jedno zdanie o tym, czym jest Twoje Miejsce, i od razu przejście do problemu. Hasło pada tu i na końcu.
-->

---

## Problem

# Lokalne sprawy giną w grupach i formularzach

*Latarnia, która nie świeci. Dziura w chodniku. Ogłoszenie, którego nikt nie zobaczył.*

- **Grupy na Facebooku:** boty, anonimy i chaos. Zgłoszenie znika w wątku, a urząd nie ma tam porządku ani kanału odpowiedzi.
- **Oficjalne systemy miasta** rzadko dają mieszkańcom wygodny kanał kontaktu.
- **Każda nowa usługa to osobny projekt:** zamówienie, budowa, kolejna aplikacja albo formularz.
- **Miasto, uczelnia i spółdzielnia** mają inne sprawy, a dostają te same narzędzia albo żadne.

<!--
Notatki: bez liczb (PRODUCT.md: żadnych wymyślonych danych). Konkretny przykład z Krakowa, jeśli ktoś z zespołu go ma.
-->

---

<!-- _class: shot -->

> 📸 Zrzut: pulpit Krakowa z widżetami wtyczek i przełącznikiem miejsc

## Rozwiązanie

# Jedna aplikacja, która dopasowuje się do miejsca

- **Każde miejsce ma swoją społeczność:** miasto, dzielnica, uczelnia, spółdzielnia.
- **Funkcje to wtyczki.** Miejsce włącza tylko to, czego potrzebuje, a administrator układa pulpit mieszkańców.
- **Jedno konto, wiele miejsc.** Mieszkanka Krakowa należy też do kampusu i spółdzielni i przełącza się między nimi.
- **iOS, Android i przeglądarka** z jednej bazy kodu.

<!--
Notatki: w demo konto anna@krakow.test należy do czterech miejsc: Kraków, Tauron Arena Kraków, Kampus Główny,
Spółdzielnia Słoneczna.
-->

---

<!-- _class: shot -->

> 📸 Zrzut: nowe zgłoszenie ze zdjęciem i miejscem na mapie, obok arkusz „Czy to ten sam problem?”

## Dla mieszkańca

# Usterkę zgłaszasz zdjęciem

1. **Zdjęcie i miejsce na mapie,** tytuł i krótki opis. Anonimowo, jeśli miejsce na to pozwala.
2. **AI sprawdza, czy ktoś już to zgłosił.** Jeśli tak, pyta „Czy to ten sam problem?”, a Ty dołączasz do zgłoszenia zamiast tworzyć nowe.
3. **Podbijasz i komentujesz** zgłoszenia innych mieszkańców.
4. **Dostajesz powiadomienie push,** gdy urząd odpowie albo zamknie zgłoszenie.

<!--
Notatki: to jest kryterium „użyteczność”. Pokazać, że cała ścieżka to kilka dotknięć, bez logowania do osobnego systemu miasta.
-->

---

<!-- _class: shot -->

> 📸 Zrzut: panel administratora zgłoszeń z kategorią i odpowiedzią urzędu

## Dla urzędu

# Jedno zgłoszenie zamiast wielu takich samych

- **Powtórzone zgłoszenia łączą się w jedno,** a urząd widzi, ilu mieszkańców dotyczy sprawa.
- **AI przypisuje kategorię** (drogi i chodniki, oświetlenie, czystość, zieleń). Urząd może ją zmienić.
- **Odpowiedź dla mieszkańców i notatka wewnętrzna.** Zamknięcie zgłoszenia powiadamia autora i osoby, które dołączyły.
- **Ogłoszenia i dyskusje** w tym samym miejscu.
- **Ustawienia miejsca:** głosowanie, komentarze, widoczność, zgłoszenia anonimowe, wymagane zdjęcie.

<!--
Notatki: to jest kryterium „związek z kategorią SMART CITY”. Mniej duplikatów to mniej pracy urzędu; mieszkaniec widzi odpowiedź zamiast ciszy.
-->

---

<!-- _class: flow -->

## Przykład: Spółdzielnia Słoneczna

# Nowa potrzeba to nowa funkcja, nie nowa aplikacja

1. **Dziś** Mieszkańcy zgłaszają usterki, czytają ogłoszenia administracji i rozmawiają w dyskusjach.
2. **Nowa potrzeba** Na osiedle przychodzą dziki. Sprawne meble lądują przy śmietniku, choć sąsiad chętnie by je wziął.
3. **Administrator opisuje** dwie funkcje własnymi słowami: „Uwaga, dzik!” i „Oddam za darmo”.
4. **Mieszkańcy dostają** ostrzeżenie, gdy dzik jest w pobliżu, i tablicę rzeczy do oddania.

- **Nic nowego do instalowania i uczenia się.** To samo konto, te same powiadomienia, ten sam pulpit.
- **Bez programisty i bez zamówienia.** AI pisze wtyczkę, a administrator ją sprawdza i publikuje.

<!--
Notatki: to jest hasło „Rośnie razem z Twoimi potrzebami” w praktyce, a następny slajd pokazuje, jak to działa.
Ostrzeżenie dostają tylko mieszkańcy w promieniu np. 500 m (zapisane miejsce albo pozycja z otwartej aplikacji z ostatnich
30 minut), a wtyczka nie zna niczyjej lokalizacji: dopasowuje ją serwer. To samo działa w skali miasta: Kraków może
włączyć „Uwaga, dzik!” dla wszystkich mieszkańców. Bez liczb, których nie zmierzyliśmy.
-->

---

<!-- _class: flow -->

## Innowacja

# Brakuje funkcji? Administrator opisuje ją jednym zdaniem

1. **Opis** po polsku, własnymi słowami
2. **AI pisze** wtyczkę
3. **Sprawdzenie** kodu, automatycznie
4. **Szkic** widzą tylko administratorzy
5. **Publikacja** i działa u mieszkańców

- **Bez aktualizacji w sklepach i bez restartu serwera.** Nowy widżet pojawia się na otwartych telefonach w ciągu kilkunastu sekund.
- **Zmiany też jednym zdaniem:** „dodaj zdjęcie” tworzy nową wersję, a dane wtyczki zostają.

<!--
Notatki: najważniejszy slajd (kryterium „pomysł”, 30%). Najlepiej pokazać na żywo, w Spółdzielni Słonecznej z poprzedniego
slajdu: „Uwaga, dzik!: mieszkaniec zgłasza dzika ze zdjęciem i miejscem na mapie, a sąsiedzi w promieniu 500 m dostają
ostrzeżenie.” Drugi telefon (konto mieszkańca z zapisanym miejscem przy osiedlu) pokazuje ostrzeżenie.
„Kilkanaście sekund”: pulpit odświeża się co 15 s.
Uwaga: napisanie wersji przez AI trwa dłużej (limit 5 minut), więc na demo przygotować wtyczkę wcześniej albo zagadać czas.
-->

---

<!-- _footer: "Bun · Hono · SurrealDB · Expo (React Native) · Strands Agents · TypeScript" -->

## Technologia

# Wtyczki + Server-Driven UI

| Wtyczka na serwerze | Aplikacja na telefonie |
| --- | --- |
| Jeden plik TypeScript, zależny tylko od SDK | Rysuje ekrany, które opisuje serwer |
| Własne tabele, osobne dla każdego miejsca | Katalog 34 elementów UI: formularze, mapa, galeria… |
| Widoki, widżety i akcje z walidacją (Zod) | Nowa funkcja bez nowej wersji aplikacji |

Serwer przysyła opis ekranu, a aplikacja go rysuje. Dlatego wtyczka napisana przez AI działa od razu na iOS, Androidzie i w przeglądarce.

### Kod od AI przechodzi te same bramki co każda wtyczka, więc działa.

*Składnia → importy → typy → safety → wczytanie → schemat bazy*

<!--
Notatki: samo połączenie wtyczek i Server-Driven UI jest znane (np. aplikacje Slacka). Nowe jest to, że na tym fundamencie
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

![w:96](apps/app/assets/icon.png)

# Twoje Miejsce. Rośnie razem z Twoimi potrzebami.

**[nazwa zespołu] · [członkowie zespołu]**

github.com/HACKYEAH-2026/smart-city

<!--
Notatki: zakończyć hasłem. Link do repozytorium tylko, jeśli będzie publiczne na czas oceny.
-->
