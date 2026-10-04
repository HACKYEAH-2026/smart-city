import { OpenAIModel } from "@strands-agents/sdk/models/openai";
import OpenAI from "openai";

export type ModelConfig = { apiKey: string; model: string; baseUrl?: string | undefined };

/** The embedding model of ctx.ai.embed (OpenAI, 1536 numbers per text); it uses the AI_API_KEY key. */
export const EMBEDDING_MODEL = "text-embedding-3-small";

/**
 * The language model (AI_MODEL). OpenAI goes through the Responses API: reasoning models such as gpt-6-luna take
 * function tools (the builder's check_plugin, structured output) only there, not in Chat Completions. A custom
 * OpenAI-compatible endpoint (AI_BASE_URL) usually offers only Chat Completions.
 */
export const openAIModel = (config: ModelConfig) =>
  config.baseUrl
    ? new OpenAIModel({
        api: "chat",
        modelId: config.model,
        apiKey: config.apiKey,
        clientConfig: { baseURL: config.baseUrl },
      })
    : new OpenAIModel({ api: "responses", modelId: config.model, apiKey: config.apiKey });

/** The client of the same API for what Strands does not wrap (embeddings: POST /embeddings). */
export const openAIClient = (config: ModelConfig) =>
  new OpenAI({ apiKey: config.apiKey, ...(config.baseUrl ? { baseURL: config.baseUrl } : {}) });
