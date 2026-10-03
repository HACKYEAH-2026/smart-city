# Twoje Miejsce — specyfikacja komponentów (React Native)

Źródło: projekt „E · Czerwień #E50101" (17 ekranów). Wszystkie wartości pochodzą z `src/theme/tokens.ts`
(`colors.*`, `spacing.*`, `radii.*`, `sizes.*`, `typography.*`, `shadows.*`). Nazwy tokenów podane w nawiasach.
Piksele z projektu = dp w RN (1:1).

Kolejność implementacji: **1)** Text, Button (są gotowe) → **2)** Icon, IconButton, Label, TextField → **3)** reszta wg listy.

---

## Podstawy

### Text ✅ (`src/components/Text.tsx`)
Props: `variant` (klucz `typography`), `color` (klucz `colors`). Warianty etykiet (`label`, `labelL`, `labelHero`, `chip`, `stepNumber`, `abbr`) są automatycznie WIELKIMI LITERAMI.

### Icon
Biblioteka: **`lucide-react-native`** (ikony w projekcie mają styl Lucide) + `react-native-svg`.
Domyślnie `size=20–22`, `strokeWidth=1.8` (nawigacja/akcje: 2, mały chevron w kółku: 2.6). `color` z tokenów.
Mapowanie: pin miejsca → `MapPin` · QR → `QrCode` · kod → `Keyboard` · link → `Link` · zaproszenia/zaproś → `UserPlus` · powiadomienia → `Bell` · wstecz → `ChevronLeft` · dalej → `ChevronRight` · rozwiń → `ChevronDown` · zamknij → `X` · dodaj → `Plus` · pulpit → `LayoutDashboard` · konto → `User` · latarka → `Flashlight` · wklej → `ClipboardPaste` · administrator → `ShieldCheck` · ustawienia → `Settings` · typy miejsc: Osiedle `Home`, Budynek `Building2`, Firma `Briefcase`, Szkoła `GraduationCap`, Dzielnica `Map`, Inne `MoreHorizontal`.

### Button ✅ (`src/components/Button.tsx`)
| Wariant | Tło | Tekst | Użycie |
|---|---|---|---|
| `primary` | `primary` (wciśnięty `primaryPressed`) | `onPrimary` | główne CTA („Zaloguj się", „Dalej") |
| `secondary` | `surface` + border `border` 1 px | `text` | „Odrzuć", Google/Apple, „Ustaw wybrane jako domyślne" |
| `tint` | `background` | `text` | „Pokaż kod QR" wewnątrz białej karty |
| `dark` | `text` | `surface` | okrągłe przyciski ikonowe admina (patrz IconButton) |
| `onDark` | `surface` | `text` | skaner: „Symuluj rozpoznanie kodu" |
| `ghost` | transparent | `text` | „Przejdź do pulpitu" |
| `destructiveGhost` | transparent | `primaryPressed` | „Usuń miejsce" |

Rozmiary: `lg` 54 dp / `typography.button` (CTA na dole ekranu) · `md` 50 dp (Google/Apple, `buttonM`) · `sm` 46 dp radius 12 (Odrzuć/Akceptuj, w karcie) · `xs` 40 dp radius 12 (`buttonS`, „Wygeneruj nowy").
Radius: lg/md → `radii.lg` (14), sm/xs → `radii.md` (12). Minimalny cel dotyku 44 dp (xs ma 40 — używać tylko z `hitSlop`).
Przycisk CTA zawsze przy dolnej krawędzi ekranu (spacer `flex:1` nad nim). Dwa przyciski obok siebie: grid 2 kolumny, gap 10.
Stany: pressed (primary → `primaryPressed`; inne `opacity.pressed`), disabled (`opacity.disabled`).

### IconButton
44×44 dp, ikona 20 dp. Warianty:
- `square` — radius 14, tło `surface`, border `borderSubtle` (przycisk wstecz, w nagłówkach ekranów),
- `round` — radius 22, tło `surface`, border `borderSubtle` (dzwonek powiadomień, awatar „JK" z inicjałami `typography.buttonS`),
- `roundDark` — radius 22, tło `text`, ikona `surface` (zębatka admina; może mieć `CountBadge` w rogu top 2/right 2),
- `roundOnDark` — radius 22, tło `onDarkOverlay`, ikona biała (skaner: zamknij, latarka),
- `roundSunken` — radius 22, tło `surfaceSunken` (zamknij w bottom sheet),
- `floating` — 44×44 radius 14, tło `surface`, `shadows.floating` (wstecz na zdjęciu/mapie w PodgladMiejsca).
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
Struktura: `Label` → pole → opcjonalny `helper` (`typography.small`, `textSecondary`). Wiersz label + link (np. „Nie pamiętasz hasła?") — `justifyContent: space-between`, `alignItems: baseline`.
Warianty: `email`, `password` (maska + przełącznik), `url` + przycisk „Wklej" (46–52 dp, secondary, tekst `primary`), `multiline` (textarea: min 3 wiersze, padding 14/16, lineHeight 21.75, bez resize).
Pole z mapą (Adres): kontener radius 14, border `border`, `overflow:hidden`; u góry wiersz 52 dp z polem i separatorem `divider`, pod nim blok mapy 120 dp `mapBase` z pływającym przyciskiem „Popraw pinezkę" (36 dp, radius 10, `shadows.floating`, right/bottom 10).

### OtpInput (kod zaproszeniowy 6 znaków: `ABC-DEF`)
6 komórek `flex:1`, wysokość 64, radius 14, `typography.otp`, wyśrodkowany znak, `maxLength 1`, gap 6; między 3. a 4. komórką kreska 10×2 dp `dot`.
Stany komórki: wypełniona/domyślna (tło `surface`, border 1 `border`, `shadows.card`) · aktywna (border 2 `primary` + poświata 4 dp `focusRingStrong`) · pusta nieaktywna (tło `surfaceDisabled`, border `borderEmpty`). Auto-przeskok do następnej, backspace cofa, obsługa wklejania całego kodu, uppercase. Pod spodem: tekst pomocniczy `small` (lewa) + akcja „Wklej kod" z ikoną `ClipboardPaste` (prawa; `typography.buttonS`, `primary`, wysokość 44).

### PasswordStrength
4 segmenty (grid 4 kol., gap 4, wysokość 4, radius 2): wypełnione `primary`, puste `border`; pod spodem podpowiedź `small` `textSecondary`.

### Checkbox / Switch
Zgoda (regulamin): checkbox 20 dp, kolor zaznaczenia `primary`, tekst `typography.caption` kolor `textBody` lineHeight ~20, linki `primary`, gap 12, wyrównanie do góry.
Wiersz przełącznika („Ustaw jako domyślne"): biała karta radius 16, padding 14/16, `shadows.card`, tytuł 15/600 (+ opcjonalny opis `small`), po prawej Switch 22 dp z `trackColor.true = primary` (użyj `Switch`). Cały wiersz dotykalny (`accessibilityRole="switch"`).

### SegmentedControl
Kontener: tło `surfaceSunken`, radius 14, padding 4, 2 kolumny. Segment: wysokość 44, radius 11, `buttonM`. Aktywny: tło `surface`, tekst `text`, cień (0 1 3 .12 — `shadows.floating` lżejszy); nieaktywny: transparent, tekst `textSecondary`. `accessibilityRole="tablist"` / `tab`.

---

## Listy i karty

### Card
Białe tło `surface`, radius 20 (`3xl`), padding 20 (lub 16 w kartach zaproszeń), `shadows.cardRaised`. Karta sukcesu/QR: radius 22, `shadows.cardRaised`. Grupa wierszy (GroupedList) — patrz niżej, radius 18.

### ActionRow (wybór sposobu dołączenia)
`Pressable` poziomy: padding 12/14, tło `surface`, radius 16, `shadows.card`, gap 14. Od lewej: `IconBox` 44 (radius 12, tło `primaryTint`, ikona `primary` 22) → kolumna (tytuł 16/600 `text` + podtytuł `caption` `textSecondary`, gap 2) → `ChevronRight` 18 `iconMuted` albo `CountBadge`.

### IconBox
Kwadrat z zaokrągleniem (`radii.md` 12 / `lg` 14 dla 48 dp), tło `primaryTint`, ikona `primary`. Wariant `selected`: tło `primary`, ikona `onPrimary`. Wariant `onPrimary`: tło `onPrimaryOverlay`, ikona biała (na czerwonej karcie).

### Avatar
- Inicjały osoby: koło (28/36/40 dp), tło `primaryTint` + tekst `primary` 600 (12–13 px) lub neutralny: tło `surfaceMuted`, tekst `text`.
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

### PlaceRow (przełącznik miejsc)
Przycisk pełnej szerokości: padding 10/14/10/10, radius 16, gap 14, tło `surface`, border 1.5. Aktywny: border `primary` + `shadows.selected`; nieaktywny: border transparent + `shadows.card`. Zawartość: `PlaceAvatar` 44 → nazwa 16/600 (+ Badge „Domyślne") nad rodzajem `small` `textSecondary`.

### KeyValueRow
W białej grupie: wiersz `space-between`, padding 14/16, tekst 15; etykieta `textSecondary`, wartość 600; kod jako `codeInline`.

---

## Nawigacja i powłoki ekranów

### Screen
`backgroundColor: colors.background`, `paddingHorizontal: 24`, `paddingTop: insets.top + 12`, `paddingBottom: 32` (lub insets.bottom + 8), kolumna z `gap` 24–28, spacer `flex:1` przed dolnym CTA. Używaj `react-native-safe-area-context`, `ScrollView` dla ekranów dłuższych niż ekran (np. Zarządzaj miejscem, min. wysokość 1100 dp w makiecie). Nie rysuj atrap paska statusu.

### ScreenHeader
Wariant prosty: `IconButton square` (wstecz). Wariant „krok": wstecz + `StepProgress` + etykieta „Krok N z M" (`stepNumber`, `textSecondary`), gap 16. Wariant z tytułem: etykieta `label` nad `headingS` (np. nazwa miejsca nad „Zarządzaj miejscem"). Pod nagłówkiem blok tytułu: `title` + lead `bodyL` `textSecondary`, gap 8.

### StepProgress
N segmentów (grid, gap 6), wysokość 4, radius 2; wypełnione `primary`, reszta `border`.

### BottomTabBar
3 zakładki (Pulpit / Miejsca / Konto) w siatce, tło `surface`, górna krawędź 1 px `borderSubtle`, padding 8/12/(insets.bottom ≈ 28)/12. Zakładka: kolumna, gap 4, padding 8, ikona 22 + etykieta 12. Aktywna: kolor `primary`, `tabActive`, pod etykietą kropka 5 dp `primary`; nieaktywna: `textSecondary`, `tab`. Użyj React Navigation `createBottomTabNavigator` z własnym `tabBar`.

### BottomSheet
Tło pod arkuszem: `scrim` z przyciemnieniem. Arkusz: `background`, górne rogi `radii.sheet` (28), padding 12/24/32, gap 20; uchwyt 40×5 radius 3 `dashed`, wyśrodkowany. Nagłówek: `headingS` + `IconButton roundSunken` (zamknij). Użyj `@gorhom/bottom-sheet` lub `Modal`. Animacja `motion.sheet`.

### Pulpit (DashboardHeader + WidgetGrid)
- Nagłówek: powitanie `body` `textSecondary` + `IconButton round` (dzwonek); pod nim etykieta „Twoje miejsce" i nazwa miejsca `heading` (lub `headingM` dla długich nazw) z kółkiem 32 dp `primaryTint` z `ChevronDown` 16 (`primary`) — cały blok otwiera BottomSheet przełącznika.
- Tło nagłówka: dekoracyjna mapa (SVG: ulice `mapRoadMinor` 7 px, woda `mapWater`) — opcjonalne, `aria-hidden`.
- Siatka widżetów: 2 kolumny, gap 12; widżet pełnej szerokości = span 2. Nagłówek sekcji: `label` + licznik „N widżetów" (`small`).
- `EmptyStateCard`: Card radius 20, padding 20, `IconBox` 48 radius 14 + tytuł 16/600 + opis `caption` (lineHeight 20).
- `PlaceholderTile`: wysokość 128 (lub 96 dla szerokiego), border 1.5 dashed `dashed`, radius 20, padding 14, numer `label` w kolorze `textMuted` przy dolnej krawędzi.
- `CtaCard` (Zaproś mieszkańców): radius 20, padding 16, tło `primary`, `IconBox` w wariancie `onPrimary`, tytuł 16/600 biały, podtytuł `caption` biały z `opacity.onPrimarySubtitle`, `ChevronRight` po prawej.

### HeroBanner
Czerwona karta radius 22, padding 22, min wysokość 172, treść przy dole: etykieta `labelHero` + `headingM` (biały). Dekoracja SVG: jasne ulice `rgba(255,255,255,0.09)` + pinezka (kółko biała 7 dp w obwódce 16 dp `opacity .25`).

### CreateRow („Utwórz własne miejsce")
Padding 16, radius 18, border 1.5 dashed `dashed`, okrągły przycisk 44 dp `primary` z `Plus` 22 + tekst 16/600.

### SuccessMark + sukces
Koło 64 dp `primary` z ikoną `Check` (biała), pierścień 8 dp `primaryTint` (RN: otaczający `View` 80 dp), pod nim `heading` (wyśrodkowany) i `StatusPill`.

### QR / kod miejsca (karta)
Card radius 22: lewa strona etykieta `label` „Kod zaproszeniowy" → `codeXL` → opis `small`; po prawej kod QR (`react-native-qrcode-svg`, tło białe, quiet zone). Pod spodem akcje 2 kolumny (gap 8) — np. „Kopiuj", „Udostępnij", „Drukuj". Wersja do druku (A4 595×842): `expo-print` z szablonem HTML w tych samych kolorach.

### ScannerFrame (skaner QR — tryb ciemny)
Ekran: tło `scannerBg`, padding 56/24/40. Ramka 268×268, radius 32, tło `scannerFrame`; cztery narożniki 52×52 (border 3 `onPrimary`, zaokrąglenie 32 po zewnętrznej stronie); pozioma linia skanowania 2 dp `primary`, marginesy 32 (animowana w pionie). Podgląd z aparatu: `expo-camera` (`CameraView`, `barcodeScannerSettings: qr`). Tekst pomocniczy `bodyL` kolor `scannerText`, max szerokość 280, wyśrodkowany. Na dole przyciski `onDark` i `roundOnDark`-style (tło `onDarkOverlay`, tekst biały).

---

## Inwentarz ekranów (kierunek E)

| Plik w projekcie | Ekran | Główne komponenty |
|---|---|---|
| E-Logowanie | Logowanie | dekoracja mapy, wordmark, TextField ×2, Button primary, Button secondary ×2 (Google/Apple), Link |
| E-Rejestracja | Rejestracja (krok 1 z 2) | ScreenHeader (krok), TextField ×3, PasswordStrength, Checkbox, Button primary |
| E-BrakMiejsc | Brak miejsc na koncie | IconButton round (konto), HeroBanner, ActionRow ×4, CreateRow |
| E-DolaczQR | Skanowanie QR | ScannerFrame, IconButton roundOnDark ×2, Button onDark / ghost-on-dark |
| E-DolaczKod | Kod lub link | SegmentedControl, OtpInput, TextField url + „Wklej", Button primary |
| E-Zaproszenia | Zaproszenia | InviteCard ×N |
| E-PodgladMiejsca | Podgląd miejsca | zdjęcie/mapa + IconButton floating, panel z zaokrąglonymi górnymi rogami 24, KeyValueRow, Switch row, Button primary |
| E-Dashboard | Pulpit (członek) | DashboardHeader, EmptyStateCard, PlaceholderTile, BottomTabBar |
| E-PrzelacznikMiejsc | Przełącznik miejsc | BottomSheet, PlaceRow ×N, Button secondary ×2 |
| E-NoweMiejsceTyp | Nowe miejsce 1/3 | ScreenHeader (krok), SelectableCard ×6, Button primary |
| E-NoweMiejsceDane | Nowe miejsce 2/3 | TextField, pole adresu z mapą, textarea |
| E-NoweMiejsceDostep | Nowe miejsce 3/3 | RadioCard ×3, Switch row, notka |
| E-NoweMiejsceGotowe | Miejsce utworzone | SuccessMark, StatusPill, karta kodu+QR, Button primary + ghost |
| E-ZaprosOsoby | Zaproś osoby | TextField + dodaj, GroupedList osób, ActionRow z kodem, Button primary |
| E-DashboardAdmin | Pulpit (administrator) | jak Dashboard + StatusPill, IconButton roundDark z CountBadge, CtaCard |
| E-ZarzadzanieMiejscem | Zarządzaj miejscem | sekcje: prośby, zapraszanie (karta), członkowie (RoleBadge), ustawienia (GroupedList), Button destructiveGhost |
| E-WydrukQR | Wydruk A4 z QR | szablon do `expo-print` (poza główną nawigacją) |

Przepływy: Logowanie ⇄ Rejestracja → Brak miejsc → (QR / Kod·Link / Zaproszenia) → Podgląd miejsca → Pulpit ⇄ Przełącznik miejsc → Nowe miejsce (3 kroki) → Miejsce utworzone → Zaproś osoby / Pulpit admina → Zarządzaj miejscem.

---

## Dostępność (wymagania z projektu)
- Cel dotyku ≥ 44×44 dp; mniejsze elementy dostają `hitSlop`.
- Każdy przycisk-ikona ma `accessibilityLabel`; pola mają powiązane etykiety (`accessibilityLabel` = tekst Label).
- Kontrast: tekst `text`/`textSecondary` na `background`/`surface` oraz `onPrimary` na `primary` spełnia 4,5:1. `textMuted` i `placeholder` NIE używać do informacji istotnych (tylko dekoracja/placeholder).
- Uwaga: `primary` (#E50101) na `background` daje ok. 4,4:1, a na `primaryTint` ok. 4,2:1 — poniżej 4,5:1 dla małego tekstu. Linki i małe napisy w kolorze `primary` pisz w wadze 600+ (lub ≥ 18 px); na `primaryTint` dla tekstu używaj `primaryPressed` (6,3:1), tak jak w badge'ach.
- Stan zaznaczenia nie może zależeć wyłącznie od koloru — SelectableCard/RadioCard zmieniają też grubość ramki i wypełnienie kropki.
- Role: `radio`/`radiogroup`, `switch`, `tab`/`tablist`, `button`, `link`.
- `allowFontScaling` włączone (domyślnie); nie ustawiaj sztywnych wysokości dla tekstu — tylko `minHeight`.
