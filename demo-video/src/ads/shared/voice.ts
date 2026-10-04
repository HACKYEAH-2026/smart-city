/** ElevenLabs voice for every ad's take (a shared-library voice works by its id, without adding it to the account). */
export const VOICE = {
  voiceId: "o2xdfKUpc1Bwq7RchZuW", // Piotr: warm, low, native Polish ("Engaging, Reassuring Storyteller")
  modelId: "eleven_v4",
  settings: { stability: 0.5, similarity_boost: 0.8, speed: 1 },
  seed: 7,
  /**
   * Words the narrator says differently from how the script writes them, one word for one (Polish TTS reads "AI"
   * as "a i"). The take is recorded from the respelled text; its word times keep the script's words.
   */
  say: { AI: "ej-aj" } as Record<string, string>,
};
