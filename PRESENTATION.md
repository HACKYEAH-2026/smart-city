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
  /* A slide with one claim and a few short points: larger text, more air. */
  section.statement ul { font-size: 32px; margin-top: 12px; }
  section.statement li { margin: 0.55em 0; }
  section.statement h3 { margin-top: 44px; }
  /* Next to the phones the text column is narrower. */
  section.statement.phones h1, section.statement.phone h1 { font-size: 42px; }
  section.statement.phones ul, section.statement.phone ul { font-size: 26px; }
  section.statement.phones h3, section.statement.phone h3 { font-size: 28px; margin-top: 32px; }
  /* Two phones with real app screens on the right (class "phones"): the slide's first image is the back phone,
     the second the front one. Both images go on one line, so they share a paragraph. */
  section.phones {
    /* Keeps the text clear of the phones, which are positioned absolutely. */
    padding-right: 620px;
  }
  /* The image is the screen; its border is the device body. The soft shadows are filter: drop-shadow, not a blurred
     box-shadow: Chrome prints a blurred box-shadow into the PDF as a grey box in Preview and Acrobat. */
  section.phones img {
    position: absolute;
    box-sizing: content-box;
    border: 11px solid #F6F6F6;
    border-radius: 46px;
    background: #F6F6F6;
    object-fit: cover;
  }
  section.phones img:first-of-type {
    top: 100px;
    left: 690px;
    width: 236px;
    height: 511px;
    box-shadow: 0 0 0 1.5px #E4E4E4;
    filter: drop-shadow(-70px 40px 110px rgba(27, 27, 31, 0.16));
  }
  section.phones img:last-of-type {
    top: 52px;
    right: 100px;
    width: 268px;
    height: 580px;
    box-shadow: 0 0 0 1.5px #E4E4E4;
    filter: drop-shadow(-60px 40px 90px rgba(27, 27, 31, 0.28));
  }
  /* 3px shorter than the screenshot's ratio: cover + bottom crops the dark line the video leaves at its top. */
  section.phones img[src$="login.png"] { height: 508px; object-position: bottom; }
  /* One large phone on the right, centred on the slide's middle (class "phone"). */
  section.phone { padding-right: 560px; }
  section.phone img, section.phone blockquote {
    position: absolute;
    top: 57px;
    right: 133px;
    width: 268px;
    height: 580px;
    box-sizing: content-box;
    border: 13px solid #F6F6F6;
    border-radius: 50px;
  }
  section.phone img {
    background: #F6F6F6;
    object-fit: cover;
    box-shadow: 0 0 0 1.5px #E4E4E4;
    filter: drop-shadow(-80px 40px 120px rgba(27, 27, 31, 0.3));
  }
  /* The screenshot slot until the screenshot exists: the phone's outline, dashed. */
  section.phone blockquote { box-sizing: border-box; width: 294px; height: 606px; border: 2px dashed #D3CEC2; }
  /* Tilted like a phone in hand, next to a heading and a short paragraph (class "tilt", with "phone").
     Rotated by 8deg, the phone's outline spans y 40-680, clear of the slide's edges. */
  section.tilt { justify-content: center; }
  section.tilt h1 { font-size: 46px; margin-bottom: 20px; }
  section.tilt p { font-size: 27px; color: #3E3E46; margin: 0; }
  section.tilt img { transform: rotate(8deg); }
  /* Title slide: the name on the left of the phones. */
  section.title {
    justify-content: center;
    background: #FFFFFF;
    padding-left: 84px;
  }
  section.title p { font-size: 26px; color: #6E6E76; margin: 0; }
  section.title p:first-of-type { margin-bottom: 4px; }
  section.title h1 { font-size: 80px; line-height: 1.05; letter-spacing: -0.02em; margin: 0 0 14px; }
  section.title h2 {
    font-family: 'Schibsted Grotesk', sans-serif;
    text-transform: none;
    letter-spacing: 0;
    font-weight: 500;
    font-size: 30px;
    color: #3E3E46;
    margin: 0 0 30px;
  }
---

<!-- _class: title phones -->
<!-- _paginate: false -->
<!-- _footer: "" -->

Twój Team prezentuje

# Twoje Miejsce

## Rośnie razem z Twoimi potrzebami.

HackYeah 2026 · SMART CITY

![Ekran logowania](docs/presentation/login.png) ![Pulpit Krakowa](docs/presentation/dashboard.png)

<!--
Notatki: jedno zdanie o tym, czym jest Twoje Miejsce (cyfrowe społeczności dla prawdziwych miejsc: miasta, uczelni,
osiedla), i od razu przejście do problemu. Hasło pada tu. Na telefonach: ekran logowania i pulpit Krakowa
z konta anna@krakow.test.
-->

---

<!-- _class: statement -->

## Problem

# Potrzeby mieszkańców zmieniają się szybciej niż narzędzia miasta

- **Nowa usługa** to nowy projekt i kolejna aplikacja
- **Krótkie, lokalne potrzeby** zostają bez narzędzia
- **Mieszkańcy** radzą sobie sami na Facebooku

### Luka między potrzebą a narzędziem.

<!--
Notatki: to slajd o mechanizmie, nie o jednym przypadku. Rozwinięcie punktów na głos:
- Nowa usługa: analiza, zamówienie, wykonawca, kolejna aplikacja albo formularz. Zanim trafi do mieszkańców, potrzeba
  bywa już inna.
- Krótkie, lokalne potrzeby: jedno osiedle, jeden tydzień, jedna sytuacja. Nie opłaca się dla nich nic budować.
- Facebook: bez porządku, bez odpowiedzi urzędu i bez pewności, kto jest kim.
Ilustracja: powódź 2024. Do Trzebieszowic (154 zalane budynki) przyjechało 500 wolontariuszy, a sołtys mówił „ja jestem
sam i nie ogarniam wszystkiego”; w bocznych uliczkach Kłodzka „ludzie są pozostawieni sami sobie”, a pomoc organizowano
w grupach na Facebooku (Interia, „Pomocowy chaos. Tam ludzie są pozostawieni sami sobie”, wrzesień 2024). Liczby tylko
te ze źródeł (PRODUCT.md: żadnych wymyślonych danych).
-->

---

<!-- _class: statement phones -->

## Rozwiązanie

# Jedna aplikacja, która dopasowuje się do miejsca

- **Nowa funkcja** to rozszerzenie, nie aplikacja
- **Każde miejsce** włącza tylko to, czego potrzebuje
- **Jedno konto:** miasto, osiedle, uczelnia

### Brakuje funkcji? Wystarczy ją opisać.

![Zarządzaj miejscem: rozszerzenia Krakowa i Dodaj rozszerzenie](docs/presentation/manage.png) ![Przełącznik miejsc](docs/presentation/switcher.png)

<!--
Notatki: każdy punkt odpowiada na punkt z poprzedniego slajdu. Rozwinięcie na głos:
- Rozszerzenie: zgłoszenia, ogłoszenia i dyskusje na pulpicie Krakowa to trzy rozszerzenia. Nowa funkcja trafia do
  aplikacji, którą mieszkańcy już mają, bez aktualizacji w sklepie.
- Każde miejsce: administrator włącza rozszerzenia i układa pulpit mieszkańców (lewy telefon: „Zarządzaj miejscem”,
  rozszerzenia Krakowa i „Dodaj rozszerzenie”).
- Jedno konto: w demo anna@krakow.test należy do czterech miejsc (Kraków, Tauron Arena Kraków, Kampus Główny,
  Spółdzielnia Słoneczna) i przełącza się między nimi. iOS, Android i przeglądarka z jednej bazy kodu.
Ostatnie zdanie zapowiada slajd „Innowacja”.
-->

---

<!-- _class: phone tilt -->

## Innowacja

# Opisujesz funkcję, AI tworzy ją dla Ciebie

Jej kod przechodzi automatyczne sprawdzenie. Szkic widzą tylko administratorzy: przeglądasz go i publikujesz, a funkcja trafia do mieszkańców bez aktualizacji aplikacji.

![Rozszerzenie z AI: prośba „Uwaga, dzik!”](docs/presentation/builder.png)

<!--
Notatki: najważniejszy slajd (kryterium „pomysł”, 30%). Na zrzucie administrator Krakowa wpisuje prośbę: „Uwaga, dzik!:
mieszkaniec zgłasza dzika ze zdjęciem i miejscem na mapie, a sąsiedzi w promieniu 500 m dostają ostrzeżenie.”
Kroki: opis po polsku → AI pisze rozszerzenie → automatyczne sprawdzenie kodu → szkic widzą tylko administratorzy →
publikacja. Bez aktualizacji w sklepach i bez restartu serwera: nowy widżet pojawia się na otwartych telefonach w ciągu
kilkunastu sekund (pulpit odświeża się co 15 s). Zmiany też jednym zdaniem: „dodaj zdjęcie” tworzy nową wersję, a dane
rozszerzenia zostają.
Napisanie wersji przez AI trwa dłużej (limit 5 minut). Proponowany plan demo: wersja „Uwaga, dzik!” wygenerowana
wcześniej; na żywo wpisujemy prośbę, przechodzimy do gotowego szkicu, publikujemy, a drugi telefon (konto mieszkańca
z zapisanym miejscem w pobliżu) pokazuje ostrzeżenie.
-->

---

<!-- _class: statement phone -->

## Efekt

# Kilkanaście sekund później działa u mieszkańców

- **Nowy widżet** na pulpicie, bez aktualizacji aplikacji
- **Mieszkaniec zgłasza** dzika ze zdjęciem i miejscem
- **Sąsiedzi w promieniu 500 m** dostają ostrzeżenie

### Rozszerzenie nie zna niczyjej lokalizacji.

![Uwaga, dzik!: zgłoszenie z mapą i strefą ostrzeżenia 500 m](docs/presentation/boar-sighting.png)

<!--
Notatki: to wynik prośby ze slajdu „Innowacja”. Na zrzucie: zgłoszenie dzika z mapą i strefą ostrzeżenia 500 m, tak jak
widzi je mieszkanka (anna@krakow.test). Uczciwie: rozszerzenie na zrzucie (plugins/boars) napisał zespół, jako przykład
tego, co powstaje z takiej prośby; działa na tym samym SDK i przeszło te same automatyczne sprawdzenia co kod od AI.
Rozwinięcie na głos:
- „Kilkanaście sekund”: otwarty pulpit odświeża się co 15 s, więc nowy widżet pojawia się bez aktualizacji w sklepie
  i bez restartu serwera.
- Ostrzeżenie dostają mieszkańcy z zapisanym miejscem w promieniu 500 m albo z pozycją udostępnioną w ciągu ostatnich
  30 minut. Dopasowuje ich serwer: rozszerzenie nie wie, kto mieszka gdzie, ani nawet ilu osobom poszło ostrzeżenie.
- To samo działa w skali miasta i w każdym innym miejscu: Kraków, osiedle, kampus.
-->

---

<!-- _class: statement phones -->

## Dla mieszkańca

# Usterkę zgłaszasz zdjęciem

- **Zdjęcie i pinezka** na mapie
- **AI pyta:** „Czy to ten sam problem?”
- **Powiadomienie,** gdy urząd odpowie

### Zgłoszenia to tylko jedno z rozszerzeń.

![Nowe zgłoszenie ze zdjęciem i miejscem na mapie](docs/presentation/report.png) ![Czy to ten sam problem?](docs/presentation/duplicate.png)

<!--
Notatki: to jest kryterium „użyteczność”. Cała ścieżka to kilka dotknięć, bez logowania do osobnego systemu miasta.
Rozwinięcie na głos:
- Zdjęcie (do 3), tytuł, opis i miejsce na mapie. Anonimowo, jeśli miejsce na to pozwala.
- Przed zapisem AI szuka tego samego problemu wśród aktywnych zgłoszeń. Jeśli go znajdzie, mieszkaniec dołącza:
  jego zdjęcia, głos i obserwowanie trafiają do wcześniejszego zgłoszenia, zamiast tworzyć nowe. Bez klucza AI (np. na
  lokalnym demo) dopasowanie działa po wspólnych słowach.
- Mieszkańcy podbijają i komentują zgłoszenia. Gdy urząd odpowie albo zamknie zgłoszenie, autor i osoby, które
  dołączyły, dostają powiadomienie (push na telefonie).
Ostatnie zdanie wraca do slajdu 3: to przykład rozszerzenia, nie cały produkt.
-->

---

<!-- _class: statement phone -->

> Zrzut: panel administratora zgłoszeń z kategorią i odpowiedzią urzędu

## Dla urzędu

# Jedno zgłoszenie zamiast wielu takich samych

- **Takie same zgłoszenia** łączą się w jedno
- **AI nadaje kategorię,** urząd może ją zmienić
- **Odpowiedź dociera** do każdego, kto zgłosił

### Urząd widzi, ilu mieszkańców dotyczy sprawa.

<!--
Notatki: to jest kryterium „związek z kategorią SMART CITY”. Mniej duplikatów to mniej pracy urzędu; mieszkaniec widzi
odpowiedź zamiast ciszy. Rozwinięcie na głos:
- Kategorie: drogi i chodniki, oświetlenie, czystość, zieleń.
- Urząd pisze odpowiedź dla mieszkańców i notatkę wewnętrzną. Zamknięcie zgłoszenia powiadamia autora i osoby, które
  dołączyły.
- W tym samym miejscu ogłoszenia i dyskusje.
- Ustawienia miejsca: głosowanie, komentarze, widoczność, zgłoszenia anonimowe, wymagane zdjęcie.
-->

---

<!-- _class: flow -->

## Przykład: Spółdzielnia Słoneczna

# Nowa potrzeba to nowa funkcja, nie nowa aplikacja

1. **Dziś** Usterki, ogłoszenia, dyskusje.
2. **Nowa potrzeba** Dziki na osiedlu. Dobre meble przy śmietniku.
3. **Administrator opisuje** „Uwaga, dzik!” i „Oddam za darmo”.
4. **Mieszkańcy dostają** ostrzeżenie o dziku w pobliżu i tablicę rzeczy do oddania.

- **Bez programisty i bez zamówienia.** AI pisze rozszerzenie, administrator je publikuje.

<!--
Notatki: to jest hasło „Rośnie razem z Twoimi potrzebami” w praktyce; jak to działa, pokazał slajd „Innowacja”.
Sprawne meble lądują przy śmietniku, choć sąsiad chętnie by je wziął. Administrator opisuje obie funkcje własnymi
słowami. Nic nowego do instalowania i uczenia się: to samo konto, te same powiadomienia, ten sam pulpit.
Ostrzeżenie dostają tylko mieszkańcy w promieniu np. 500 m (zapisane miejsce albo pozycja z otwartej aplikacji z ostatnich
30 minut), a rozszerzenie nie zna niczyjej lokalizacji: dopasowuje ją serwer. Następny slajd: to samo w skali miasta.
Bez liczb, których nie zmierzyliśmy.
-->

---

<!-- _class: flow -->

## Przykład: Kraków

# Komunikat trafia tylko do tych, których dotyczy

1. **Dziś** Zgłoszenia usterek, ogłoszenia urzędu, dyskusje.
2. **Nowa potrzeba** Remont, objazd, brak wody.
3. **Urząd opisuje** „Utrudnienia w okolicy”.
4. **Mieszkańcy dostają** mapę utrudnień i powiadomienie tylko o tych w swojej okolicy.

- **Rozszerzenie nie zna niczyjego adresu.** Okolicę dopasowuje serwer.

<!--
Notatki: ta sama droga co w spółdzielni, tylko skala inna. W spółdzielni ostrzeżenie dotyczy prawie wszystkich, w mieście
powiadomienie dla wszystkich byłoby spamem, więc dostaje je tylko okolica utrudnienia.
Urząd zaznacza na mapie obszar (np. ulicę w remoncie albo rejon bez wody), a powiadomienie dostają mieszkańcy z zapisanym
adresem albo niedawną pozycją w tym promieniu. Adresy mieszkańcy dodają sami w koncie („adresy do powiadomień w okolicy”).
SDK ma do tego gotowe elementy: obszary na mapie (`ui.map.areas`) i powiadomienia „w pobliżu” (promień do 50 km).
Tego rozszerzenia nie przygotowaliśmy na demo: to przykład opisu dla generatora, nie gotowa funkcja.
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
Notatki: ta sama aplikacja i ten sam generator od całego miasta po jedno mieszkanie; zmienia się tylko zestaw rozszerzeń.
Wbudowane rozszerzenia to zgłoszenia usterek, ogłoszenia i dyskusje. Pozostałe funkcje to przykłady opisów dla
generatora: nie przygotowaliśmy ich na demo (ROADMAP.md). Budżet obywatelski wymaga weryfikacji mieszkańców (mObywatel, v2).
-->
