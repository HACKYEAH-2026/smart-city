import type { PluginCheck } from "@app/plugin-sdk";
import { Agent, type JSONValue, tool } from "@strands-agents/sdk";
import { OpenAIModel } from "@strands-agents/sdk/models/openai";
import { z } from "zod";
import {
  AUTHOR_INSTRUCTIONS,
  AuthorError,
  type AuthorResult,
  type AuthorTask,
  authorPrompt,
  MAX_CHECKS,
  type PluginAuthor,
} from "./author";
import type { LanguageModel, ModelImage } from "./types";

const FORMATS: Record<string, "jpeg" | "png" | "webp"> = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
};

export type ModelConfig = { apiKey: string; model: string; baseUrl?: string | undefined };

/** A model via an OpenAI-compatible API (OpenAI or a custom endpoint: AI_BASE_URL). */
export const openAIModel = (config: ModelConfig) =>
  new OpenAIModel({
    api: "chat",
    modelId: config.model,
    apiKey: config.apiKey,
    ...(config.baseUrl ? { clientConfig: { baseURL: config.baseUrl } } : {}),
  });

/**
 * LanguageModel on Strands Agents (ctx.ai). Each call is a fresh agent with no tools and no memory — one request,
 * one response.
 */
export class StrandsLanguageModel implements LanguageModel {
  private readonly model: OpenAIModel;

  constructor(config: ModelConfig) {
    this.model = openAIModel(config);
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

/**
 * The plugin builder's author on Strands Agents: one agent per version with a single tool, `check_plugin` (the
 * upload's checks). The agent loops — write, check, fix — until a source passes; the last passing source is the
 * result and the agent's final answer is the summary for the admin.
 */
export class StrandsPluginAuthor implements PluginAuthor {
  private readonly model: OpenAIModel;

  constructor(config: ModelConfig) {
    this.model = openAIModel(config);
  }

  async write(
    task: AuthorTask,
    check: (source: string) => Promise<PluginCheck>,
    signal: AbortSignal,
  ): Promise<AuthorResult> {
    const run = checkRun(check);
    const agent = new Agent({
      model: this.model,
      printer: false,
      systemPrompt: AUTHOR_INSTRUCTIONS,
      tools: [run.tool],
    });
    const answer = await agent.invoke(authorPrompt(task), { cancelSignal: signal });
    const source = run.passed();
    if (!source) throw new AuthorError(run.last());
    return { source, summary: answer.toString().trim() };
  }
}

/** The check tool of one version, remembering the last source that passed and the last result. */
function checkRun(check: (source: string) => Promise<PluginCheck>) {
  const state: { passed: string | null; last: PluginCheck | null; calls: number } = {
    passed: null,
    last: null,
    calls: 0,
  };
  const checkTool = tool({
    name: "check_plugin",
    description:
      "Runs the platform's checks (syntax, imports, types, safety, load, schema) on the WHOLE plugin file, exactly as " +
      'before installing it. Returns { status: "ok", plugin } or { status: "error", stage, errors: [{ message, line, column, snippet }] }.',
    inputSchema: z.object({ source: z.string().describe("The complete plugin file (TypeScript)") }),
    callback: async ({ source }): Promise<JSONValue> => {
      state.calls += 1;
      if (state.calls > MAX_CHECKS) {
        return { status: "error", errors: [{ message: "Check limit reached: stop and answer the admin now." }] };
      }
      const result = await check(source);
      state.last = result;
      if (result.status === "ok") state.passed = source;
      return result as unknown as JSONValue;
    },
  });
  return { tool: checkTool, passed: () => state.passed, last: () => state.last };
}
