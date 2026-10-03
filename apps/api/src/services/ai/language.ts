import { Agent } from "@strands-agents/sdk";
import type { OpenAIModel } from "@strands-agents/sdk/models/openai";
import type { ZodType } from "zod";
import { type ModelConfig, openAIModel } from "./model";
import type { LanguageModel, ModelImage } from "./types";

const FORMATS: Record<string, "jpeg" | "png" | "webp"> = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * LanguageModel on Strands Agents (ctx.ai). Each call is a fresh agent with no tools and no memory — one request,
 * one response.
 */
export class StrandsLanguageModel implements LanguageModel {
  private readonly model: OpenAIModel;

  constructor(config: ModelConfig) {
    this.model = openAIModel(config);
  }

  async generate(req: { prompt: string; images?: ModelImage[]; schema?: ZodType }) {
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
