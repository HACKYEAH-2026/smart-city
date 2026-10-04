/**
 * The "needs" ad, second cut: every community needs something else, and the app fits each one. Changes from the
 * first cut (src/ads/needs): the opening adds a fourth panel, „i więcej”; the city asks for features and answers
 * each at once while its dashboard gets them; the builder ends with „Opublikuj w miejscu” and the new plugin
 * reaching every member's dashboard. One beat per scene, read in one take (`bun run vo needs-2`). Only the issues,
 * announcements and discussions plugins ship today; the civic budget and the room booking are examples of plugins a
 * place adds with the AI plugin builder (ROADMAP.md). An audio tag such as `[pause]` is not read aloud; the voice
 * pauses there, and so does the timing estimate.
 */
export const BEATS = [
  {
    id: "intro",
    text: "Miasto, uczelnia, spółdzielnia mieszkaniowa i wiele więcej. Każda społeczność ma swoje potrzeby.",
  },
  { id: "promise", text: "Twoje Miejsce to jedna aplikacja, która dopasowuje się do każdej z nich." },
  {
    id: "city",
    text: "Miasto. Budżet obywatelski? [pause] Mamy to! Lokalne ogłoszenia? [pause] Się robi! Zgłoszenia zagrożeń? [pause] Nie ma sprawy!",
  },
  { id: "campus", text: "Uczelnia może udostępnić rezerwację sal, a dziekanat widzi grafik." },
  { id: "coop", text: "Spółdzielnia zbiera zgłoszenia usterek, a AI łączy duplikaty." },
  { id: "builder", text: "Czegoś brakuje? Administrator opisuje funkcję, a AI pisze rozszerzenie." },
  { id: "publish", text: "Jedno kliknięcie i działa u wszystkich. Na żywo." },
  {
    id: "outro",
    text: "Twój dom. [pause] Twoje osiedle. [pause] Twoje miasto. [pause] Twoje Miejsce. Rośnie razem z Twoimi potrzebami.",
  },
] as const;
