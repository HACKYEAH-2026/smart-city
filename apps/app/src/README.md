# Design system „Twoje Miejsce" — React Native

Wygenerowany z projektu **E · Czerwień #E50101** (17 ekranów mobilnych, 390×844).

## Zawartość
| Plik | Po co |
|---|---|
| `CLAUDE.md` | Zasady dla Claude Code — wczytywany automatycznie przez VS Code / CLI |
| `COMPONENTS.md` | Specyfikacja ~30 komponentów + inwentarz ekranów + dostępność |
| `src/theme/tokens.ts` | Kolory, odstępy, promienie, typografia, cienie (źródło prawdy) |
| `src/theme/fonts.ts` | Ładowanie fontów Schibsted Grotesk + Barlow Condensed |
| `src/components/Text.tsx`, `Button.tsx` | Referencyjne komponenty (wzorzec dla reszty) |

## Esencja stylu
- **Kolor:** czerwień `#E50101` jako jedyny akcent na ciepłym off-white `#F5F3EE`; białe karty; tekst `#1B1B1F` / `#5E5E66`.
- **Typografia:** Schibsted Grotesk (treść, nagłówki) + Barlow Condensed UPPERCASE (etykiety, kody).
- **Kształt:** duże zaokrąglenia (pola/przyciski 14, karty 20, arkusze 28), delikatne cienie, ramki przerywane dla pustych miejsc.
- **Układ:** marginesy 24, przyciski 54 dp przy dolnej krawędzi, cele dotyku ≥ 44 dp.

## Instalacja w projekcie
```bash
npx create-expo-app@latest twoje-miejsce -t expo-template-blank-typescript
cd twoje-miejsce
npx expo install expo-font expo-splash-screen react-native-svg react-native-safe-area-context \
  @expo-google-fonts/schibsted-grotesk @expo-google-fonts/barlow-condensed
npm i lucide-react-native
# potem skopiuj do katalogu głównego projektu: CLAUDE.md, COMPONENTS.md oraz folder src/
```
W `App.tsx` załaduj fonty: `const [loaded] = useAppFonts(); if (!loaded) return null;`.
