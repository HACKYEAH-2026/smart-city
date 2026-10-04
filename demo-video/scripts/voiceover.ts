/**
 * Voice-over for an ad (src/ads/<ad>/script.ts) from ElevenLabs: the whole script in one take with character
 * timestamps, split into beats. Writes public/ads/<ad>/vo.mp3 and src/ads/<ad>/vo.json (beat and word times that
 * time the video), then transcribes the take back (Scribe) and lists the words the narrator dropped or added.
 * Skips the API when the script and the voice are unchanged. Paid per character: run it on purpose.
 * Needs ELEVEN_LABS_API_KEY (repo .env).
 *   bun run vo <ad>                   the take (--force: a new one even if nothing changed); ad: problems, needs
 *   bun run vo <ad> --cast id1,id2    the ad's first beats in other voices → out/casting/<id>.mp3, to compare
 */
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Beat as ScriptBeat } from "../src/ads/shared/timing";
import { VOICE } from "../src/ads/shared/voice";

type Alignment = {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
};
type Word = { text: string; start: number; end: number };
type Beat = { start: number; end: number; words: Word[] };

const API = "https://api.elevenlabs.io/v1";
const ROOT = join(import.meta.dir, "..");
const ADS = ["problems", "needs"] as const;
type AdName = (typeof ADS)[number];
const mp3Of = (ad: AdName) => join(ROOT, `public/ads/${ad}/vo.mp3`);
const timingOf = (ad: AdName) => join(ROOT, `src/ads/${ad}/vo.json`);
const beatsOf = async (ad: AdName) =>
  ((await import(`../src/ads/${ad}/script.ts`)) as { BEATS: readonly ScriptBeat[] }).BEATS;
// An audio tag, not read aloud: a clear silence between beats to cut the take at.
const BREAK = " [pause] ";
const CAST_BEATS = 4;

const apiKey = () => {
  const key = process.env.ELEVEN_LABS_API_KEY;
  if (!key) throw new Error("ELEVEN_LABS_API_KEY is missing: add it to the repo .env");
  return key;
};

const call = async (path: string, init: RequestInit) => {
  const res = await fetch(`${API}${path}`, { ...init, headers: { "xi-api-key": apiKey(), ...init.headers } });
  if (!res.ok) throw new Error(`ElevenLabs ${path}: ${res.status} ${await res.text()}`);
  return res;
};

const synthesize = async (text: string, voiceId: string) => {
  const res = await call(`/text-to-speech/${voiceId}/with-timestamps?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, model_id: VOICE.modelId, voice_settings: VOICE.settings, seed: VOICE.seed }),
  });
  const body = (await res.json()) as { audio_base64: string; alignment: Alignment };
  return { audio: Buffer.from(body.audio_base64, "base64"), alignment: body.alignment };
};

const transcribe = async (audio: Buffer) => {
  const form = new FormData();
  form.append("model_id", "scribe_v1");
  form.append("language_code", "pol");
  form.append("file", new Blob([new Uint8Array(audio)], { type: "audio/mpeg" }), "vo.mp3");
  const res = await call("/speech-to-text", { method: "POST", body: form });
  return ((await res.json()) as { text: string }).text;
};

/** Each beat's offset in the joined take text. */
const offsets = (texts: readonly string[]) =>
  texts.map((_, i) => texts.slice(0, i).reduce((sum, t) => sum + t.length + BREAK.length, 0));

/** Word times from the character timestamps; a word starts at its first letter and ends at its last. Audio tags
 * ("[pause]") are matched too, so that their letters are not taken for words, and then left out. */
const words = (text: string, offset: number, a: Alignment): Word[] =>
  [...text.matchAll(/\[[^\]]*\]|[\p{L}\p{N}][^\s]*[\p{L}\p{N}]|[\p{L}\p{N}]/gu)]
    .filter((m) => !m[0].startsWith("["))
    .map((m) => ({
      text: m[0],
      start: a.character_start_times_seconds[offset + (m.index ?? 0)] ?? 0,
      end: a.character_end_times_seconds[offset + (m.index ?? 0) + m[0].length - 1] ?? 0,
    }));

const beat = (text: string, offset: number, a: Alignment): Beat => {
  const ws = words(text, offset, a);
  return { start: ws[0]?.start ?? 0, end: ws.at(-1)?.end ?? 0, words: ws };
};

const normalize = (text: string) =>
  text
    .replace(/\[[^\]]*\]/g, " ")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

/** Words of the script the take dropped and words it added (longest common subsequence). */
const compare = (script: string, heard: string) => {
  const a = normalize(script);
  const b = normalize(heard);
  const lcs = a.map(() => b.map(() => 0));
  const at = (i: number, j: number) => (i < a.length && j < b.length ? (lcs[i]?.[j] ?? 0) : 0);
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      (lcs[i] as number[])[j] = a[i] === b[j] ? at(i + 1, j + 1) + 1 : Math.max(at(i + 1, j), at(i, j + 1));
  const walk = (i: number, j: number, dropped: string[], added: string[]): [string[], string[]] =>
    i >= a.length || j >= b.length
      ? [
          [...dropped, ...a.slice(i)],
          [...added, ...b.slice(j)],
        ]
      : a[i] === b[j]
        ? walk(i + 1, j + 1, dropped, added)
        : at(i + 1, j) >= at(i, j + 1)
          ? walk(i + 1, j, [...dropped, a[i] as string], added)
          : walk(i, j + 1, dropped, [...added, b[j] as string]);
  const [dropped, added] = walk(0, 0, [], []);
  return { dropped, added };
};

const report = (label: string, script: string, heard: string) => {
  const { dropped, added } = compare(script, heard);
  console.log(`\n${label}\n  heard: ${heard}`);
  console.log(
    dropped.length || added.length
      ? `  differs: dropped [${dropped.join(", ")}] added [${added.join(", ")}]`
      : "  matches the script word for word",
  );
};

const take = async (ad: AdName, force: boolean) => {
  const texts = (await beatsOf(ad)).map((b) => b.text);
  const [mp3, timing] = [mp3Of(ad), timingOf(ad)];
  const key = new Bun.CryptoHasher("sha256").update(JSON.stringify({ texts, VOICE, BREAK })).digest("hex");
  const previous = (await Bun.file(timing).exists()) ? ((await Bun.file(timing).json()) as { key?: string }) : {};
  if (!force && previous.key === key && (await Bun.file(mp3).exists()))
    return console.log(`vo: ${ad}: script and voice unchanged, keeping the take (--force for a new one)`);
  const script = texts.join(BREAK);
  const { audio, alignment } = await synthesize(script, VOICE.voiceId);
  const at = offsets(texts);
  const beats = Object.fromEntries((await beatsOf(ad)).map((b, i) => [b.id, beat(b.text, at[i] ?? 0, alignment)]));
  const duration = alignment.character_end_times_seconds.at(-1) ?? 0;
  const heard = await transcribe(audio);
  await mkdir(dirname(mp3), { recursive: true });
  await Bun.write(mp3, audio);
  await Bun.write(timing, `${JSON.stringify({ key, voiceId: VOICE.voiceId, duration, beats, heard }, null, 2)}\n`);
  console.log(`vo: ${ad}: ${duration.toFixed(1)} s → public/ads/${ad}/vo.mp3, src/ads/${ad}/vo.json`);
  report("transcript check", script, heard);
};

const cast = async (ad: AdName, voiceIds: string[]) => {
  const script = (await beatsOf(ad))
    .slice(0, CAST_BEATS)
    .map((b) => b.text)
    .join(BREAK);
  await mkdir(join(ROOT, "out/casting"), { recursive: true });
  const one = async (voiceId: string) => {
    const { audio } = await synthesize(script, voiceId);
    await Bun.write(join(ROOT, `out/casting/${voiceId}.mp3`), audio);
    report(`out/casting/${voiceId}.mp3`, script, await transcribe(audio));
  };
  await Promise.all(voiceIds.map(one));
};

const args = process.argv.slice(2);
const ad = args[0] as AdName;
if (!ADS.includes(ad)) throw new Error(`Which ad? bun run vo <${ADS.join("|")}> [--force | --cast id1,id2]`);
const castAt = args.indexOf("--cast");
await (castAt >= 0
  ? cast(ad, (args[castAt + 1] ?? "").split(",").filter(Boolean))
  : take(ad, args.includes("--force")));
