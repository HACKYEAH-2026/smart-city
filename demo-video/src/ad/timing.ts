import { BEATS, type BeatId } from "./script";

/**
 * The ad's timeline: one scene per voice-over beat (script.ts), as long as its narration plus room to breathe.
 * Until the narration is recorded, word times are an estimate of a calm Polish read (the casting takes ran at
 * about 14 letters a second); a recorded take replaces the estimate and the scenes follow it.
 */
export const FPS = 30;

const LETTERS_PER_SECOND = 14;
const WORD_GAP = 0.05;
const PAUSE_AFTER: Record<string, number> = { ",": 0.2, ":": 0.3, ".": 0.45 };

/** Frames of picture before the first word and after the last one, per scene. */
const ROOM: Record<BeatId, { lead: number; tail: number }> = {
  hook: { lead: 40, tail: 24 },
  problem: { lead: 12, tail: 30 },
  reveal: { lead: 24, tail: 30 },
  join: { lead: 16, tail: 24 },
  report: { lead: 16, tail: 30 },
  duplicate: { lead: 16, tail: 30 },
  city: { lead: 16, tail: 30 },
  announce: { lead: 16, tail: 30 },
  plugins: { lead: 16, tail: 30 },
  outro: { lead: 16, tail: 90 },
};

/** A spoken word; frames are relative to the start of its scene. */
export type Word = { text: string; key: string; from: number; to: number };
export type Scene = { id: BeatId; text: string; from: number; duration: number; voFrom: number; words: Word[] };

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
        const end = at + letters(token) / LETTERS_PER_SECOND;
        return { at: end + WORD_GAP + pauseAfter(token), words: [...words, { text: token, start: at, end }] };
      },
      { at: 0, words: [] },
    ).words;

const scene = (beat: (typeof BEATS)[number], from: number): Scene => {
  const room = ROOM[beat.id];
  const words = estimate(beat.text).map((w) => ({
    text: w.text,
    key: wordKey(w.text),
    from: room.lead + Math.round(w.start * FPS),
    to: room.lead + Math.round(w.end * FPS),
  }));
  const spoken = words.at(-1)?.to ?? room.lead;
  return { id: beat.id, text: beat.text, from, duration: spoken + room.tail, voFrom: room.lead, words };
};

export const SCENES = BEATS.reduce<Scene[]>((list, beat) => {
  const last = list.at(-1);
  return [...list, scene(beat, last ? last.from + last.duration : 0)];
}, []);

export const DURATION = SCENES.reduce((sum, s) => sum + s.duration, 0);
