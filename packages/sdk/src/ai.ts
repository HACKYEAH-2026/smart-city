import type { z } from "zod";
import type { Doc } from "./db";
import type { FileId } from "./files";

export type AICall<S extends z.ZodType | undefined = undefined> = {
  prompt: string;
  images?: FileId[];
  /** With a schema the response is a validated object; without one — text. */
  schema?: S;
};

export type SimilarOptions<T> = {
  text: (doc: Doc<T>) => string;
  image?: (doc: Doc<T>) => FileId | undefined;
  limit?: number;
};

export type SimilarMatch<T> = { doc: Doc<T>; score: number; reason: string };

export interface AI {
  call<S extends z.ZodType | undefined = undefined>(
    req: AICall<S>,
  ): Promise<S extends z.ZodType ? z.output<S> : string>;
  /** Semantically similar documents (most similar first); empty list = none similar. */
  findSimilar<T>(
    query: { text: string; image?: FileId },
    candidates: Doc<T>[],
    opts: SimilarOptions<T>,
  ): Promise<SimilarMatch<T>[]>;
}
