import { OpenAIModel } from "@strands-agents/sdk/models/openai";
import OpenAI from "openai";

export type ModelConfig = { apiKey: string; model: string; baseUrl?: string | undefined };

/** The embedding model of ctx.ai.embed (OpenAI, 1536 numbers per text); it uses the AI_API_KEY key. */
export const EMBEDDING_MODEL = "text-embedding-3-small";

/** A model via an OpenAI-compatible API (OpenAI or a custom endpoint: AI_BASE_URL). */
export const openAIModel = (config: ModelConfig) =>
  new OpenAIModel({
    api: "chat",
    modelId: config.model,
    apiKey: config.apiKey,
    ...(config.baseUrl ? { clientConfig: { baseURL: config.baseUrl } } : {}),
  });

/** The client of the same API for what Strands does not wrap (embeddings: POST /embeddings). */
export const openAIClient = (config: ModelConfig) =>
  new OpenAI({ apiKey: config.apiKey, ...(config.baseUrl ? { baseURL: config.baseUrl } : {}) });
