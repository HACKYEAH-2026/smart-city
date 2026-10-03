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
  /**
   * The meaning of a text as a vector (the host's embedding model). Store it yourself (`t.json<number[]>()`) and
   * compare with cosine similarity. Vectors of different models are not comparable: when the host switches models,
   * the length usually changes too.
   */
  embed(text: string): Promise<number[]>;
}
