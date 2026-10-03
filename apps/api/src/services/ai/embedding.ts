import type OpenAI from "openai";
import { type ModelConfig, openAIClient } from "./model";
import type { EmbeddingModel } from "./types";

/** EmbeddingModel on the OpenAI-compatible embeddings API (ctx.ai.embed); one text per request. */
export class OpenAIEmbeddingModel implements EmbeddingModel {
  private readonly client: OpenAI;

  constructor(private readonly config: ModelConfig) {
    this.client = openAIClient(config);
  }

  async embed(text: string) {
    const res = await this.client.embeddings.create({
      model: this.config.model,
      input: text,
      encoding_format: "float",
    });
    const vector = res.data[0]?.embedding;
    if (!vector?.length) throw new Error(`Embedding model ${this.config.model} returned no vector`);
    return vector;
  }
}
