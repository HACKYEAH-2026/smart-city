/**
 * The "needs" ad's voice-over: every community needs something else, and the app fits each one. One beat per
 * scene, read in one take (scripts/voiceover.ts, `bun run vo needs`); the take's timestamps time the video.
 * Only the issues plugin ships today; the civic budget and the room booking are examples of plugins a place adds
 * (the AI plugin builder writes them), so the narration says what a place "może" do, not what it already does.
 * An audio tag such as `[pause]` is not read aloud; the voice pauses there, and so does the timing estimate.
 */
export const BEATS = [
  {
    id: "intro",
    text: "Miasto, uczelnia, spółdzielnia mieszkaniowa. Każda społeczność ma inne sprawy i potrzebuje innych narzędzi.",
  },
  {
    id: "promise",
    text: "Twoje Miejsce to jedna aplikacja, która dopasowuje się do miejsca. Każde włącza tylko to, czego potrzebuje.",
  },
  {
    id: "city",
    text: "Miasto może prowadzić budżet obywatelski: mieszkańcy głosują w aplikacji, a wyniki widać na pulpicie.",
  },
  {
    id: "campus",
    text: "Uczelnia może udostępnić rezerwację sal: student wybiera salę i godzinę, a dziekanat widzi grafik.",
  },
  {
    id: "coop",
    text: "Spółdzielnia zbiera zgłoszenia usterek ze zdjęciem, a AI łączy zgłoszenia tego samego problemu.",
  },
  {
    id: "builder",
    text: "A gdy czegoś brakuje, administrator opisuje funkcję własnymi słowami, a AI pisze rozszerzenie i je sprawdza.",
  },
  { id: "outro", text: "Twój dom. [pause] Twoje osiedle. [pause] Twoje miasto. [pause] Twoje Miejsce." },
] as const;
