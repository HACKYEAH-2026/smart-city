import { type AI, type FileId, type SimilarMatch, type SimilarOptions, withAITimeout } from "@app/plugin-sdk";
import { z } from "zod";
import { type LogFields, logger } from "../../log";
import type { FileService } from "../files/service";
import type { AIProviders, ModelImage } from "./types";

const CANDIDATES_MAX = 30;
const MATCH_THRESHOLD = 0.6;
const CALLS_PER_MINUTE = 60;
/** Embeddings cost a fraction of a model call, so a plugin may embed more often (e.g. a batch of old rows). */
const EMBEDS_PER_MINUTE = 600;
/** Characters per embedded text; well below the embedding models' input limit (8191 tokens for OpenAI's). */
const EMBED_TEXT_MAX = 8000;

const log = logger("ai");

export class AINotConfiguredError extends Error {
  constructor() {
    super("AI is not configured on this server (AI_API_KEY)");
  }
}

/** The text ctx.ai.embed sends: trimmed, not empty and not longer than EMBED_TEXT_MAX. */
function embeddable(text: string) {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("ctx.ai.embed: empty text");
  if (trimmed.length > EMBED_TEXT_MAX) throw new Error(`ctx.ai.embed: text longer than ${EMBED_TEXT_MAX} characters`);
  return trimmed;
}

const words = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length > 2),
  );

/** Model-less mode: shared meaningful words (enough for tests and a keyless demo). */
function lexicalSimilar<R>(text: string, candidates: R[], opts: SimilarOptions<R>): SimilarMatch<R>[] {
  const mine = words(text);
  if (!mine.size) return [];
  return candidates
    .map((item) => {
      const theirs = words(opts.text(item));
      const common = [...mine].filter((w) => theirs.has(w));
      const score = common.length / Math.max(1, Math.min(mine.size, theirs.size));
      return { item, score, reason: `Wspólne słowa: ${common.join(", ")}` };
    })
    .filter((m) => m.score >= 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.limit ?? 3);
}

const judgement = z.object({
  matches: z.array(z.object({ index: z.number().int(), score: z.number().min(0).max(1), reason: z.string() })),
});

/**
 * ctx.ai: the single source of model calls for plugins. Key, limits and model choice live in the host.
 * findSimilar: language model judgement "is this the same problem" (without a model: lexical mode).
 * embed: a vector from the embedding model; the plugin stores and compares vectors itself.
 */
export class AIService {
  private readonly calls = new Map<string, number[]>();

  constructor(
    private readonly providers: AIProviders,
    private readonly files: FileService,
  ) {}

  forPlugin(installationId: string): AI {
    const images = async (ids: (FileId | null | undefined)[]): Promise<ModelImage[]> =>
      (await Promise.all(ids.filter(Boolean).map((id) => this.files.read(installationId, id as string)))).filter(
        (x): x is ModelImage => x !== null,
      );

    const generate = async (prompt: string, imgs: ModelImage[], schema?: z.ZodType, signal?: AbortSignal) => {
      const model = this.providers.language;
      if (!model) throw notConfigured(installationId, "a model call");
      this.limit(installationId, CALLS_PER_MINUTE);
      const fields = { installation: installationId, chars: prompt.length, images: imgs.length, structured: !!schema };
      return logged("info", "model call", fields, () =>
        model.generate({ prompt, images: imgs, ...(schema ? { schema } : {}), ...(signal ? { signal } : {}) }),
      );
    };

    return {
      // `timeoutMs` bounds reading the photos and the model; past it the model is told to stop (signal).
      call: async (req) => {
        const out = await withAITimeout(req.timeoutMs, async (signal) =>
          generate(req.prompt, await images(req.images ?? []), req.schema, signal),
        );
        return (req.schema ? req.schema.parse(out) : String(out)) as never;
      },

      findSimilar: async <R>(
        query: { text: string; image?: FileId | null },
        candidates: R[],
        opts: SimilarOptions<R>,
      ) => {
        const pool = candidates.slice(0, CANDIDATES_MAX);
        if (!pool.length) return [];
        if (!this.providers.language) {
          log.debug("findSimilar without a model: shared words", {
            installation: installationId,
            candidates: pool.length,
          });
          return lexicalSimilar(query.text, pool, opts);
        }
        const list = pool.map((item, i) => `[${i}] ${opts.text(item)}`).join("\n");
        const prompt = [
          "A resident is reporting a problem. Decide which existing reports describe THE SAME real-world problem",
          "(same object and place), not merely a similar category. Score 0..1; include only scores >= 0.5.",
          "Reason: one short sentence in the language of the report.",
          `New report: ${query.text}`,
          `Existing reports:\n${list}`,
        ].join("\n");
        const out = judgement.parse(await generate(prompt, await images([query.image]), judgement));
        return out.matches
          .filter((m) => m.score >= MATCH_THRESHOLD && pool[m.index])
          .sort((a, b) => b.score - a.score)
          .slice(0, opts.limit ?? 3)
          .map((m) => ({ item: pool[m.index] as R, score: m.score, reason: m.reason }));
      },

      embed: async (text) => {
        const model = this.providers.embedding;
        if (!model) throw notConfigured(installationId, "an embedding");
        const input = embeddable(text);
        this.limit(`${installationId}:embed`, EMBEDS_PER_MINUTE);
        return logged("debug", "embedding", { installation: installationId, chars: input.length }, () =>
          model.embed(input),
        );
      },
    };
  }

  /** At most `max` requests per minute under `key` (an installation, or an installation's embeddings). */
  private limit(key: string, max: number) {
    const now = Date.now();
    const recent = (this.calls.get(key) ?? []).filter((t) => now - t < 60_000);
    if (recent.length >= max) {
      log.warn("plugin over its AI rate limit", { key, perMinute: max });
      throw new Error("AI rate limit exceeded for this plugin installation");
    }
    recent.push(now);
    this.calls.set(key, recent);
  }
}

function notConfigured(installation: string, what: string): AINotConfiguredError {
  log.warn(`a plugin asked for ${what}, but AI is not configured`, { installation });
  return new AINotConfiguredError();
}

/** A request to a model, logged with its time at `level`, or as an error with the provider's answer (rethrown). */
async function logged<T>(level: "info" | "debug", what: string, fields: LogFields, run: () => Promise<T>): Promise<T> {
  const started = performance.now();
  const ms = () => Math.round(performance.now() - started);
  return run().then(
    (out) => {
      log[level](what, { ...fields, ms: ms() });
      return out;
    },
    (err: unknown) => {
      log.error(`${what} failed`, { ...fields, ms: ms(), err });
      throw err;
    },
  );
}
