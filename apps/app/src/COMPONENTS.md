> **Note:** this file is the design spec; the implemented components are the exports of `src/components/index.ts`.
> Built under another name: ScreenHeader (step variant) → `StepHeader`, ScreenHeader (title variant) → `TitleHeader`, back in a header → `BackButton`, StepProgress → `SegmentedProgress`,
> Checkbox / Switch → `Checkbox` + `SwitchRow`, RoleBadge → `Badge`, Label → `Text variant="label"`,
> QR / kod miejsca → `InviteCodeCard` + `QrCode`, WidgetGrid → `src/plugins/Dashboard.tsx`. Drawn inline in screens
> (no component): PlaceAvatar, InviteCard, DashboardHeader, EmptyStateCard, GroupedList / ListRow,
> KeyValueRow, CountBadge (in plugin rows: `src/plugins/CardRow.tsx`). Not implemented: CtaCard, the A4 printout.

# Twoje Miejsce — specyfikacja komponentów (React Native)

## Issues design alignment (2026-10-04)

- Plugin section labels and screen eyebrows use `sectionLabel`: Barlow Condensed 600, 14/18, uppercase.
- `TextField`: section label; `hideLabel` keeps the accessible name, `variant="pill"` is a 44 dp composer input,
  `variant="muted"` has a muted surface and dashed border.
- `SegmentedControl`: 48 dp track (4 dp padding), 40 dp segments.
- `SwitchRow`: semantic switch row with a drawn 52×32 dp track and white 26 dp knob on every platform.
- Dashboard grid unit: 96 dp, gap 12; 3×2 = 204 dp, 3×3 = 312 dp. Widget header: neutral 15 dp icon,
  gray 13 px title, 14/16 dp padding, light card shadow, compact 32 dp rows, dark 44 dp CTA.
- Plugin FAB: 32 dp above the safe bottom inset, `shadows.redGlow`. List cards: gap 10 dp.
- Plugin comments: 32 dp avatar outside a compact white bubble; inline composer uses a circular 44 dp send button.
- Plugin location field: bordered card, 72 dp map preview, pin/address and accent change link.
- `SuccessMark large`: 72 dp red circle, 92 dp ring and 34 dp check; plugin Hero uses a centered 28 px title.
- Plugin sheets: sentence-case red eyebrow with sparkle, lighter 0.4 backdrop and 10 dp content gaps.

Źródło: projekt „E · Czerwień" (17 ekranów); akcent to gradient `gradients.accent` (#D81B60 → #F2545B, po przekątnej), a `colors.primary` (#D81B60) to jego pierwszy kolor. Wszystkie wartości pochodzą z `src/theme/tokens.ts`
(`colors.*`, `spacing.*`, `radii.*`, `sizes.*`, `typography.*`, `shadows.*`). Nazwy tokenów podane w nawiasach.
Piksele z projektu = dp w RN (1:1).

---

## Podstawy

### Text ✅ (`src/components/Text.tsx`)

Props: `variant` (klucz `typography`), `color` (klucz `colors`). Warianty etykiet (`label`, `labelL`, `labelHero`, `chip`, `stepNumber`, `abbr`) są automatycznie WIELKIMI LITERAMI.

### Icon

Biblioteka: **`lucide-react-native`** (ikony w projekcie mają styl Lucide) + `react-native-svg`.
Domyślnie `size=20–22`, `strokeWidth=1.8` (nawigacja/akcje: 2, mały chevron w kółku: 2.6). `color` z tokenów.
Mapowanie: pin miejsca → `MapPin` · QR → `QrCode` · kod → `Keyboard` · link → `Link` · zaproszenia/zaproś → `UserPlus` · powiadomienia → `Bell` · wstecz → `ChevronLeft` · dalej → `ChevronRight` · rozwiń → `ChevronDown` · zamknij → `X` · dodaj → `Plus` · pulpit → `LayoutDashboard` · konto → `User` · latarka → `Flashlight` · wklej → `ClipboardPaste` · administrator → `ShieldCheck` · ustawienia → `Settings` · typy miejsc: Osiedle `Home`, Budynek `Building2`, Firma `Briefcase`, Szkoła `GraduationCap`, Dzielnica `Map`, Inne `MoreHorizontal`.

### Brand ✅ (`src/components/Brand.tsx`, `BrandMark.tsx`)

Logo „Roofline M": dwa dachy rysują literę M (Miejsce), kropka między domami to „ty". Geometria tylko w `src/theme/brand.ts` (siatka 48); z niej powstają też ikona aplikacji i favicon (`bun scripts/icons.ts`). Wordmark: `BrandMark` 24 dp (`sizes.brandMark`, `primary`) + `Text variant="brand"`, gap 8. Z `href` cały wordmark jest linkiem (nagłówek). Lokalizacja w treści (pin miejsca) to nadal `MapPin`, nie logo.

### Button ✅ (`src/components/Button.tsx`)

Wariant `primary` wypełnia `AccentGradient` (gradient akcentu; w stanie wciśnięcia — `primaryPressed`). Duże powierzchnie akcentu (banner, pinezka, znacznik „Dodaj”, pływający przycisk, pasek postępu, wybrany IconBox) też używają `AccentGradient`; tekst, ikony, linie i kropki biorą `colors.primary`.

| Wariant            | Tło                                    | Tekst            | Użycie                                                |
| ------------------ | -------------------------------------- | ---------------- | ----------------------------------------------------- |
| `primary`          | `primary` (wciśnięty `primaryPressed`) | `onPrimary`      | główne CTA („Zaloguj się", „Dalej")                   |
| `secondary`        | `surface` + border `border` 1 px       | `text`           | „Odrzuć", Google/Apple, „Ustaw wybrane jako domyślne" |
| `tint`             | `background`                           | `text`           | „Pokaż kod QR" wewnątrz białej karty                  |
| `accent`           | `primaryTint`                          | `primaryPressed` | „Dodaj do miejsca" na karcie rozszerzenia (katalog)   |
| `dark`             | `text`                                 | `surface`        | okrągłe przyciski ikonowe admina (patrz IconButton)   |
| `onDark`           | `surface`                              | `text`           | skaner: „Symuluj rozpoznanie kodu"                    |
| `ghost`            | transparent                            | `text`           | „Przejdź do pulpitu"                                  |
| `destructiveGhost` | transparent                            | `primaryPressed` | „Usuń miejsce"                                        |
| `outline`          | `surface` + border `primary` 1 px      | `primary`        | przełącznik rozszerzenia niewciśnięty („Podbij")      |

Rozmiary: `lg` 54 dp / `typography.button` (CTA na dole ekranu) · `md` 50 dp (Google/Apple, `buttonM`) · `sm` 46 dp radius 12 (Odrzuć/Akceptuj, w karcie) · `xs` 40 dp radius 12 (`buttonS`, „Wygeneruj nowy").
Radius: lg/md → `radii.lg` (14), sm/xs → `radii.md` (12). Minimalny cel dotyku 44 dp (xs ma 40 — używać tylko z `hitSlop`).
Przycisk CTA zawsze przy dolnej krawędzi ekranu (spacer `flex:1` nad nim). Dwa przyciski obok siebie: grid 2 kolumny, gap 10.
Z `href` przycisk jest linkiem (`role="link"`, na webie `<a href>`) o tym samym wyglądzie, np. „Dodaj rozszerzenie" (`primary sm` z ikoną `Plus`).
Stany: pressed (każdy wariant ma tło `pressedBg` z tokenów: primary → `primaryPressed`, secondary/onDark/ghost → `surfaceSunken`, tint → `surfaceMuted`, accent → `primaryTintPressed`, dark → `textBody`, ghostOnDark → `onPrimaryOverlay`, destructiveGhost → `primaryTint`), disabled (`opacity.disabled`).

### IconButton

44×44 dp, ikona 20 dp. Warianty:

- `square` — radius 14, tło `surface`, border `borderSubtle` (przestawianie kafelków na pulpicie),
- `plain` — bez tła i obramowania, sama ikona; pole dotyku nadal 44×44 (wstecz/anuluj w nagłówkach ekranów i kroków, zamknij w BottomSheet; wariant sam wysuwa się o margines wokół ikony, więc ikona jest wyrównana do krawędzi treści),
- `round` — radius 22, tło `surface`, border `borderSubtle` (dzwonek powiadomień, awatar „JK" z inicjałami `typography.buttonS`),
- `roundDark` — radius 22, tło `text`, ikona `onPrimary` (zębatka admina w nagłówku ekranu rozszerzenia; `CountBadge` w rogu nie jest zaimplementowany),
- `roundOnDark` — radius 22, tło `onDarkOverlay`, ikona biała (skaner: zamknij, latarka),
- `roundSunken` — radius 22, tło `surfaceSunken` (zamknij na panelu: zaznaczony widżet w edytorze układu pulpitu, karta miejsca na mapie),
- `floating` — 44×44 radius 14, tło `surface`, `shadows.floating` (na mapie: „Moja lokalizacja”).
- **Wstecz nigdy nie ma tła** (ani `square`, ani `round`, ani `floating`), także nad mapą i zdjęciem: zawsze `BackButton` (`plain` + `ChevronLeft`, etykieta „Wróć”).
  Zawsze `accessibilityLabel` (np. „Wróć", „Powiadomienia").

### Label (eyebrow)

Etykieta pola i nagłówek sekcji: `Text variant="label" color="textSecondary"` (Schibsted Grotesk 600, 12, UPPERCASE, letterSpacing 0.72). Odstęp do pola: `spacing[3]` (6). Nagłówek sekcji (h2) ma dodatkowo opcjonalny `CountBadge` po prawej treści (gap 8) lub link „Wszyscy" po prawej stronie (`typography.link`, kolor `primary`). Dopisek „(opcjonalnie)" to ta sama czcionka bez uppercase, letterSpacing 0, weight 500.

### Link

`typography.link` (14/500) lub 15/600 w zdaniach („Zarejestruj się"), kolor `primary`, bez podkreślenia, wciśnięty `primaryPressed`.

---

## Formularze

### TextField

Wysokość 52, radius 14, tło `surface`, border 1 `border`, padding poziomy 16, tekst `typography.input`, kolor `text`, placeholder `placeholder`.
Fokus: border 2 `primary` + poświata 4 dp `focusRing` (RN: dodatkowy `View` pod polem lub `shadowColor primary, radius 4, opacity .10`); przy fokusie padding 15 (kompensacja grubszej ramki).
Struktura: `Label` → pole → opcjonalny `helper` (`typography.small`, `textSecondary`; prop `helper` w `TextField`). Wiersz label + link (np. „Nie pamiętasz hasła?") — `justifyContent: space-between`, `alignItems: baseline`.
Warianty: `email`, `password` (maska + przełącznik), `url` + przycisk „Wklej" (46–52 dp, secondary, tekst `primary`), `multiline` (textarea: min 3 wiersze, padding 14/16, lineHeight 21.75, bez resize).
Pole z mapą (Adres): kontener radius 14, border `border`, `overflow:hidden`; u góry wiersz 52 dp z polem i separatorem `divider`, pod nim blok mapy 120 dp `mapBase` z pływającym przyciskiem „Popraw pinezkę" (36 dp, radius 10, `shadows.floating`, right/bottom 10).

### OtpInput (kod zaproszeniowy 6 znaków: `ABC-DEF`)

6 komórek `flex:1`, wysokość 64, radius 14, `typography.otp`, wyśrodkowany znak, `maxLength 1`, gap 6; między 3. a 4. komórką kreska 10×2 dp `dot`.
Stany komórki: wypełniona/domyślna (tło `surface`, border 1 `border`, `shadows.card`) · aktywna (border 2 `primary` + poświata 4 dp `focusRingStrong`) · pusta nieaktywna (tło `surfaceDisabled`, border `borderEmpty`). Auto-przeskok do następnej, backspace cofa, obsługa wklejania całego kodu, uppercase. Pod spodem: tekst pomocniczy `small` (lewa) + akcja „Wklej kod" z ikoną `ClipboardPaste` (prawa; `typography.buttonS`, `primary`, wysokość 44).

### PasswordStrength

`SegmentedProgress` z 4 segmentami (gap 4); pod spodem podpowiedź `small` `textSecondary`.

### Checkbox / Switch

Zgoda (regulamin): checkbox 20 dp, kolor zaznaczenia `primary`, tekst `typography.caption` kolor `textBody` lineHeight ~20, linki `primary`, gap 12, wyrównanie do góry.
Wiersz przełącznika („Ustaw jako domyślne"): biała karta radius 16, padding 14/16, `shadows.card`, tytuł 15/600 (+ opcjonalny opis `small`), po prawej Switch 22 dp z `trackColor.true = primary` (użyj `Switch`). Cały wiersz dotykalny (`accessibilityRole="switch"`). `SwitchRow flush`: wiersz bez własnej karty, w białej grupie (ustawienia rozszerzenia); `disabled` (zapisywanie) przyciemnia go.

### SegmentedControl

Kontener: tło `surfaceSunken`, radius 14, padding 4, 2 kolumny. Segment: wysokość 44, radius 11, `buttonM`. Aktywny: tło `surface`, tekst `text`, cień (0 1 3 .12 — `shadows.floating` lżejszy); nieaktywny: transparent, tekst `textSecondary`. `accessibilityRole="tablist"` / `tab`; `kind="radio"` (wybór, który zostaje, np. ustawienie): `radiogroup` / `radio` z nazwą `label`. `disabled` przyciemnia i blokuje segmenty (tak samo `Chip`, `ChoiceButton`, `RadioCard`, `IconButton`).

---

### Feedback ✅ (`src/components/Feedback.tsx`)

Komunikat po akcji pod formularzem lub nad listą: błąd `bodyL` `primaryPressed` (`role="alert"`) albo potwierdzenie `bodyL` `textSecondary` (`role="status"`); bez żadnego — nic.

---

## Listy i karty

### Card

Białe tło `surface`, radius 20 (`3xl`), padding 20 (lub 16 w kartach zaproszeń), `shadows.cardRaised`. Karta sukcesu/QR: radius 22, `shadows.cardRaised`. Grupa wierszy (GroupedList) — patrz niżej, radius 18.

### ActionRow (wybór sposobu dołączenia)

`Pressable` poziomy: padding 12/14, tło `surface`, radius 16, `shadows.card`, gap 14. Od lewej: `IconBox` 44 (radius 12, tło `primaryTint`, ikona `primary` 22) → kolumna (tytuł 16/600 `text` + podtytuł `caption` `textSecondary`, gap 2) → `ChevronRight` 18 `iconMuted` albo `CountBadge`.

### IconBox

Kwadrat z zaokrągleniem (`radii.md` 12 / `lg` 14 dla 48 dp), tło `primaryTint`, ikona `primary`. Wariant `selected`: tło `primary`, ikona `onPrimary`. Wariant `onPrimary`: tło `onPrimaryOverlay`, ikona biała (na czerwonej karcie).
W kodzie (`src/components/IconBox.tsx`): rozmiary `sm` 40 (wiersze list, SelectableCard) · `md` 44 (domyślny) · `xl` 52 radius 16 (karta rozszerzenia w katalogu); wariant `neutral` (tło `surfaceSunken`, ikona `text`); wariant `dark` (tło `text`, ikona `onPrimary`: wiersz rozszerzenia z licznikiem, np. „Panel zgłoszeń”); zamiast ikony może być emoji rozszerzenia (`emojiM` 20 / `emojiL` 26, dekoracja ukryta przed czytnikiem ekranu). Wariant `onPrimary` nie jest zaimplementowany.

### Avatar ✅ (`src/components/Avatar.tsx`)

- Inicjały osoby: koło (28/36/40 dp), tło `primaryTint` + tekst `primary` 600 (12–13 px) lub neutralny: tło `surfaceMuted`, tekst `text`. W kodzie: tylko 40 dp (`sizes.avatarLg`, `buttonS`), ton `accent` / `neutral`, ukryty przed czytnikiem ekranu (imię stoi obok).
- Skrót miejsca (`PlaceAvatar`): kwadrat 44–48 dp, radius 12, tło `primaryTint`, tekst `typography.abbr` `primary` (Schibsted Grotesk 700, 16, UPPERCASE), np. „OS", „KL".

### Badge / Chip

- `RoleBadge` / „Domyślne" / „Polecane": `typography.chip`, padding 2×8 (w tytule 1×7), radius 6. Admin/Domyślne/Polecane: tło `primaryTint`, tekst `primaryPressed`. Członek: tło `surfaceMuted`, tekst `textSecondary`.
- `CountBadge`: min 20–24 dp, wysokość = szerokość min, radius pół wysokości, padding 6–7, tekst 13/700 biały; tło `text` (zaproszenia) lub `primary` (liczniki prośb). Na ikonie admina: 18 dp, top 2 / right 2, border 2 dp `background`.
- `StatusPill` („Administrator", „Jesteś administratorem"): wysokość 30–32, radius pill, padding 0×12, tło `surface`, `shadows.card`, tekst 13–14/600, ikona `ShieldCheck` 14 `primary`.

### InviteCard (Zaproszenia)

Card (radius 20, padding 16, gap 16): wiersz `PlaceAvatar` 48 + nazwa 17/600 + rodzaj (`label`) → separator `divider` → wiersz nadawcy (Avatar 28 + „**Imię** · kiedy" `caption`) → 2 przyciski sm: „Odrzuć" (secondary) i „Akceptuj" (primary).

### GroupedList + ListRow

Kontener: `surface`, radius 18, `shadows.card`. Wiersz: padding 12–14 / 10–16, gap 10–14, separator dolny 1 px `divider` poza ostatnim wierszem. Warianty zawartości: osoba (Avatar + imię 15/500 + opcjonalnie podpis `small`), członek (Avatar + imię + RoleBadge), ustawienie (nazwa 15/500 + wartość `caption` `textSecondary`), prośba o dołączenie (Avatar 40 + imię 15/600 + „przez …" `small` + przyciski akcji).

### SelectableCard (wybór rodzaju miejsca, 2 kolumny)

Min wysokość 128, padding 14, radius 18, gap 14, układ kolumnowy. Zawartość: `IconBox` 40 → nazwa 15/600 + opis `small` lineHeight 17.5. Stan domyślny: border 2 transparent + `shadows.card`. Zaznaczony: border 2 `primary` + `shadows.selected`, IconBox w wariancie `selected`. Grid: 2 kolumny, gap 10. `accessibilityRole="radio"`, `accessibilityState.selected`.

### RadioCard (zasady dołączania)

Jak SelectableCard, ale w układzie poziomym (padding 16, radius 18, gap 14): po lewej `RadioDot` (koło 22: border 2 `border`, zaznaczone: border `primary` + wypełnienie 10–12 dp `primary`), potem tytuł 16/600 (+ `Badge` „Polecane") i opis `caption` `textSecondary`. Kontener `accessibilityRole="radiogroup"`.

### CheckCard (funkcje nowego miejsca)

Jak RadioCard, ale każdą opcję włącza się osobno: po lewej kwadrat 22 (radius 6, border 2 `border`; zaznaczony: tło i border `primary` + ikona `Check` `onPrimary`), potem emoji rozszerzenia i tytuł 16/600, pod spodem opis `caption` `textSecondary`. Zaznaczona karta: border 2 `primary` + `shadows.selected`. `accessibilityRole="checkbox"`, kontener `role="group"` z etykietą.

### DisclosureCard (sekcje „Zarządzaj miejscem")

Biała karta radius 20, `shadows.card` (otwarta: `cardRaised`). Nagłówek (cały jest przyciskiem, `aria-expanded`): padding 16, gap 14, `IconBox` 44 (zamknięta: wariant `neutral` — tło `surfaceSunken`, ikona `text`; otwarta: `selected`), tytuł `cardTitle` + podsumowanie `small` `textSecondary`, po prawej chevron 18 (otwarta: `ChevronUp` w kole 44 `surfaceSunken`). Treść pod linią 1 px `borderSubtle`, padding 16, gap 14; wariant `flush` bez paddingu i odstępów (wiersze do krawędzi karty, np. lista rozszerzeń). Otwarta jest jedna sekcja naraz. Otwieranie i zamykanie jest płynne: treść rozwija się od 0 do swojej wysokości (i zwija z powrotem), a chevron obraca się o 180°, `motion.sheet` z łagodnym hamowaniem; przy włączonym ograniczeniu ruchu w systemie zmiana jest natychmiastowa. Zamknięta treść jest odmontowana (po animacji), więc każde otwarcie zaczyna od zapisanych danych.

### PlaceRow (przełącznik miejsc)

Przycisk pełnej szerokości: padding 10/14/10/10, radius 16, gap 14, tło `surface`, border 1.5. Aktywny: border `primary` + `shadows.selected`; nieaktywny: border transparent + `shadows.card`. Zawartość: `PlaceAvatar` 44 → nazwa 16/600 (+ Badge „Domyślne") nad rodzajem `small` `textSecondary`. Miejsce, którym administrujesz: przed nazwą gwiazdka w kółku (`CircleStar` 18, `primary`, jak odznaka szeryfa, gap 6), a w etykiecie dostępności „Administrator".

### KeyValueRow

W białej grupie: wiersz `space-between`, padding 14/16, tekst 15; etykieta `textSecondary`, wartość 600; kod jako `codeInline`.

---

## Nawigacja i powłoki ekranów

### Screen

`backgroundColor: colors.background`, `paddingHorizontal: 24`, `paddingTop: insets.top + 12`, `paddingBottom: 32` (lub insets.bottom + 8), kolumna z `gap` 24–28, spacer `flex:1` przed dolnym CTA. Używaj `react-native-safe-area-context`, `ScrollView` dla ekranów dłuższych niż ekran (np. Zarządzaj miejscem, min. wysokość 1100 dp w makiecie). Nie rysuj atrap paska statusu.

Akcje w zasięgu kciuka: gdy treść jest krótsza niż ekran, akcje, którymi ekran się kończy (CTA, pole do pisania z przyciskiem), stoją przy dolnej krawędzi, a wolne miejsce jest nad nimi (spacer `flex:1`); dłuższa treść spycha je niżej (przewijają się z nią). Rozmowa (Rozszerzenie z AI): wiadomości → wolne miejsce → pole nowej wiadomości. Formularz zostawia pola pod treścią i spycha na dół tylko przycisk. Widoki rozszerzeń mają to z renderera (`PluginScreen` w `src/plugins/Renderer.tsx`, docs/plugins.md).

### NoticeScreen ✅ (`src/components/NoticeScreen.tsx`)

Ekran z nagłówkiem i jednym komunikatem zamiast treści (wczytywanie, błąd wczytania, brak uprawnień — np. ekrany administratora otwarte przez członka): `Screen` bez chrome, nagłówek, tekst `bodyL` `textSecondary` (`role="alert"` przy błędzie).

### ScreenHeader

Wariant prosty: `IconButton plain` (wstecz). Wariant „krok": `IconButton plain` (wstecz) + `StepProgress` + etykieta „Krok N z M" (`stepNumber`, `textSecondary`), gap 16. Wariant z tytułem: etykieta `label` nad `headingS` (np. nazwa miejsca nad „Zarządzaj miejscem"). Pod nagłówkiem blok tytułu: `title` + lead `bodyL` `textSecondary`, gap 8.

### StepProgress

`SegmentedProgress` z N segmentami (gap 6), wypełnione do bieżącego kroku. Nagłówek kroku zostaje zamontowany między krokami, więc przejście do następnego (lub poprzedniego) kroku animuje pasek.

### SegmentedProgress

N równych segmentów w rzędzie, wysokość 4, radius 2; wypełnienie `primary`, tło `border`. Wartość może być ułamkowa (częściowo wypełniony segment). Zmiana wartości animuje się płynnie od lewej do prawej (przy spadku — od prawej), `motion.base` na segment. Dekoracyjny (`aria-hidden`) — postęp jest też podany tekstem (StepProgress, PasswordStrength).

### BottomTabBar

4 zakładki (Pulpit / Miejsca / Mapa / Konto) w siatce, tło `surface`, górna krawędź 1 px `borderSubtle`, padding 8/12/(insets.bottom ≈ 28)/12. Zakładka: kolumna, gap 4, padding 8, ikona 22 + etykieta 12. Aktywna: kolor `primary`, `tabActive`, pod etykietą kropka 5 dp `primary`; nieaktywna: `textSecondary`, `tab`. „Miejsca" nie jest osobnym ekranem: otwiera przełącznik miejsc (BottomSheet) nad pulpitem (`/app?places=1`); „Mapa" (`Map`) to mapa miejsc (`/app/map`). Ekran „Brak miejsc" nie ma paska (konto: okrągły awatar w nagłówku; do mapy prowadzi wiersz „Znajdź na mapie").

### BottomSheet

Tło pod arkuszem: `scrim` z przyciemnieniem. Arkusz: `background`, górne rogi `radii.sheet` (28), padding 12/24/32, gap 20; uchwyt 40×5 radius 3 `dashed`, wyśrodkowany. Nagłówek: opcjonalna etykieta `label` (`eyebrow`) nad `headingS` + `IconButton plain` (zamknij, bez tła). `scrollable`: treść przewija się, gdy arkusz sięga górnej krawędzi (górny odstęp = safe area); `dismissible={false}` (trwa akcja arkusza): bez przeciągania w dół, bez zamykania tłem, zamknij wyłączone. Użyj `@gorhom/bottom-sheet` lub `Modal`. Animacja `motion.sheet`.

### Pulpit (DashboardHeader + WidgetGrid)

- Nagłówek: etykieta „Twoje miejsce" (`label` `textSecondary`), 8 dp odstępu, nazwa miejsca `heading` (lub `headingM` dla długich nazw); administrator ma po prawej `IconButton round` (ustawienia). Bez powitania i bez strzałki — BottomSheet przełącznika otwiera tylko zakładka „Miejsca" w dolnym pasku.
- Tło nagłówka: dekoracyjna mapa (SVG: ulice `mapRoadMinor` 7 px, woda `mapWater`) — opcjonalne, `aria-hidden`.
- Siatka widżetów (projekt „Układ pulpitu"): 3 kolumny (`DASHBOARD_COLUMNS`), wiersze `sizes.widgetRow`, gap 12; widżet zajmuje `w` × `h` komórek (rozmiar wybrany przez administratora spośród dozwolonych przez rozszerzenie). Rozmieszczenie jak CSS grid `row dense` (`src/lib/grid.ts`: `packGrid` / `gridRects`, kafelki pozycjonowane absolutnie) — tak samo w pulpicie i w edytorze układu. Nagłówek sekcji: `label` + licznik „N widżetów" (`small`).
- Kafelek widżetu: dotknięcie otwiera widok rozszerzenia wskazany przez widżet (`onPress`; przy tytule `ChevronRight` `iconMuted`), karty i przyciski w środku działają osobno. Administrator przytrzymuje kafelek (haptyka „long press"), żeby wejść w tryb edycji: przerywana ramka, uchwyt i strzałki, nad siatką podpowiedź i „Gotowe". Czytnik ekranu: akcja „Edytuj pulpit" na kafelku.
- `EmptyStateCard`: Card radius 20, padding 20, `IconBox` 48 radius 14 + tytuł 16/600 + opis `caption` (lineHeight 20).
- `CtaCard` (Zaproś użytkowników): radius 20, padding 16, tło `primary`, `IconBox` w wariancie `onPrimary`, tytuł 16/600 biały, podtytuł `caption` biały z `opacity.onPrimarySubtitle`, `ChevronRight` po prawej.

### Czat (wtyczki: `ui.chat` + `ui.composer`)

Jak w komunikatorze: moje dymki po prawej (`primary`, tekst `onPrimary`), cudze po lewej (`surface` + ramka `borderSubtle`) z inicjałami autora (koło 28 dp `primaryTint`, `chip` `primary`) przy ostatnim dymku bloku i imieniem (`small` `textSecondary`) nad pierwszym. Dymek: radius 18, w środku bloku narożniki od strony autora 6; padding 8/12, tekst `body`, maks. 78% szerokości. Blok = kolejne wiadomości jednej osoby, bez względu na przerwy; bez godzin na ekranie (czytnik ekranu podaje godzinę wiadomości). Pole wiadomości przypięte na dole nad klawiaturą (pasek `background` z górną linią `borderSubtle`): pigułka 44 dp (`surface`, ramka `border`, `input`) + okrągły przycisk 44 dp `primary` z `SendHorizontal`, wyszarzony przy pustym polu; Enter wysyła, pole czyści się od razu. Akcja moderatora (np. zamknięcie dyskusji) to `IconButton round` w prawym górnym rogu, z potwierdzeniem.

### HeroBanner

Czerwona karta radius 22, padding 22, min wysokość 172, treść przy dole: etykieta `labelHero` + `headingM` (biały). Dekoracja SVG: jasne ulice `rgba(255,255,255,0.09)` + pinezka (kółko biała 7 dp w obwódce 16 dp `opacity .25`).

### CreateRow („Utwórz własne miejsce")

Padding 16, radius 18, border 1.5 dashed `dashed`, okrągły przycisk 44 dp `primary` z `Plus` 22 + tekst 16/600.

### SuccessMark + sukces

Koło 64 dp `primary` z ikoną `Check` (biała), pierścień 8 dp `primaryTint` (RN: otaczający `View` 80 dp), pod nim `heading` (wyśrodkowany) i `StatusPill`.

### QR / kod miejsca (karta)

Card radius 22: lewa strona etykieta `label` „Kod zaproszeniowy" → `codeXL` → opis `small`; po prawej kod QR (komponent `QrCode`: `qrcode-generator` rysowany przez `react-native-svg`, tło białe, quiet zone). Pod spodem akcje 2 kolumny (gap 8) — np. „Kopiuj", „Udostępnij", „Drukuj". W aplikacji (`InviteCodeCard`) jest tylko „Udostępnij" (systemowy arkusz `Share`); wersja do druku (A4 595×842, szablon w tych samych kolorach) nie jest zaimplementowana.

### ScannerFrame (skaner QR — tryb ciemny)

Ekran: tło `scannerBg`, padding 56/24/40. Ramka 268×268, radius 32, tło `scannerFrame`; cztery narożniki 52×52 (border 3 `onPrimary`, zaokrąglenie 32 po zewnętrznej stronie); pozioma linia skanowania 2 dp `primary`, marginesy 32 (animowana w pionie). Podgląd z aparatu: `expo-camera` (`CameraView`, `barcodeScannerSettings: qr`). Tekst pomocniczy `bodyL` kolor `scannerText`, max szerokość 280, wyśrodkowany. Na dole przyciski `onDark` i `roundOnDark`-style (tło `onDarkOverlay`, tekst biały).

## Widoki rozszerzeń (`src/plugins/`)

Węzły z katalogu SDK (`packages/sdk/src/ui.ts`) rysuje `Renderer.tsx` z komponentów powyżej (projekty „Z-…”):

- Shared widget renderer: neutral 15 dp header icon, gray `smallStrong` title (13 px), horizontal padding 16 dp,
  vertical padding 14 dp. Dark full-width CTA stays 44 dp tall; list content clips before the CTA. Grid rows are
  96 dp with 12 dp gaps (3×2 = 204 dp; 3×3 = 312 dp).
- Section headings (`ui.heading` level 3) and screen eyebrows use uppercase `sectionLabel` (Barlow Condensed,
  14 px). Segmented tabs have a 48 dp track and 40 dp segments; card lists use 10 dp gaps. Meta items with icons
  have no preceding dot.

- Nagłówek ekranu (`ScreenHeader.tsx`): `BackButton` (wstecz, bez tła) → etykieta `label` nad `Heading level 1 headingS` → akcje: pigułka `Button dark xs` z ikoną (radius pill) albo `IconButton roundDark`. Gdy pierwszy węzeł to `Gallery`, galeria idzie na całą szerokość u góry, a wstecz to `BackButton` nad nią (biały szewron, bez tła).
- Karta (`CardRow.tsx`): na ekranie biała karta radius 18, padding 12, `shadows.card`: miniatura 76 (`sizes.cardThumb`, radius 12, pigułka „+N” `photoOverlay`), tytuł `rowTitle` w 2 wierszach, linia meta `small` `textSecondary` (`MetaLine.tsx`, kropki między elementami), po prawej pigułka głosów 32 (`sizes.votePill`: wciśnięta `primary`/`onPrimary`, niewciśnięta `surface` + ramka `border`, tekst `primary`; `aria-pressed` przez `src/lib/a11y.ts`). Karta bez zdjęcia, ikony, meta, licznika, tagów i kropki to zwykła `Card` z tekstem. W liście `grouped` (biała grupa radius 18, linie `divider`): kolumna kropki „nowe” 8 dp, miniatura 52 albo `IconBox sm` (`neutral`, `dark` z licznikiem), liczba głosów strzałka nad liczbą (`text`), `CountBadge` 22 (`primary`), chevron. W widżecie: wiersz z tytułem w 1 linii (`link`) i liczbą głosów w `primary`.
- `Menu.tsx`: wyzwalacz tekstowy 36 dp (`buttonS` + `ChevronDown`) albo pigułka 28 dp z ramką i ikoną `primary`; otwiera `BottomSheet` z `RadioCard`. W kafelku pulpitu (bez nakładki) opcje są rzędem `Chip`.
- `Gallery.tsx`: strony 4:3 przewijane w poziomie, pigułka „1 / 2” 28 dp `photoOverlay` w rogu (`aria-live`).
- Puste (`Empty`): ikona 30 w białym pudełku 64 (radius 20, `shadows.card`), `Heading cardTitleL`, tekst `bodyL` — wyśrodkowane; w widżecie bez ikony, na środku reszty kafelka.
- `Tabs tiles`: kafelki 76 dp radius 16, liczba `headingM` nad etykietą `smallStrong`; wybrany: tło `text`, tekst `surface`.
- `Stat`: biała płytka radius 16, liczba `headingS` (`successText` / `primary` wg tonu), etykieta `small`. `Notice`: wiersz jak `Place` z ikoną `textBody`.
- Tag z `onRemove` (`Tags.tsx`): pigułka 36 dp z ramką `border` i przyciskiem `X` (`iconMuted`).
- Arkusz widoku (`PluginSheet.tsx`, `navigate` z `present: "sheet"`): `BottomSheet` z etykietą i tytułem widoku.
- Strona rozszerzenia (`src/screens/PluginPage.tsx`, Z-StronaPluginu): wstecz, `IconBox xl neutral` z emoji, „Rozszerzenie” nad nazwą; część rozszerzenia (`adminView`); sekcja „Widżet rozszerzenia” (biała grupa: nazwa, „Rozmiary: …”, `Badge success`/`neutral`, `Button tint sm`); `Button destructiveGhost` na dole.

## Mapy

### MapView ✅ (`src/components/MapView.tsx`)

Żywa mapa: MapLibre GL JS na kafelkach OpenFreeMap (dane OpenStreetMap), przemalowana tokenami `mapBase` (tło, zabudowa mieszkaniowa), `mapBuilding`, `mapPark`, `mapWater`; podpisy po polsku (`name:pl`). Pinezki miejsc: koło `primary` z obrysem `onPrimary` (`mapMarks.pinRadius` / `pinRadiusSelected`), podpis pod spodem (`Noto Sans Bold`, `mapMarks.labelSize`, obwódka `surface`). Pozycja użytkownika: kropka `mapMe` z obwódką `surface` i halo `mapMe` (`opacity.routeHalo`). Atrybucja OSM (wymagana licencją) zawsze widoczna w lewym dolnym rogu, nad panelem zachodzącym na mapę (`bottomInset`); w nieruchomym podglądzie (`interactive={false}`) zwinięta do „i". Tło `mapBase` widać, dopóki mapa się nie wczyta. `anchor` (ułamki szerokości i wysokości widoku) przesuwa `center` poza środek, pod pinezkę narysowaną na mapie. Implementacja: `src/lib/map/` (strona HTML w `react-native-webview` / iframe na webie). Pinezki rysuje canvas, więc ekran z mapą pokazuje obok ich dostępną listę.
Mapy rozszerzeń (`ui.map`, `src/plugins/PluginMap.tsx`): pinezki, trasy (`routes`: linia `mapMarks.routeWidth` na białej obwódce `routeCasing`, przerywana `routeDash` dla objazdów) i obszary (`areas`: koło w metrach albo wielokąt, wypełnienie `opacity.mapArea`, obrys `mapMarks.areaStroke`). Kolor z tonu: `danger` = `primary`, `warning` = `mapWarning`, `success` = `mapSuccess`, `info` = `mapInfo`, `neutral` = `mapNeutral`, bez tonu `primary`. `fit` = pierwszy widok obejmuje wszystko (z odstępem `mapMarks.fitPadding`, nie bliżej niż ulica). Pod mapą rozszerzenia (wysokość `sizes.pluginMap`, radius `xl`, ramka `border`): legenda warstw (znaczniki `sizes.mapSwatch`: kropka, linia, kwadrat), karta dotkniętego elementu i przycisk „Pokaż listę (n)” (`ghost sm`) z listą wszystkich elementów. W kafelku pulpitu nieruchomy podgląd `sizes.locationPreview`. Pole `ui.locationInput` otwiera `LocationPicker` w oknie modalnym, a po wyborze pokazuje podgląd jak krok 2 kreatora.

### PlacePin ✅ (`src/components/PlacePin.tsx`)

Znacznik miejsca na tle pulpitu (`PlaceBackdrop`): czerwona poświata (gradient radialny `colors.primary`, średnica `sizes.dashboardGlow`, siła `opacity.dashboardGlow` w środku, zanikająca do brzegu), na prawo od nazwy miejsca, w `sizes.dashboardPinX` szerokości i `sizes.dashboardPinTop` pod górą treści; mapa ma tam swój środek (`anchor`); miejsce bez lokalizacji ma poświatę w tym samym punkcie ilustracji. Całe tło jest podniesione o `sizes.dashboardMapLift`, a przy przewijaniu rozmywa się (`expo-blur`, pełne po `sizes.dashboardBlurRange` dp). Nieinteraktywne.

### SearchField ✅ (`src/components/SearchField.tsx`)

Pole wyszukiwania nad mapą: wysokość 52 (`sizes.input`), radius `lg`, tło `surface`, cień `floating`, padding 16, lupa 18 `textSecondary`, placeholder = etykieta dostępności; po wpisaniu tekstu przycisk „Wyczyść" (`X`). Szuka po Enter (bez zapytania na każdy znak). Obok przycisk wstecz `BackButton` (bez tła).
Wariant `outlined` (nad listą, np. „Szukaj rozszerzeń"): wysokość 50 (`sizes.inputS`), ramka 1 px `border` zamiast cienia; bez `onSubmit` filtruje przy każdym znaku.

### Ekran „Lokalizacja miejsca" (kreator, krok 2)

Mapa na cały ekran z `PlacePin` w środku; u góry wstecz + `SearchField`, pod nimi ciemna pigułka podpowiedzi (`text`, tekst `caption` `onPrimary`) albo karta wyników (`Card`, wiersze: `MapPin` `primary` + nazwa `buttonM` + adres `small`). Prawy dolny róg mapy: „Moja lokalizacja" (`IconButton floating`, ikona `LocateFixed` w kolorze `mapMe`). Panel na dole zachodzi na mapę o `radii.sheet`: uchwyt, `IconBox MapPin` + adres pod pinezką (`cardTitle`) + „<nazwa> · tu pojawi się pinezka miejsca" (`small`), przycisk „Potwierdź lokalizację". W kroku 2 kreatora: podgląd `MapView` 140 dp (`sizes.locationPreview`, radius `xl`, ramka `border`) + „Zmień lokalizację" (`secondary sm`) / „Usuń lokalizację" (`ghost sm`).

---

## Inwentarz ekranów (kierunek E)

| Plik w projekcie      | Ekran                                                     | Główne komponenty                                                                                                    |
| --------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| E-Logowanie           | Logowanie                                                 | dekoracja mapy, wordmark, TextField ×2, Button primary, Button secondary ×2 (Google/Apple), Link                     |
| E-Rejestracja         | Rejestracja (krok 1 z 2)                                  | ScreenHeader (krok), TextField ×3, PasswordStrength, Checkbox, Button primary                                        |
| E-BrakMiejsc          | Brak miejsc na koncie                                     | IconButton round (konto), HeroBanner, ActionRow ×4, CreateRow                                                        |
| E-DolaczQR            | Skanowanie QR                                             | ScannerFrame, IconButton roundOnDark ×2, Button onDark / ghost-on-dark                                               |
| E-DolaczKod           | Kod lub link                                              | SegmentedControl, OtpInput, TextField url + „Wklej", Button primary                                                  |
| E-Zaproszenia         | Zaproszenia                                               | InviteCard ×N                                                                                                        |
| E-PodgladMiejsca      | Podgląd miejsca                                           | zdjęcie/mapa + BackButton (bez tła), panel z zaokrąglonymi górnymi rogami 24, KeyValueRow, Switch row, Button primary |
| E-Dashboard           | Pulpit (członek)                                          | DashboardHeader, EmptyStateCard, BottomTabBar                                                                        |
| E-PrzelacznikMiejsc   | Przełącznik miejsc                                        | BottomSheet, PlaceRow ×N, Button secondary ×2                                                                        |
| E-NoweMiejsceTyp      | Nowe miejsce 1/4                                          | ScreenHeader (krok), SelectableCard ×6, Button primary                                                               |
| E-NoweMiejsceDane     | Nowe miejsce 2/4                                          | TextField, pole adresu z mapą, textarea                                                                              |
| —                     | Nowe miejsce 3/4: funkcje (bez projektu; wzór: RadioCard) | CheckCard × wbudowane rozszerzenia, Button primary                                                                   |
| E-NoweMiejsceDostep   | Nowe miejsce 4/4                                          | RadioCard ×3, Switch row, notka                                                                                      |
| E-NoweMiejsceGotowe   | Miejsce utworzone                                         | SuccessMark, StatusPill, karta kodu+QR, Button primary + ghost                                                       |
| E-ZaprosOsoby         | Zaproś osoby                                              | TextField + dodaj, GroupedList osób, ActionRow z kodem, Button primary                                               |
| E-DashboardAdmin      | Pulpit (administrator)                                    | jak Dashboard + StatusPill, IconButton roundDark z CountBadge, CtaCard                                               |
| E-ZarzadzanieMiejscem | Zarządzaj miejscem                                        | TitleHeader, DisclosureCard: zapraszanie (karta), rozszerzenia (`flush`: włączone rozszerzenia — IconBox `sm` z emoji, nazwa `rowTitle` + „N widżetów · opis" `small`, `ChevronRight`, linia `divider`; wiersz to link do strony rozszerzenia; Button `primary sm` z `href` „Dodaj rozszerzenie"), członkowie (RoleBadge), ustawienia; Button destructiveGhost |
| E-UkladPulpitu        | Układ pulpitu (edytor)                                    | TitleHeader + Button `dark xs` „Zapisz" jako pigułka 44 dp; podpowiedź `small`; siatka 3 kolumn (tło `surfaceSunken`, radius 22, padding/gap 10, wiersze `layoutRow` 64): kafelek = przycisk z `aria-pressed` (radius 16, emoji + nazwa `tileTitle`, plakietka rozmiaru `label` radius 6; zaznaczony: ramka 2 `primary` + `shadows.selected`, plakietka `primary`), na końcu przerywany kafelek „Dodaj widżet" (`dashedStrong`). Panel zaznaczonego widżetu przy dolnej krawędzi (nie modalny: `surface`, górne rogi `radii.panel` 24, `shadows.panel`): nazwa `cardTitle` + rozszerzenie `small`, zamknij `roundSunken`, `label` „Rozmiar" + `radiogroup` opcji 48 dp (obrys `layoutSizeUnit` × w/h; zaznaczona: tło `text`), Button `secondary sm` „Wyżej"/„Niżej" i `accent sm` „Usuń". BottomSheet „Dodaj widżet": grupy rozszerzeń (emoji + nazwa `smallStrong`), białe karty wierszy (`rowTitle` + „Rozmiary: …" `small`, Button `primary xs` pigułka 38 „Dodaj"), Button `ghost sm` „Więcej widżetów? Dodaj rozszerzenie" |
| E-KatalogWidzetow     | Dodaj rozszerzenie (katalog rozszerzeń miejsca)           | TitleHeader, SearchField `outlined`, `label` „Rozszerzenia", karty rozszerzeń (radius 20, padding 18, `cardRaised`: IconBox `xl` z emoji + nazwa `cardTitleL` + podtytuł `small`, Button `accent` „Dodaj do miejsca" 44 dp), na dole ActionRow „Stwórz rozszerzenie z AI"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| E-WydrukQR            | Wydruk A4 z QR                                            | szablon wydruku (poza główną nawigacją; niezaimplementowany)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

Przepływy: Logowanie ⇄ Rejestracja → Brak miejsc → (QR / Kod·Link / Zaproszenia) → Podgląd miejsca → Pulpit ⇄ Przełącznik miejsc → Nowe miejsce (3 kroki) → Miejsce utworzone → Zaproś osoby / Pulpit admina → Zarządzaj miejscem → Dodaj rozszerzenie → Rozszerzenie z AI.

---

## Dostępność (wymagania z projektu)

- Cel dotyku ≥ 44×44 dp; mniejsze elementy dostają `hitSlop`.
- Każdy przycisk-ikona ma `accessibilityLabel`; pola mają powiązane etykiety (`accessibilityLabel` = tekst Label).
- Kontrast: tekst `text`/`textSecondary` na `background`/`surface` oraz `onPrimary` na `primary` spełnia 4,5:1. `placeholder` NIE używać do informacji istotnych (tylko placeholder pola).
- Uwaga: `primary` (#D81B60) na `background` daje ok. 4,9:1, a na białym ok. 5,4:1. Biały tekst na końcu gradientu (#F2545B) ma tylko ok. 3:1, więc etykiety na przyciskach pisz wagą 600+ (lub ≥ 18 px). Linki i małe napisy w kolorze `primary` pisz w wadze 600+ (lub ≥ 18 px); na `primaryTint` dla tekstu używaj `primaryPressed` (6,3:1), tak jak w badge'ach.
- Stan zaznaczenia nie może zależeć wyłącznie od koloru — SelectableCard/RadioCard/CheckCard zmieniają też grubość ramki i wypełnienie kropki lub kwadratu.
- Role: `radio`/`radiogroup`, `switch`, `tab`/`tablist`, `button`, `link`.
- `allowFontScaling` włączone (domyślnie); nie ustawiaj sztywnych wysokości dla tekstu — tylko `minHeight`.
