/**
 * The "problems" ad's voice-over: it opens on what goes wrong in a city today. One beat per scene, read in one
 * take (scripts/voiceover.ts); the take's timestamps time the video, so a changed line only needs `bun run vo
 * problems` and the scenes follow. Only what the app really does (PRODUCT.md: no invented numbers). The plugin
 * builder (Zarządzaj miejscem → „Stwórz rozszerzenie z AI”) is the hero: a place that misses a feature adds it
 * from inside the app. `text` is what the narrator reads: spell a word the way it should sound if the voice gets
 * it wrong. An audio tag such as `[pause]` is not read aloud; the voice pauses there, and so does the estimate.
 */
export const BEATS = [
  {
    id: "open",
    text: "Latarnia, która nie świeci. Dziura w chodniku. Ogłoszenie, którego nikt nie zobaczył.",
  },
  { id: "problem", text: "Lokalne sprawy giną w grupach i formularzach." },
  {
    id: "reveal",
    text: "Twoje Miejsce. Jedna aplikacja dla każdej społeczności: miasta, osiedla, uczelni.",
  },
  { id: "join", text: "Skanujesz kod i jesteś w środku." },
  {
    id: "report",
    text: "Problem zgłaszasz zdjęciem. AI wykrywa duplikaty, więc urząd widzi jedno zgłoszenie i to, ile osób je zgłasza.",
  },
  {
    id: "city",
    text: "A status zmienia się na Twoich oczach: przyjęte, naprawione.",
  },
  {
    id: "builder",
    text: "Brakuje funkcji? Administrator opisuje ją własnymi słowami. AI pisze rozszerzenie, sprawdza je i pokazuje szkic. Jedno kliknięcie i działa u wszystkich użytkowników.",
  },
  {
    id: "outro",
    text: "Twój dom. [pause] Twoje osiedle. [pause] Twoje miasto. [pause] Twoje Miejsce.",
  },
] as const;

export type BeatId = (typeof BEATS)[number]["id"];
