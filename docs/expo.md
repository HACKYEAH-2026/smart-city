# Frontend: wzorce Expo / React Native — dla agentów

**Wersje: Expo SDK 57 · React Native 0.86 · React 19.2 · Expo Router 57 · react-native-web 0.21 · TanStack Query 5.**
To NIE jest React DOM. Ten sam kod renderuje natywne widoki (iOS/Android) i HTML (web, statyczny eksport).

## Model
- Elementy: `View`, `Text`, `Pressable`, `TextInput`, `ScrollView`, `Image`. Każdy tekst MUSI być w `<Text>`.
- Style: `StyleSheet.create` + tokeny z `src/theme.ts`. Flexbox domyślnie `flexDirection: "column"`.
- Responsywność: `flexWrap` + `flexBasis`/`flexGrow` (działa w statycznym HTML). NIE uzależniaj układu od
  `useWindowDimensions` na stronach marketingowych — prerender nie zna szerokości ekranu.

## Semantyka (web = SEO + dostępność + selektory E2E)
Używaj prymitywów z `src/components/ui.tsx`, które ustawiają to za Ciebie:
| Chcesz | Użyj | Na webie |
|---|---|---|
| nagłówek | `<Heading level={1..3}>` (`role="heading"`, `aria-level`) | `<h1>`–`<h3>` |
| link wewnętrzny | `<AppLink href="/about">` (Expo Router `Link`) | `<a href>` (+ prefiks `/pl` dla stron marketingowych) |
| przycisk | `<Button label=… onPress=…>` (`role="button"`) | `<button>` |
| pole formularza | `<TextField label=…>` (`aria-label`) | `<input aria-label>` |
| lista | `<View role="list" aria-label=…>` + `role="listitem"` | `<ul>`/`<li>` |
| komunikat błędu | `<Body tone="error" role="alert">` | `role="alert"` |

## Routing (Expo Router)
- Pliki w `app/` = trasy. Trzymaj je cienkie (`export { default } from "../src/screens/X"`).
- Layout z ochroną sesji: `app/app/_layout.tsx` (`<Redirect href="/login" />`, `<Slot />`).
- Nawigacja w kodzie: `const router = useRouter(); router.replace("/app")`. Linki: `<AppLink>`.
- 404: `app/+not-found.tsx` (w buildzie web staje się `404.html`).
- `<Head>` z `expo-router/head` na każdym ekranie: `<title>` i `description` trafiają do statycznego HTML.

## Dane (jedyny wzorzec)
```ts
export const notesKey = ["notes"] as const;
export const useNotes = () => useQuery({ queryKey: notesKey, queryFn: () => parseResponse(api.api.notes.$get()) });
export function useCreateNote() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (i: NoteCreate) => parseResponse(api.api.notes.$post({ json: i })),
    onSuccess: () => qc.invalidateQueries({ queryKey: notesKey }) });
}
```
- Klient: tylko `api` z `src/lib/api.ts` (Hono RPC, typy z backendu). Nie pisz `fetch` ręcznie.
- Sesja: `useSession()` / `useAuthActions()` (`src/data/session.ts`). Po zmianie sesji `fetchQuery`, nie samo `invalidateQueries`.
- Token: bearer w Keychain/Keystore (natywnie) lub localStorage (web) — przez `src/lib/storage.ts`.

## i18n (Paraglide JS)
- Teksty: `messages/en.json` (bazowy) i `pl.json`. Kompilacja: `bun run --cwd apps/app i18n` (robią to dev/build/typecheck/E2E).
- Użycie: `const { t, locale, setLocale } = useI18n(); t.notes_title()`. NIE importuj `m` z paraglide w ekranach.
- Język: web + strony marketingowe → z URL (`/`, `/about` = en; `/pl`, `/pl/about` = pl); reszta → preferencja
  (zapisana) → język urządzenia → en. Nowa strona marketingowa: dopisz ścieżkę do `MARKETING_PATHS` i dodaj plik w `app/pl/`.
- Komunikaty z API/Zod/Better Auth nie trafiają do UI wprost; pokazuj własny `t.*`.

## Natywne
- `android/`, `ios/` generuje `expo prebuild` z `app.config.ts` — nie edytuj ręcznie, nie commituj.
- Emulator Androida nie widzi `localhost` hosta: `EXPO_PUBLIC_API_URL=http://10.0.2.2:4000`.
- Moduły natywne tylko z Expo SDK albo z config pluginem; po dodaniu sprawdź `bunx expo install --check`.

## Zakazane (częste halucynacje)
- React DOM: `<div>`, `<span>`, `<p>`, `<button>`, `<input>`, `className`, `onClick`, `onChange` na inputach
  (w RN: `onPress`, `onChangeText`), CSS w plikach `.css`, jednostki `px`/`rem`/`%` w stringach tam, gdzie RN wymaga liczb.
- `window`, `document`, `localStorage` poza `src/lib/` (nie istnieją natywnie ani w prerenderze).
- `react-router`, `next/*`, `@react-navigation/*` bezpośrednio (routing = Expo Router).
- `AsyncStorage` do tokenów (niebezpieczne) — tylko `src/lib/storage.ts`.
- Paczki bez wsparcia React Native/web (DOM-only UI kity).
- Ręczna edycja `android/`/`ios/`, `expo eject` (nie istnieje), EAS jako wymóg (buildy robi CI lokalnie).
