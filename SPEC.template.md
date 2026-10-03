# SPEC: <nazwa aplikacji>

> Skopiuj do `SPEC.md`. Kryteria akceptacji są jednocześnie scenariuszami E2E —
> każde kryterium = jeden `test(...)` w `apps/app/e2e/<obszar>.spec.ts`, napisany PRZED implementacją.

## 1. Cel i użytkownicy
- Problem:
- Główny użytkownik:
- Poza zakresem (świadomie):

## 2. Model danych
Każda tabela ma właściciela (`user_id`) albo jawnie opisany model dostępu.

| Tabela | Pole | Typ | Wymagane | Walidacja (Zod) | Uwagi |
|---|---|---|---|---|---|
| notes | title | text | tak | 1–200 znaków, trim | |
| notes | body | text | nie | ≤ 10 000 znaków | domyślnie "" |

Relacje / kaskady:

## 3. API (Hono RPC)
| Metoda | Ścieżka | Wejście (schemat z `@app/shared`) | Odpowiedzi | Autoryzacja |
|---|---|---|---|---|
| GET | /api/notes | — | 200 Note[] | zalogowany, tylko własne |
| POST | /api/notes | noteCreateSchema | 201 Note, 400 | zalogowany |

## 4. Ekrany
| Trasa | Typ | Opis | Stany (ładowanie / pusty / błąd) |
|---|---|---|---|
| / | marketing (prerender) | | — |
| /app | aplikacja (wymaga sesji) | | |

## 5. Kryteria akceptacji (= scenariusze E2E)
Format: **Given / When / Then**. Nazwa testu = identyfikator kryterium.

- [ ] **AC-1 rejestracja i pierwsza notatka**
  Given nowy użytkownik, When rejestruje się i dodaje notatkę "X", Then po odświeżeniu strony widzi "X".
- [ ] **AC-2 izolacja danych**
  Given notatka użytkownika A, When użytkownik B otwiera listę, Then jej nie widzi (test integracyjny: 404 dla cudzego id).
- [ ] **AC-3 ...**

## 6. Wymagania niefunkcjonalne
- Platformy: Android i iOS (natywnie, Expo), web (statyczny HTML + hydratacja) — jeden kod.
- Wydajność / dostępność / i18n:

## 7. Otwarte pytania
-