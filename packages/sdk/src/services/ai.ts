import type { z } from "zod";
import type { FileId } from "./files";

export type AICall<S extends z.ZodType | undefined = undefined> = {
  prompt: string;
  images?: FileId[];
  /** With a schema the response is a validated object; without one — text. */
  schema?: S;
};

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
}
