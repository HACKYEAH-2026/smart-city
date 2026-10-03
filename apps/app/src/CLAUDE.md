# apps/app/src — design system rules

Component spec: `COMPONENTS.md` · tokens: `theme/tokens.ts` · fonts: `theme/fonts.ts` (read them when you need them).
Routing is Expo Router (thin route files in `app/`, screen logic in `src/screens/`); patterns, UI text and forbidden
APIs: `docs/expo.md`. Done = `bun run verify` exits 0 (`AGENTS.md`).

1. **Visual values only from `src/theme`.** No raw hex, no magic spacing, radii or font sizes in components and
   screens; shadows are `...shadows.card | cardRaised | selected | floating` (iOS and Android in one). Missing a
   value? Add a token to `tokens.ts` instead of writing it inline.
2. **Text through `Text` / `Heading`** (`variant` + `color`), never the bare `Text` from `react-native`. One typeface
   for the whole app: Schibsted Grotesk (the `label*` and `chip` variants are the same face, uppercase).
3. **Reuse `src/components` first.** A new component follows `Button.tsx`: one file `src/components/<Name>.tsx`
   exported from `src/components/index.ts`, typed props with a short doc comment, `StyleSheet.create`, variants as
   union types, `Pressable` (not `TouchableOpacity`) with pressed/disabled states and `tapFeedback()` on press-in.
4. **Layout:** a screen is `Screen` (background, `layout.screenPaddingX` at the sides, top `insets.top +
   layout.screenTopOffset`). Insets come from `react-native-safe-area-context`; never draw a fake status bar.
   The bottom CTA goes last, after a `flex: 1` spacer.
5. **Icons:** `lucide-react-native` through `Icon` (default `strokeWidth` 1.8, colors from tokens). Name mapping:
   `COMPONENTS.md → Icon`.
6. **Accessibility:** touch target ≥ 44 dp (`layout.minTouchTarget`, smaller elements get `hitSlop`), an accessible
   label on icon buttons, roles `radio`/`radiogroup`, `switch`, `tab`/`tablist` as in the spec.
7. **UI copy** is Polish, taken from the designs (no new wording without need), and lives only in `src/texts.ts`.
   Sample data from the designs becomes props or API data.
8. **No heavy UI libraries** (NativeBase, Paper, Tamagui…): the components are our own.
9. **Spec vs code:** when the code looks different from `COMPONENTS.md`, report it; do not silently change the look.
