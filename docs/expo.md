# Frontend: Expo / React Native patterns — for agents

**Versions: Expo SDK 57 · React Native 0.86 · React 19.2 · Expo Router 57 · react-native-web 0.21 · TanStack Query 5.**
This is NOT React DOM. The same code renders native views (iOS/Android) and HTML (web, static export).

## Model
- Elements: `View`, `Text`, `Pressable`, `TextInput`, `ScrollView`, `Image`. All text MUST be inside `<Text>`.
- Styles: `StyleSheet.create` + tokens from `src/theme/` (`tokens.ts`, design system; spec in `src/COMPONENTS.md`). Flexbox defaults to `flexDirection: "column"`.
- Responsiveness: `flexWrap` + `flexBasis`/`flexGrow` (works in static HTML). Do NOT make the layout depend on
  `useWindowDimensions` — the prerender does not know the screen width.

## Semantics (web = accessibility + E2E selectors)
Use the components from `src/components/` (design system); they set these for you:
| You want | Use | On the web |
|---|---|---|
| heading | `<Heading level={1..3}>` (`role="heading"`, `aria-level`) | `<h1>`–`<h3>` |
| internal link | `<Link href="/app">` (Expo Router `Link`) | `<a href>` |
| button | `<Button label=… onPress=…>` (`role="button"`) | `<button>` |
| form field | `<TextField label=…>` (`aria-label`) | `<input aria-label>` |
| list | `<View role="list" aria-label=…>` + `role="listitem"` | `<ul>`/`<li>` |
| error message | `<Text variant="bodyL" color="primaryPressed" role="alert">` | `role="alert"` |

## Routing (Expo Router)
- Files in `app/` = routes. Keep them thin (`export { default } from "../src/screens/X"`).
- Session-guarded layout: `app/app/_layout.tsx` (`<Redirect href="/login" />`, then a `<Stack>` of the /app screens).
- Navigation in code: `const router = useRouter(); router.replace("/app")`. Links: `<Link>`.
- 404: `app/+not-found.tsx` (becomes `404.html` in the web build).
- `<Head>` from `expo-router/head` on every screen: `<title>` ends up in the static HTML.

## Transitions (screens and sections)
- Screens move through the Expo Router `<Stack>`: the root (`app/_layout.tsx`) and `/app` (`app/app/_layout.tsx`).
  Default `animation: "slide_from_right"`; the bottom bar's sections (`index`, `account`) use `fade`; the QR scanner
  (`scan`) uses `slide_from_bottom`. `animationDuration: 250` is iOS only (Android keeps the system duration).
- A new screen needs no entry: it slides in from the right. A different animation goes into the layout as
  `<Stack.Screen name="..." options={{ animation: "..." }} />`.
- Going forward: `router.push` or `<Link href>` (the stack grows, back works). Going back: `goBack(router, fallback)`
  from `src/lib/navigation.ts`, never `router.replace`, so the screen slides back the way it came. `replace` only
  where the flow must not stack: after sign-in or sign-out, after creating or joining a place, bottom bar tabs.
- Sections that change inside one screen (code / link tabs, segments): wrap the changing part in
  `<Animated.View key={value} entering={sectionEntering("fromLeft" | "fromRight")}>` from `src/lib/motion.ts`.
  It works on every platform; the side is the direction the new content comes from.
- Web: the router's stack does not animate screens (react-native-screens has no web transitions). Do not add
  web-only animation hacks without agreeing it first.
- Do not use `react-native-screen-transitions`: its expo-router integration crashes the static web export
  (`Cannot access ... before initialization` during SSR, a worklet closure bug in 4.0.0 and 4.1.0-rc.0).
  Revisit only after the web export builds with it.
- Keep motion short (about 250 ms) and do not animate lists or every item.
- E2E cannot see the motion. A screen that has just been entered can still be animating: wait for the final layout
  with `expect.poll`. The previous screen stays mounted in the stack, so a text that appears on both screens matches
  twice: scope it with `exact: true` or take the newest match (`.last()`), with a comment.

## Data (the only pattern)
```ts
export const communitiesKey = ["communities"] as const;
export const useCommunities = () =>
  useQuery({ queryKey: communitiesKey, queryFn: () => parseResponse(api.api.communities.$get()) });
// Mutation: useMutation({ mutationFn, onSuccess: () => qc.invalidateQueries({ queryKey }) }) — full example
// in src/data/communities.ts (calling a plugin tool).
```
- Client: only `api` from `src/lib/api.ts` (Hono RPC, types from the backend). Do not write `fetch` by hand.
  The single exception is the multipart photo upload in `src/lib/upload.ts`.
- Session: `useSession()` / `useAuthActions()` (`src/data/session.ts`). After a session change use `fetchQuery`,
  not just `invalidateQueries`.
- Token: bearer in Keychain/Keystore (native) or localStorage (web) — via `src/lib/storage.ts`.

## UI text (src/texts.ts)
- The app is Polish only (no i18n). All UI text: `src/texts.ts`. Usage: `import { t } from "../texts"; t.communities_title`.
- E2E selects by the same texts (`import { t } from "../src/texts"`).
- Messages from the API/Zod/Better Auth never reach the UI directly; show your own `t.*`.
  Plugin screens are the exception: their (Polish) content comes from the server as Server-Driven UI.

## Native
- `android/` and `ios/` are generated by `expo prebuild` from `app.config.ts` — do not edit by hand, do not commit.
- Android phone over USB (USB debugging on) or emulator: `just dev`. Its `usb` proc (`scripts/adb-reverse.ts`) runs
  `adb reverse` for :4000 and :8081 and Expo starts with `--localhost`, so the device's `localhost` is this machine
  and the default API URL works; press `a` in the `app` pane (installs a matching Expo Go if needed).
  Phone over Wi-Fi instead: `bunx expo start --lan` in `apps/app` with `EXPO_PUBLIC_API_URL=http://<LAN IP>:4000`.
- Native modules only from the Expo SDK or with a config plugin; after adding one run `bunx expo install --check`.
- Keyboard: `Screen` scrolls with `KeyboardAwareScrollView` (react-native-keyboard-controller, also in Expo Go), so a
  focused field and the button below it stay above the keyboard. Forms inside `Screen` need nothing more; do not add
  your own `KeyboardAvoidingView`. `dev` starts Metro with `--clear`: the Metro cache in `$TMPDIR` is shared between
  projects, and a stale transform from a project with another react-native-worklets version breaks worklets.
- Haptics: pressable controls call `tapFeedback()` from `src/lib/haptics.ts` in `onPressIn` (a light tick; none on
  the web). `Button`, `Checkbox` and `RadioCard` already do; a new pressable component does the same.
- Edge-to-edge: content is drawn under the status and navigation bars and `Screen` pads by the safe-area insets.
  Expo Go does not report edge-to-edge, so `app/_layout.tsx` tells `KeyboardProvider` the bars are translucent.
- Push notifications (`src/lib/push.ts`, `src/data/push.ts`; web: `push.web.ts`, no pushes): after sign-in the phone
  registers its Expo push token with the API; a tapped push opens the plugin view. They need `EXPO_PROJECT_ID`
  (expo.dev project) and, on Android, `google-services.json` from Firebase (FCM) — see `app.config.ts`. The FCM
  service-account key (Android) and the APNs key (iOS) are uploaded to the Expo project, never to the repo.
  Expo Go on Android has no pushes and `expo-notifications` throws on import there, so `src/lib/push.ts` loads it
  lazily and skips it in Expo Go (the app runs, without pushes). Pushes on Android: the dev build (`android:debug`).
- Google sign-in (`src/lib/google.ts`, `useGoogleClientIds`/`signInWithGoogle` in `src/data/session.ts`; web:
  `google.web.ts`, none): the native account picker (`@react-native-google-signin/google-signin`) returns an ID token
  issued to the web client ID, `authClient.signIn.social({ idToken })` turns it into our bearer session, and the first
  sign-in creates the account. The client IDs come from the API (`GET /api/auth-providers`, from `GOOGLE_CLIENT_ID`
  and `GOOGLE_IOS_CLIENT_ID` in its env; locally `apps/api/.env`, read by `just dev`). Expo Go does not ship the
  native module, so the button is hidden there: use the dev build (`android:debug`). Google Cloud project, three
  OAuth clients: "Web application" (its ID is `GOOGLE_CLIENT_ID`; no secret, origins or redirect URIs needed),
  "Android" (package `pl.twojemiejsce.app` + SHA-1 of the signing key; dev builds use the `debug.keystore` that
  prebuild generates, SHA-1 `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`; release builds need
  their key's SHA-1) and "iOS" (bundle ID `pl.twojemiejsce.app`; `GOOGLE_IOS_CLIENT_ID` is also needed when
  building the app, for the URL scheme in `app.config.ts`). `DEVELOPER_ERROR` on Android = this package/SHA-1 pair
  is not registered in the project.

## Forbidden (common hallucinations)
- React DOM: `<div>`, `<span>`, `<p>`, `<button>`, `<input>`, `className`, `onClick`, `onChange` on inputs
  (in RN: `onPress`, `onChangeText`), CSS in `.css` files, `px`/`rem`/`%` units in strings where RN expects numbers.
- `window`, `document`, `localStorage` outside `src/lib/` (they do not exist natively or in the prerender).
- `react-router`, `next/*`, `@react-navigation/*` directly (routing = Expo Router).
- `AsyncStorage` for tokens (insecure) — only `src/lib/storage.ts`.
- Packages without React Native/web support (DOM-only UI kits).
- Editing `android/`/`ios/` by hand, `expo eject` (does not exist), EAS as a requirement (builds run locally in CI).
