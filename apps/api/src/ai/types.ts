import type { z } from "zod";

/**
 * Dostawcy AI hosta (wymienni). Wtyczki o nich nie wiedzą — widzą tylko ctx.ai.
 * Konkretna implementacja (Strands + OpenAI-compatible) to konfiguracja hosta.
 */
export type ModelImage = { mime: string; data: Uint8Array };

export interface LanguageModel {
  /** Ze schematem: zwalidowany obiekt; bez schematu: tekst odpowiedzi. */
  generate(req: { prompt: string; images?: ModelImage[]; schema?: z.ZodType }): Promise<unknown>;
}

/** Bez modelu językowego: ctx.ai.call rzuca błąd, a findSimilar działa leksykalnie (wspólne słowa). */
export type AIProviders = { language?: LanguageModel };
