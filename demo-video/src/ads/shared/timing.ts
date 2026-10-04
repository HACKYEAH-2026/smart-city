/**
 * An ad's timeline: one scene per voice-over beat, as long as its narration plus room to breathe. Until a beat is
 * recorded, word times are an estimate of a calm Polish read (the casting takes ran at about 14 letters a second);
 * a recorded take replaces the estimate and the scenes follow it.
 */
export const FPS = 30;

const LETTERS_PER_SECOND = 14;
const WORD_GAP = 0.05;
const PAUSE_AFTER: Record<string, number> = { ",": 0.2, ":": 0.3, ".": 0.45 };
/** An ElevenLabs audio tag in the script ("[pause]") is not read aloud; a pause tag holds the narration this long. */
const TAG_PAUSE = 0.7;
const isTag = (token: string) => /^\[.*\]$/.test(token);

/** A beat of the narration (an ad's script.ts): the scene it times and what the narrator reads. */
export type Beat = { id: string; text: string };
/** Frames of picture before the first word and after the last one. */
export type Room = { lead: number; tail: number };
/** A spoken word; frames are relative to the start of its scene. */
export type Word = { text: string; key: string; from: number; to: number };
export type Scene = { id: string; text: string; from: number; duration: number; voFrom: number; words: Word[] };

/** Lowercase letters and digits only, for matching a cue to a word ("Miejsce:" → "miejsce"). */
export const wordKey = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

const letters = (token: string) => wordKey(token).length;
const pauseAfter = (token: string) => PAUSE_AFTER[token.at(-1) ?? ""] ?? 0;

/** Estimated word times (seconds from the first word) for a beat read at LETTERS_PER_SECOND. */
const estimate = (text: string) =>
  text
    .split(/\s+/)
    .filter(Boolean)
    .reduce<{ at: number; words: { text: string; start: number; end: number }[] }>(
      ({ at, words }, token) => {
        if (isTag(token)) return { at: at + TAG_PAUSE, words };
        const end = at + letters(token) / LETTERS_PER_SECOND;
        return { at: end + WORD_GAP + pauseAfter(token), words: [...words, { text: token, start: at, end }] };
      },
      { at: 0, words: [] },
    ).words;

const scene = (beat: Beat, room: Room, from: number): Scene => {
  const words = estimate(beat.text).map((w) => ({
    text: w.text,
    key: wordKey(w.text),
    from: room.lead + Math.round(w.start * FPS),
    to: room.lead + Math.round(w.end * FPS),
  }));
  const spoken = words.at(-1)?.to ?? room.lead;
  return { id: beat.id, text: beat.text, from, duration: spoken + room.tail, voFrom: room.lead, words };
};

/** The scenes of an ad, back to back, and its length in frames. */
export const timeline = <B extends Beat>(beats: readonly B[], room: Record<B["id"], Room>) => {
  const scenes = beats.reduce<Scene[]>((list, beat) => {
    const last = list.at(-1);
    list.push(scene(beat, room[beat.id as B["id"]], last ? last.from + last.duration : 0));
    return list;
  }, []);
  return { scenes, duration: scenes.reduce((sum, s) => sum + s.duration, 0) };
};
