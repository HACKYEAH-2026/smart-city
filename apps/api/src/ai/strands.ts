import { Agent } from "@strands-agents/sdk";
import { OpenAIModel } from "@strands-agents/sdk/models/openai";
import type { LanguageModel, ModelImage } from "./types";

const FORMATS: Record<string, "jpeg" | "png" | "webp"> = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * LanguageModel on Strands Agents with a model via an OpenAI-compatible API (OpenAI or a custom endpoint:
 * AI_BASE_URL). Each call is a fresh agent with no tools and no memory — one request, one response.
 */
export class StrandsLanguageModel implements LanguageModel {
  private readonly model: OpenAIModel;

  constructor(config: { apiKey: string; model: string; baseUrl?: string | undefined }) {
    this.model = new OpenAIModel({
      api: "chat",
      modelId: config.model,
      apiKey: config.apiKey,
      ...(config.baseUrl ? { clientConfig: { baseURL: config.baseUrl } } : {}),
    });
  }

  async generate(req: { prompt: string; images?: ModelImage[]; schema?: import("zod").ZodType }) {
    const agent = new Agent({
      model: this.model,
      printer: false,
      systemPrompt:
        "You are a precise assistant inside a civic community app. Answer in the language of the user's content. Be concise.",
    });
    const images = (req.images ?? []).flatMap((img) => {
      const format = FORMATS[img.mime];
      return format ? [{ image: { format, source: { bytes: img.data } } }] : [];
    });
    const result = await agent.invoke([{ text: req.prompt }, ...images], {
      ...(req.schema ? { structuredOutputSchema: req.schema } : {}),
    });
    return req.schema ? result.structuredOutput : result.toString();
  }
}
