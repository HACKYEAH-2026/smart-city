/**
 * The ad's generated media (src/ad/media.ts) from the Gemini API: stills with the Gemini image model (an `edit`
 * still starts from another still, so both show the same scene), clips with Veo. Makes only the files missing in
 * public/. Paid per image and per second of video, so run it on purpose. Needs GEMINI_API_KEY (repo .env).
 *   bun run media                 everything missing
 *   bun run media --only dom,miasto   just these (also when they exist)
 */
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { MEDIA, type MediaId } from "../src/ad/media";

const API = "https://generativelanguage.googleapis.com/v1beta";
const IMAGE_MODEL = "gemini-3.1-flash-image";
const VIDEO_MODEL = "veo-3.1-fast-generate-preview";
const PUBLIC = join(import.meta.dir, "../public");
const POLL_MS = 10_000;

const apiKey = () => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is missing: add it to the repo .env");
  return key;
};

const call = async (url: string, init: RequestInit = {}) => {
  const res = await fetch(url, {
    ...init,
    headers: { "x-goog-api-key": apiKey(), "Content-Type": "application/json", ...init.headers },
  });
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

const video = async (prompt: string) => {
  const res = await call(`${API}/models/${VIDEO_MODEL}:predictLongRunning`, {
    method: "POST",
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: {
        aspectRatio: "16:9",
        resolution: "1080p",
        durationSeconds: 8,
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

const make = async (id: MediaId) => {
  const item = MEDIA[id];
  const source = "edit" in item ? join(PUBLIC, MEDIA[item.edit].file) : undefined;
  const from = source ? Buffer.from(await Bun.file(source).arrayBuffer()) : undefined;
  const bytes = item.kind === "image" ? await image(item.prompt, from) : await video(item.prompt);
  const out = join(PUBLIC, item.file);
  const raw = `${out}.raw${item.kind === "image" ? ".jpg" : ".mp4"}`;
  await mkdir(dirname(out), { recursive: true });
  await Bun.write(raw, bytes);
  await shrink(raw, out, item.kind);
  console.log(`media: ${id} → public/${item.file} (${(Bun.file(out).size / 1024).toFixed(0)} kB)`);
};

const args = process.argv.slice(2);
const only = args.includes("--only") ? (args[args.indexOf("--only") + 1] ?? "").split(",").filter(Boolean) : [];
const ids = Object.keys(MEDIA) as MediaId[];
const unknown = only.filter((id) => !ids.includes(id as MediaId));
if (unknown.length) throw new Error(`Unknown media: ${unknown.join(", ")} (known: ${ids.join(", ")})`);
const missing = await Promise.all(ids.map(async (id) => !(await Bun.file(join(PUBLIC, MEDIA[id].file)).exists())));
const todo = only.length ? (only as MediaId[]) : ids.filter((_, i) => missing[i]);
// Edits wait for the still they start from; everything else runs at once.
const first = todo.filter((id) => !("edit" in MEDIA[id]));
await Promise.all(first.map(make));
await Promise.all(todo.filter((id) => "edit" in MEDIA[id]).map(make));
console.log(todo.length ? `media: made ${todo.join(", ")}` : "media: nothing missing (--only <ids> to make again)");
