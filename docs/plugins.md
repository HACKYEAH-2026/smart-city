# Wtyczki

Każda funkcja społeczności (zgłoszenia, inicjatywy, głosowania…) to wtyczka. Rdzeń zna tylko
społeczności, użytkowników i instalacje; resztę dostarczają wtyczki.

## Jak to działa

```
 Wtyczka (API, Bun)                         Aplikacja (Expo: iOS / Android / web)
 views.list(ctx) ──► { type: "Screen", … } ──► PluginRenderer ──► natywne prymitywy z ui.tsx
 tools.report    ◄── POST …/tools/report  ◄── przycisk / formularz (akcja = dane, nie kod)
```

- **Server-Driven UI.** Widok wtyczki zwraca drzewo węzłów z zamkniętego katalogu
  (`packages/sdk/src/ui.ts`, pakiet `@app/plugin-sdk`). Aplikacja nigdy nie wykonuje kodu wtyczki, więc nowa
  wtyczka nie wymaga nowego wydania aplikacji, a każda wygląda spójnie i jest dostępna (WCAG).
- **Akcje to dane:** `navigate` (inny widok tej wtyczki) albo `tool` (wywołanie narzędzia
  z danymi formularza). Wynik narzędzia: `{ toast?, navigate?, refresh? }`.
- **Izolacja danych:** `ctx.storage` jest ograniczony do jednej instalacji (wtyczka × społeczność).
  Wtyczka nie widzi bazy, plików ani danych innych społeczności i wtyczek.
- **Walidacja na granicy:** manifest, wejście narzędzi (Zod) i zwracane UI są sprawdzane przez hosta.
  Błąd wtyczki daje `500 plugin_error` dla tego żądania, reszta API działa dalej.

## Pisanie wtyczki

Moduł eksportuje domyślnie funkcję, która dostaje SDK od hosta. W runtime niczego nie importuje
(tylko `import type`), dzięki czemu ten sam plik działa jako wtyczka wbudowana i wgrana w locie.

```ts
import type { PluginModule } from "@app/shared";

const benches: PluginModule = ({ definePlugin, ui, z }) =>
  definePlugin({
    id: "benches",               // [a-z][a-z0-9-], unikalne
    name: "Ławki",
    version: "1.0.0",
    icon: "🪑",
    permissions: ["storage"],    // bez tego ctx.storage rzuca błąd
    nav: [{ view: "main", label: "Ławki" }],
    views: {
      main: async (ctx) => ui.screen("Ławki w parkach", [ /* węzły */ ]),
    },
    tools: {
      report: {
        description: "Zgłoś zepsutą ławkę",           // także dla asystentów AI (MCP)
        input: z.object({ park: z.string().min(1) }),
        handler: async (ctx, input) => {
          await ctx.storage.add("benches", input);
          return { toast: "Dziękujemy!", refresh: true };
        },
      },
    },
  });

export default benches;
```

Każda wtyczka to pakiet w `plugins/<id>/` zależny **tylko** od `@app/plugin-sdk` — import czegokolwiek
z `apps/api` nie przejdzie typechecku. Wzorce: `plugins/issues` (wbudowana) i `plugins/benches` (wgrywana w locie).

### Testy wtyczki (bez API i bazy)

```ts
import { testPlugin, textsOf } from "@app/plugin-sdk/testing";
import issues from "./index";

const t = testPlugin(issues, { user: { id: "alice", name: "Alice" } });
const res = await t.tool("report", { title: "Latarnia", category: "lighting" }); // walidacja Zod jak w hoście
expect(textsOf(await t.view("detail", res.navigate!.params))).toContain("Latarnia");
await t.as({ id: "bob", name: "Bob" }).tool("upvote", { id: res.navigate!.params!.id! }); // ten sam magazyn
```

### Katalog komponentów

| Węzeł | Builder | Uwagi |
|---|---|---|
| Screen | `ui.screen(title, children)` | zawsze korzeń widoku |
| Stack / Row | `ui.stack([...])`, `ui.row([...])` | układ pionowy / zawijany wiersz |
| List | `ui.list(label, items)` | `role="list"`, dzieci jako `listitem` |
| Card | `ui.card({ title, subtitle?, badge?, onPress?, children? })` | z `onPress` jest przyciskiem |
| Heading / Text | `ui.heading(text, 2\|3)`, `ui.text(text, "soft"?)` | |
| Badge | `ui.badge(text, tone?)` | tone: neutral, info, success, warning, danger |
| Button | `ui.button(label, action, variant?)` | variant: primary, quiet, danger |
| Progress / Stat | `ui.progress({ value, max, label })`, `ui.stat(label, value)` | |
| Empty | `ui.empty(text)` | pusty stan |
| Form | `ui.form({ submitLabel, submit: ui.tool(name), children })` | wartości pól trafiają do `args` narzędzia |
| TextInput / Select | `ui.textInput({ name, label, multiline?, value? })`, `ui.select({ name, label, options, value? })` | tylko wewnątrz Form |

Nowy komponent: schemat w `ui.ts` + builder w `ui` + gałąź w `apps/app/src/plugins/Renderer.tsx`.
Starsza aplikacja pokaże w miejscu nieznanego węzła komunikat zamiast się wywrócić.

## Instalowanie

**Wbudowana:** pakiet w `plugins/` + zależność w `apps/api/package.json` + wpis w `apps/api/src/plugins/builtin/index.ts`.

**W locie (bez restartu):** API administracyjne, chronione `PLUGIN_ADMIN_TOKEN`
(bez tej zmiennej w env całe `/api/admin/*` zwraca 404).

```bash
bun run dev                                                             # API :4000 + aplikacja
bun run plugin:upload plugins/benches krakow   # wgraj i włącz w społeczności
```

Otwarta aplikacja odpytuje nawigację co 5 s, więc nowa funkcja pojawia się bez przeładowania.
Kod wgranej wtyczki jest zapisywany w bazie (`plugin_sources`) i ładowany ponownie po restarcie.

| Endpoint | Opis |
|---|---|
| `POST /api/admin/plugins` `{ source }` | wgraj / podmień wtyczkę (walidacja manifestu, widoków, narzędzi) |
| `GET /api/admin/plugins` | lista załadowanych wtyczek |
| `POST /api/admin/communities` `{ slug, name }` | nowa społeczność |
| `POST /api/admin/communities/:slug/plugins` `{ pluginId }` | włącz wtyczkę w społeczności |
| `GET /api/communities/:slug/nav` | nawigacja (dla aplikacji) |
| `GET /api/communities/:slug/plugins/:id/views/:view?…` | drzewo UI widoku |
| `POST /api/communities/:slug/plugins/:id/tools/:tool` `{ args }` | wywołanie narzędzia |

## Bezpieczeństwo (stan obecny i dalej)

Wgrana wtyczka wykonuje się **w procesie API** — to model „zaufany administrator”: token
`PLUGIN_ADMIN_TOKEN` daje pełne zaufanie. Kontrakt jest jednak od początku zaprojektowany pod izolację:
moduł nic nie importuje, a cały dostęp idzie przez asynchroniczny `ctx`. Przeniesienie wtyczek do
Workera albo sandboxa WebAssembly to zmiana transportu `ctx` w hoście, bez zmian w kodzie wtyczek.

Dalej: członkostwo i weryfikacja (`requires: "verified"` w narzędziach), narzędzia wtyczek jako
serwer MCP (opis + `z.toJSONSchema(input)` są już w kontrakcie), izolacja wtyczek zewnętrznych.
