import type { z } from "zod";

/**
 * Host AI providers (swappable). Plugins don't know about them — they only see ctx.ai.
 * The concrete implementation (Strands + OpenAI-compatible) is host configuration.
 */
export type ModelImage = { mime: string; data: Uint8Array };

export interface LanguageModel {
  /** With a schema: the validated object; without: the response text. `signal` aborts: stop and give up. */
  generate(req: { prompt: string; images?: ModelImage[]; schema?: z.ZodType; signal?: AbortSignal }): Promise<unknown>;
}

export interface EmbeddingModel {
  /** The text as a vector; one model always returns vectors of the same length. */
  embed(text: string): Promise<number[]>;
}

/**
 * Without a language model: ctx.ai.call throws and findSimilar works lexically (shared words).
 * Without an embedding model: ctx.ai.embed throws.
 */
export type AIProviders = { language?: LanguageModel; embedding?: EmbeddingModel };
