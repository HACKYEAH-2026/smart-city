import type { AI, Doc, FileId, SimilarMatch, SimilarOptions } from "@app/plugin-sdk";
import { z } from "zod";
import type { FileService } from "../files/service";
import type { AIProviders, ModelImage } from "./types";

const CANDIDATES_MAX = 30;
const MATCH_THRESHOLD = 0.6;
const CALLS_PER_MINUTE = 60;

export class AINotConfiguredError extends Error {
  constructor() {
    super("AI is not configured on this server (AI_API_KEY)");
  }
}

const words = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length > 2),
  );

/** Model-less mode: shared meaningful words (enough for tests and a keyless demo). */
function lexicalSimilar<T>(text: string, candidates: Doc<T>[], opts: SimilarOptions<T>): SimilarMatch<T>[] {
  const mine = words(text);
  if (!mine.size) return [];
  return candidates
    .map((doc) => {
      const theirs = words(opts.text(doc));
      const common = [...mine].filter((w) => theirs.has(w));
      const score = common.length / Math.max(1, Math.min(mine.size, theirs.size));
      return { doc, score, reason: `Wspólne słowa: ${common.join(", ")}` };
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
 */
export class AIService {
  private readonly calls = new Map<string, number[]>();

  constructor(
    private readonly providers: AIProviders,
    private readonly files: FileService,
  ) {}

  forPlugin(installationId: string): AI {
    const images = async (ids: (FileId | undefined)[]): Promise<ModelImage[]> =>
      (await Promise.all(ids.filter(Boolean).map((id) => this.files.read(installationId, id as string)))).filter(
        (x): x is ModelImage => x !== null,
      );

    const generate = async (prompt: string, imgs: ModelImage[], schema?: z.ZodType) => {
      const model = this.providers.language;
      if (!model) throw new AINotConfiguredError();
      this.limit(installationId);
      return model.generate({ prompt, images: imgs, ...(schema ? { schema } : {}) });
    };

    return {
      call: async (req) => {
        const out = await generate(req.prompt, await images(req.images ?? []), req.schema);
        return (req.schema ? req.schema.parse(out) : String(out)) as never;
      },

      findSimilar: async <T>(
        query: { text: string; image?: FileId },
        candidates: Doc<T>[],
        opts: SimilarOptions<T>,
      ) => {
        const pool = candidates.slice(0, CANDIDATES_MAX);
        if (!pool.length) return [];
        if (!this.providers.language) return lexicalSimilar(query.text, pool, opts);
        const list = pool.map((d, i) => `[${i}] ${opts.text(d)}`).join("\n");
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
          .map((m) => ({ doc: pool[m.index] as Doc<T>, score: m.score, reason: m.reason }));
      },
    };
  }

  private limit(installationId: string) {
    const now = Date.now();
    const recent = (this.calls.get(installationId) ?? []).filter((t) => now - t < 60_000);
    if (recent.length >= CALLS_PER_MINUTE) throw new Error("AI rate limit exceeded for this plugin installation");
    recent.push(now);
    this.calls.set(installationId, recent);
  }
}
