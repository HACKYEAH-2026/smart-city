/**
 * The "needs" ad's voice-over: every community needs something else, and the app fits each one. One beat per
 * scene, read in one take (scripts/voiceover.ts, `bun run vo needs`); the take's timestamps time the video.
 * Only the issues plugin ships today; the civic budget and the room booking are examples of plugins a place adds
 * (the AI plugin builder writes them), so the narration says what a place "może" do, not what it already does.
 * An audio tag such as `[pause]` is not read aloud; the voice pauses there, and so does the timing estimate.
 */
export const BEATS = [
  { id: "intro", text: "Miasto, uczelnia, spółdzielnia mieszkaniowa. Każda społeczność ma swoje potrzeby." },
  { id: "promise", text: "Twoje Miejsce to jedna aplikacja, która dopasowuje się do każdej z nich." },
  { id: "city", text: "Miasto może prowadzić budżet obywatelski, a mieszkańcy głosują w aplikacji." },
  { id: "campus", text: "Uczelnia może udostępnić rezerwację sal, a dziekanat widzi grafik." },
  { id: "coop", text: "Spółdzielnia zbiera zgłoszenia usterek, a AI łączy duplikaty." },
  { id: "builder", text: "Czegoś brakuje? Administrator opisuje funkcję, a AI pisze rozszerzenie." },
  {
    id: "outro",
    text: "Twój dom. [pause] Twoje osiedle. [pause] Twoje miasto. [pause] Twoje Miejsce. Rośnie razem z Twoimi potrzebami.",
  },
] as const;
