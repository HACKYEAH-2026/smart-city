import { OpenAIModel } from "@strands-agents/sdk/models/openai";

export type ModelConfig = { apiKey: string; model: string; baseUrl?: string | undefined };

/** A model via an OpenAI-compatible API (OpenAI or a custom endpoint: AI_BASE_URL). */
export const openAIModel = (config: ModelConfig) =>
  new OpenAIModel({
    api: "chat",
    modelId: config.model,
    apiKey: config.apiKey,
    ...(config.baseUrl ? { clientConfig: { baseURL: config.baseUrl } } : {}),
  });
