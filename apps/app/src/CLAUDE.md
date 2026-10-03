# Twoje Miejsce — aplikacja mobilna (React Native)

Aplikacja do dołączania do „miejsc" (osiedle, budynek, firma, szkoła…) i zarządzania nimi. UI po polsku.

## Design system — OBOWIĄZKOWE zasady
Pełna specyfikacja komponentów: `@COMPONENTS.md` · tokeny: `@src/theme/tokens.ts` · fonty: `@src/theme/fonts.ts`.

1. **Wszystkie wartości wizualne tylko z `src/theme`.** Zero surowych hexów (`#E50101`), zero „magicznych" liczb odstępów, promieni i rozmiarów czcionek w komponentach i ekranach. Jeśli czegoś brakuje — dodaj token w `tokens.ts`, nie wpisuj wartości inline.
2. **Teksty przez komponent `Text`** (`variant` + `color`), nie przez gołe `react-native/Text`. Etykiety/kody używają Barlow Condensed (warianty `label*`, `chip`, `code*`), reszta Schibsted Grotesk.
3. **Najpierw użyj istniejących komponentów** z `src/components` (Text, Button są gotowe). Nowy komponent twórz według wzorca z `Button.tsx`: TypeScript, `StyleSheet.create`, warianty jako unie typów, `Pressable` zamiast `TouchableOpacity`, stany pressed/disabled, `accessibilityRole`/`accessibilityLabel`.
4. **Jeden komponent = jeden plik** w `src/components/<Nazwa>.tsx` + eksport w `src/components/index.ts`. Props typowane i udokumentowane krótkim komentarzem.
5. **Layout:** ekran = `Screen` (tło `background`, padding poziomy `layout.screenPaddingX` = 24, góra = `insets.top + layout.screenTopOffset`). Używaj `react-native-safe-area-context`, nie rysuj atrapy paska statusu. Dolne CTA przyklejone do dołu (spacer `flex: 1`).
6. **Ikony:** `lucide-react-native`, `strokeWidth` 1.8, kolory z tokenów. Mapowanie nazw — `COMPONENTS.md → Icon`.
7. **Cienie:** `...shadows.card | cardRaised | selected | floating` (iOS + Android w jednym).
8. **Dostępność:** cel dotyku ≥ 44 dp, `accessibilityLabel` na przyciskach ikonowych, role `radio`/`switch`/`tab` zgodnie ze specyfikacją.
9. **Język:** wszystkie teksty UI po polsku, trzymaj kopię z makiet (nie wymyślaj nowych sformułowań bez potrzeby). Dane przykładowe z makiet zastępuj propsami / danymi z API.
10. **Nie** dodawaj ciężkich bibliotek UI (NativeBase, Paper, Tamagui…) — komponenty są własne.

## Stack (zalecany)
Expo (SDK aktualne) + TypeScript (strict) · React Navigation (native-stack + bottom-tabs) · `react-native-svg` · `lucide-react-native` · `react-native-safe-area-context` · `expo-camera` (skaner QR) · `react-native-qrcode-svg` · `@gorhom/bottom-sheet` · `expo-print`.

## Struktura
```
src/
  theme/        tokens.ts, fonts.ts, index.ts     ← źródło prawdy wyglądu
  components/   Text, Button, … (wg COMPONENTS.md)
  screens/      ekrany (nazwy: LoginScreen, RegisterScreen, NoPlacesScreen, …)
  navigation/   stacki i tab bar
```

## Jak pracować
- Zacznij od przeczytania `COMPONENTS.md`. Implementuj komponenty w kolejności z jego nagłówka, po każdym: `npx tsc --noEmit`.
- Dla każdego komponentu pokaż mały „katalog" (Storybook lub ekran `/dev/components`) z wariantami i stanami.
- Przy rozbieżności między kodem a `COMPONENTS.md` — specyfikacja wygrywa; zgłoś różnicę zamiast po cichu zmieniać wygląd.
