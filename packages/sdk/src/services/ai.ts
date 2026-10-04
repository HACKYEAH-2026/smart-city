import type { z } from "zod";
import type { FileId } from "./files";

export type AICall<S extends z.ZodType | undefined = undefined> = {
  prompt: string;
  images?: FileId[];
  /** With a schema the response is a validated object; without one — text. */
  schema?: S;
  /**
   * Give up after this many milliseconds (1 to AI_CALL_TIMEOUT_MAX): the call rejects with "ctx.ai.call timed out
   * after … ms" and the host stops the model. A plugin has no timers, so this is how a handler bounds a slow model.
   */
  timeoutMs?: number;
};

/** The longest `timeoutMs` a plugin may ask for. */
export const AI_CALL_TIMEOUT_MAX = 60_000;

/** A `ctx.ai.call` with `timeoutMs` that did not answer in time. */
export class AITimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(`ctx.ai.call timed out after ${timeoutMs} ms`);
  }
}

/**
 * Runs `call` within `timeoutMs` (none: as long as it takes): past it, the result rejects with AITimeoutError and
 * `signal` aborts, so the model can stop. The one implementation of the limit, for the host and the test harness.
 */
export function withAITimeout<T>(
  timeoutMs: number | undefined,
  call: (signal?: AbortSignal) => Promise<T>,
): Promise<T> {
  if (timeoutMs === undefined) return call();
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > AI_CALL_TIMEOUT_MAX) {
    return Promise.reject(new Error(`ctx.ai.call: timeoutMs must be an integer from 1 to ${AI_CALL_TIMEOUT_MAX}`));
  }
  const signal = AbortSignal.timeout(timeoutMs);
  const expired = new Promise<never>((_, reject) =>
    signal.addEventListener("abort", () => reject(new AITimeoutError(timeoutMs)), { once: true }),
  );
  return Promise.race([call(signal), expired]);
}

export type SimilarOptions<R> = {
  text: (item: R) => string;
  image?: (item: R) => FileId | null | undefined;
  limit?: number;
};

export type SimilarMatch<R> = { item: R; score: number; reason: string };

export interface AI {
  call<S extends z.ZodType | undefined = undefined>(
    req: AICall<S>,
  ): Promise<S extends z.ZodType ? z.output<S> : string>;
  /** Candidates describing the same thing as the query (most similar first); empty list = none. */
  findSimilar<R>(
    query: { text: string; image?: FileId | null },
    candidates: R[],
    opts: SimilarOptions<R>,
  ): Promise<SimilarMatch<R>[]>;
  /**
   * The meaning of a text as a vector (the host's embedding model). Store it yourself (`t.json<number[]>()`) and
   * compare with cosine similarity. Vectors of different models are not comparable: when the host switches models,
   * the length usually changes too.
   */
  embed(text: string): Promise<number[]>;
}
