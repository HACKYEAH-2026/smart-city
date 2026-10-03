/**
 * The ad's voice-over: one beat per scene, read in one take (scripts/voiceover.ts). The take's timestamps
 * (vo.json) time the video, so a changed line only needs `bun run vo` and the scenes follow.
 * Only what the app really does (PRODUCT.md: no invented numbers). The plugin builder (Zarządzaj miejscem →
 * „Stwórz plugin z AI”) is the hero: a place that misses a feature adds it from inside the app.
 * `text` is what the narrator reads: spell a word the way it should sound if the voice gets it wrong.
 */
export const BEATS = [
  { id: "open", text: "Latarnia, która nie świeci. Dziura w chodniku. Ogłoszenie, którego nikt nie zobaczył." },
  { id: "problem", text: "Lokalne sprawy giną w grupach i formularzach." },
  { id: "reveal", text: "Twoje Miejsce. Jedna aplikacja dla każdej społeczności: miasta, osiedla, uczelni." },
  { id: "join", text: "Skanujesz kod i jesteś w środku." },
  {
    id: "report",
    text: "Problem zgłaszasz zdjęciem. AI wykrywa duplikaty, więc urząd widzi jedno zgłoszenie i to, ile osób je zgłasza.",
  },
  { id: "city", text: "A status zmienia się na Twoich oczach: przyjęte, naprawione." },
  {
    id: "builder",
    text: "Brakuje funkcji? Administrator opisuje ją własnymi słowami. AI pisze rozszerzenie, sprawdza je i pokazuje szkic. Jedno kliknięcie i działa u wszystkich mieszkańców.",
  },
  { id: "outro", text: "Twój dom. Twoje osiedle. Twoje miasto. Twoje Miejsce." },
] as const;

export type BeatId = (typeof BEATS)[number]["id"];

/** ElevenLabs voice for the take (a shared-library voice works by its id, without adding it to the account). */
export const VOICE = {
  voiceId: "o2xdfKUpc1Bwq7RchZuW", // Piotr: warm, low, native Polish ("Engaging, Reassuring Storyteller")
  modelId: "eleven_v4",
  settings: { stability: 0.5, similarity_boost: 0.8, speed: 1 },
  seed: 7,
};
