/**
 * The ad's voice-over: one beat per scene, read in one take (scripts/voiceover.ts). The take's timestamps
 * (vo.json) time the video, so a changed line only needs `bun run vo` and the scenes follow.
 * Only what the app really does today (PRODUCT.md: no invented numbers, no features from the roadmap).
 * `text` is what the narrator reads: spell a word the way it should sound if the voice gets it wrong.
 */
export const BEATS = [
  { id: "hook", text: "Na Twojej ulicy od tygodnia nie świeci latarnia." },
  {
    id: "problem",
    text: "Piszesz o tym w grupie. Ktoś odpisuje, że już zgłaszał, ktoś inny, że to nic nie da. I sprawa ginie między postami.",
  },
  {
    id: "reveal",
    text: "Poznaj Twoje Miejsce: cyfrową społeczność dla prawdziwego miejsca. Miasta, osiedla, uczelni.",
  },
  { id: "join", text: "Dołączasz kodem QR albo kodem zaproszenia i od razu widzisz, co dzieje się w okolicy." },
  { id: "report", text: "Zgłoszenie to trzy rzeczy: co się stało, kategoria i zdjęcie." },
  {
    id: "duplicate",
    text: "Jeśli ktoś zgłosił to wcześniej, sztuczna inteligencja to zauważy. Zamiast wielu takich samych zgłoszeń miasto dostaje jedno, z licznikiem osób, które widzą problem.",
  },
  {
    id: "city",
    text: "Urząd widzi, co przeszkadza najbardziej. Przyjmuje zgłoszenie, oznacza je jako naprawione, a Ty widzisz każdy krok.",
  },
  { id: "announce", text: "A kiedy miasto ma coś do przekazania, ogłoszenie trafia prosto na pulpit mieszkańców." },
  {
    id: "plugins",
    text: "Każde miejsce włącza tylko potrzebne funkcje. Każda to osobna wtyczka, więc nowe dochodzą bez przebudowy aplikacji.",
  },
  { id: "outro", text: "Na telefonie i w przeglądarce. Twoje Miejsce. Miasto bliżej ludzi." },
] as const;

export type BeatId = (typeof BEATS)[number]["id"];

/** ElevenLabs voice for the take (a shared-library voice works by its id, without adding it to the account). */
export const VOICE = {
  voiceId: "o2xdfKUpc1Bwq7RchZuW", // Piotr: warm, low, native Polish ("Engaging, Reassuring Storyteller")
  modelId: "eleven_v4",
  settings: { stability: 0.5, similarity_boost: 0.8, speed: 1 },
  seed: 7,
};
