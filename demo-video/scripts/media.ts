/**
 * The generated media of the ads (src/ads/shared/media.ts) and the login loop (src/login/media.ts) from the Gemini
 * API: stills with the Gemini image model (an `edit` still starts from another still, so both show the same scene),
 * clips with Veo (a `start` clip opens on a frame of another clip, so it continues that shot; a `first` clip opens on
 * a still, a `last` clip ends on one); a `frame` is a still taken from a clip, without the API. Makes only the files
 * missing in public/, each after what it starts from. Paid per image and per second of video, so run it on purpose.
 * Needs GEMINI_API_KEY (repo .env).
 *   bun run media                 everything missing
 *   bun run media --only dom,miasto   just these (also when they exist)
 */
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { CLIP_SECONDS, type Clip, type Grab, MEDIA, type Still } from "../src/ads/shared/media";
import { LOGIN_MEDIA } from "../src/login/media";

const API = "https://generativelanguage.googleapis.com/v1beta";
const IMAGE_MODEL = "gemini-3.1-flash-image";
const VIDEO_MODEL = "veo-3.1-fast-generate-preview";
const PUBLIC = join(import.meta.dir, "../public");
const POLL_MS = 10_000;
/** Veo takes only a few requests a minute: a rate-limited request (429) waits longer each time and tries again. */
const RETRY_MS = 30_000;
const RETRIES = 6;

const CATALOG: Record<string, Still | Clip | Grab> = { ...MEDIA, ...LOGIN_MEDIA };
const entry = (id: string) => {
  const item = CATALOG[id];
  if (!item) throw new Error(`Unknown media: ${id}`);
  return item;
};
type Frame = { bytes: Buffer; mimeType: string };

const apiKey = () => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is missing: add it to the repo .env");
  return key;
};

const call = async (url: string, init: RequestInit = {}, attempt = 0): Promise<Response> => {
  const res = await fetch(url, {
    ...init,
    headers: { "x-goog-api-key": apiKey(), "Content-Type": "application/json", ...init.headers },
  });
  if (res.status === 429 && attempt < RETRIES) {
    await Bun.sleep(RETRY_MS * (attempt + 1) + Math.random() * RETRY_MS);
    return call(url, init, attempt + 1);
  }
  if (!res.ok) throw new Error(`Gemini ${url}: ${res.status} ${await res.text()}`);
  return res;
};

/** The last base64 image anywhere in a response (the API nests it under steps/outputs depending on the call). */
const imageIn = (value: unknown): string | undefined => {
  if (Array.isArray(value)) return value.map(imageIn).findLast(Boolean);
  if (!value || typeof value !== "object") return undefined;
  const o = value as Record<string, unknown>;
  const own =
    typeof o.data === "string" && String(o.mime_type ?? o.mimeType ?? "").startsWith("image/") ? o.data : undefined;
  return Object.values(o).map(imageIn).findLast(Boolean) ?? own;
};

const image = async (prompt: string, from?: Buffer) => {
  const input = [
    { type: "text", text: prompt },
    ...(from ? [{ type: "image", mime_type: "image/jpeg", data: from.toString("base64") }] : []),
  ];
  const res = await call(`${API}/interactions`, {
    method: "POST",
    body: JSON.stringify({
      model: IMAGE_MODEL,
      input,
      response_format: { type: "image", mime_type: "image/jpeg", aspect_ratio: "16:9", image_size: "2K" },
    }),
  });
  const data = imageIn(await res.json());
  if (!data) throw new Error("Gemini returned no image");
  return Buffer.from(data, "base64");
};

type Operation = {
  name: string;
  done?: boolean;
  error?: { message: string };
  response?: { generateVideoResponse?: { generatedSamples?: { video?: { uri?: string } }[] } };
};

const finished = async (name: string): Promise<Operation> => {
  const op = (await (await call(`${API}/${name}`)).json()) as Operation;
  if (op.error) throw new Error(`Veo: ${op.error.message}`);
  if (op.done) return op;
  await Bun.sleep(POLL_MS);
  return finished(name);
};

/** One frame of a clip in public/, as PNG bytes (the start of a clip that continues it). */
const frameOf = async (file: string, second: number): Promise<Frame> => {
  const png = join(PUBLIC, `${file}.${second}s.png`);
  const proc = Bun.spawn(
    [
      "bunx",
      "remotion",
      "ffmpeg",
      "-y",
      "-loglevel",
      "error",
      "-ss",
      String(second),
      "-i",
      join(PUBLIC, file),
      "-frames:v",
      "1",
      png,
    ],
    { stdout: "inherit", stderr: "inherit" },
  );
  if ((await proc.exited) !== 0) throw new Error(`ffmpeg could not take a frame of ${file}`);
  const bytes = Buffer.from(await Bun.file(png).arrayBuffer());
  await Bun.file(png).delete();
  return { bytes, mimeType: "image/png" };
};

/** A still in public/ as a frame a clip opens or ends on. */
const stillFrame = async (id: string): Promise<Frame> => ({
  bytes: Buffer.from(await Bun.file(join(PUBLIC, entry(id).file)).arrayBuffer()),
  mimeType: "image/jpeg",
});

const veoImage = (frame: Frame) => ({ bytesBase64Encoded: frame.bytes.toString("base64"), mimeType: frame.mimeType });

const video = async (prompt: string, start?: Frame, last?: Frame) => {
  const frames = { ...(start ? { image: veoImage(start) } : {}), ...(last ? { lastFrame: veoImage(last) } : {}) };
  const res = await call(`${API}/models/${VIDEO_MODEL}:predictLongRunning`, {
    method: "POST",
    body: JSON.stringify({
      instances: [{ prompt, ...frames }],
      parameters: {
        aspectRatio: "16:9",
        resolution: "1080p",
        durationSeconds: CLIP_SECONDS,
        negativePrompt: "text, captions, subtitles, logos, watermark, readable phone screen",
      },
    }),
  });
  const op = await finished(((await res.json()) as Operation).name);
  const uri = op.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
  if (!uri) throw new Error(`Veo returned no video: ${JSON.stringify(op.response)}`);
  return Buffer.from(await (await call(uri, { redirect: "follow" })).arrayBuffer());
};

/**
 * The repo keeps small files: stills at 1920 px, clips without sound (the ad has its own) at a sensible bitrate.
 * Uses the ffmpeg that ships with Remotion.
 */
const shrink = async (raw: string, out: string, kind: "image" | "video") => {
  const args =
    kind === "image"
      ? ["-vf", "scale=1920:-2", "-q:v", "3"]
      : ["-an", "-c:v", "libx264", "-crf", "22", "-preset", "slow", "-movflags", "+faststart"];
  const proc = Bun.spawn(["bunx", "remotion", "ffmpeg", "-y", "-loglevel", "error", "-i", raw, ...args, out], {
    stdout: "inherit",
    stderr: "inherit",
  });
  if ((await proc.exited) !== 0) throw new Error(`ffmpeg failed on ${raw}`);
  await Bun.file(raw).delete();
};

/** The frame a clip opens on: a frame of another clip or a still. */
const startOf = (clip: Clip) =>
  clip.start
    ? frameOf(entry(clip.start.clip).file, clip.start.second)
    : clip.first
      ? stillFrame(clip.first)
      : undefined;

const generate = async (item: Still | Clip | Grab) =>
  item.kind === "frame"
    ? (await frameOf(entry(item.clip).file, item.second)).bytes
    : item.kind === "image"
      ? image(item.prompt, item.edit ? (await stillFrame(item.edit)).bytes : undefined)
      : video(item.prompt, await startOf(item), item.last ? await stillFrame(item.last) : undefined);

const make = async (id: string) => {
  const item = entry(id);
  const bytes = await generate(item);
  const out = join(PUBLIC, item.file);
  const raw = `${out}.raw${{ image: ".jpg", frame: ".png", video: ".mp4" }[item.kind]}`;
  await mkdir(dirname(out), { recursive: true });
  await Bun.write(raw, bytes);
  await shrink(raw, out, item.kind === "video" ? "video" : "image");
  console.log(`media: ${id} → public/${item.file} (${(Bun.file(out).size / 1024).toFixed(0)} kB)`);
};

/** What a file is made from (a still to edit, a clip or still to open on, a still to end on). */
const sources = (item: Still | Clip | Grab) =>
  (item.kind === "frame"
    ? [item.clip]
    : item.kind === "image"
      ? [item.edit]
      : [item.start?.clip, item.first, item.last]
  ).filter((id): id is string => id !== undefined);

/** How many files must be made before this one: 0 for a file made from a prompt alone. */
const depth = (id: string): number => Math.max(0, ...sources(entry(id)).map((source) => depth(source) + 1));

const args = process.argv.slice(2);
const only = args.includes("--only") ? (args[args.indexOf("--only") + 1] ?? "").split(",").filter(Boolean) : [];
const ids = Object.keys(CATALOG);
const unknown = only.filter((id) => !ids.includes(id));
if (unknown.length) throw new Error(`Unknown media: ${unknown.join(", ")} (known: ${ids.join(", ")})`);
const missing = await Promise.all(ids.map(async (id) => !(await Bun.file(join(PUBLIC, entry(id).file)).exists())));
const todo = only.length ? only : ids.filter((_, i) => missing[i]);
/** Makes files side by side; one that fails does not stop the others (a started Veo clip is paid for). */
const makeAll = async (batch: string[]) => {
  const results = await Promise.allSettled(batch.map(make));
  return results.flatMap((result, i) => (result.status === "rejected" ? [`${batch[i]}: ${result.reason}`] : []));
};

// Each file waits for what it starts from; files at the same depth run at once.
const levels = [...new Set(todo.map(depth))].sort((a, b) => a - b);
const failed = await levels.reduce(
  async (done, level) => [...(await done), ...(await makeAll(todo.filter((id) => depth(id) === level)))],
  Promise.resolve<string[]>([]),
);
if (failed.length) throw new Error(`media: failed\n${failed.join("\n")}`);
console.log(todo.length ? `media: made ${todo.join(", ")}` : "media: nothing missing (--only <ids> to make again)");
