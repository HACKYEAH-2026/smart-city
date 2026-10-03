/**
 * Voice-over for the ad (src/ad/script.ts) from ElevenLabs: the whole script in one take with character
 * timestamps, split into beats. Writes public/ad/vo.mp3 and src/ad/vo.json (beat and word times that time the
 * video), then transcribes the take back (Scribe) and lists the words the narrator dropped or added.
 * Skips the API when the script and the voice are unchanged. Needs ELEVEN_LABS_API_KEY (repo .env).
 *   bun run vo                    the take (--force: a new one even if nothing changed)
 *   bun run vo --cast id1,id2     the first beats in other voices → out/casting/<id>.mp3, to compare by ear
 */
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { BEATS, VOICE } from "../src/ad/script";

type Alignment = {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
};
type Word = { text: string; start: number; end: number };
type Beat = { start: number; end: number; words: Word[] };

const API = "https://api.elevenlabs.io/v1";
const ROOT = join(import.meta.dir, "..");
const MP3 = join(ROOT, "public/ad/vo.mp3");
const TIMING = join(ROOT, "src/ad/vo.json");
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

/** Word times from the character timestamps; a word starts at its first letter and ends at its last. */
const words = (text: string, offset: number, a: Alignment): Word[] =>
  [...text.matchAll(/[\p{L}\p{N}][^\s]*[\p{L}\p{N}]|[\p{L}\p{N}]/gu)].map((m) => ({
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

const take = async (force: boolean) => {
  const texts = BEATS.map((b) => b.text);
  const key = new Bun.CryptoHasher("sha256").update(JSON.stringify({ texts, VOICE, BREAK })).digest("hex");
  const previous = (await Bun.file(TIMING).exists()) ? ((await Bun.file(TIMING).json()) as { key?: string }) : {};
  if (!force && previous.key === key && (await Bun.file(MP3).exists()))
    return console.log("vo: script and voice unchanged, keeping the take (--force for a new one)");
  const script = texts.join(BREAK);
  const { audio, alignment } = await synthesize(script, VOICE.voiceId);
  const at = offsets(texts);
  const beats = Object.fromEntries(BEATS.map((b, i) => [b.id, beat(b.text, at[i] ?? 0, alignment)]));
  const duration = alignment.character_end_times_seconds.at(-1) ?? 0;
  const heard = await transcribe(audio);
  await mkdir(join(ROOT, "public/ad"), { recursive: true });
  await Bun.write(MP3, audio);
  await Bun.write(TIMING, `${JSON.stringify({ key, voiceId: VOICE.voiceId, duration, beats, heard }, null, 2)}\n`);
  console.log(`vo: ${duration.toFixed(1)} s → public/ad/vo.mp3, src/ad/vo.json`);
  report("transcript check", script, heard);
};

const cast = async (voiceIds: string[]) => {
  const script = BEATS.slice(0, CAST_BEATS)
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
const castAt = args.indexOf("--cast");
await (castAt >= 0 ? cast((args[castAt + 1] ?? "").split(",").filter(Boolean)) : take(args.includes("--force")));
