import type { PluginCheck } from "@app/plugin-sdk";
import { AfterModelCallEvent, Agent, type AgentResult, type JSONValue, tool } from "@strands-agents/sdk";
import type { OpenAIModel } from "@strands-agents/sdk/models/openai";
import { z } from "zod";
import { logger } from "../../../log";
import { type ModelConfig, openAIModel } from "../model";
import { AUTHOR_INSTRUCTIONS, authorPrompt } from "./prompt";
import { AuthorError, type AuthorResult, type AuthorTask, MAX_CHECKS, type PluginAuthor } from "./types";

const log = logger("author");

/**
 * The plugin builder's author on Strands Agents: one agent per version with a single tool, `check_plugin` (the
 * upload's checks). The agent loops — write, check, fix — until a source passes; the last passing source is the
 * result and the agent's final answer is the summary for the admin. Logs every model call (failed ones as warnings,
 * with the provider's status and message) and, at the end, why the agent stopped and the tokens it used.
 */
export class StrandsPluginAuthor implements PluginAuthor {
  private readonly model: OpenAIModel;
  private readonly modelId: string;

  constructor(config: ModelConfig) {
    this.model = openAIModel(config);
    this.modelId = config.model;
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
    agent.addHook(AfterModelCallEvent, logModelCall);
    log.info("agent started", { model: this.modelId, change: task.previous !== null });
    const answer = await agent.invoke(authorPrompt(task), { cancelSignal: signal });
    const text = answer.toString().trim();
    log.info("agent stopped", { stopReason: answer.stopReason, checks: run.calls(), ...usageOf(answer) });
    const source = run.passed();
    if (!source) throw new AuthorError(run.last(), text);
    return { source, summary: text };
  }
}

/** One model request of the agent: debug when it answered, a warning with the error when it failed (Strands may retry). */
function logModelCall(event: AfterModelCallEvent): void {
  if (event.error) log.warn("model call failed", { attempt: event.attemptCount, err: event.error });
  else log.debug("model answered", { attempt: event.attemptCount, stopReason: event.stopData?.stopReason });
}

/** Model turns and tokens of the whole run (what the version cost). */
function usageOf(result: AgentResult) {
  const metrics = result.metrics;
  if (!metrics) return {};
  const { inputTokens, outputTokens } = metrics.accumulatedUsage;
  return { cycles: metrics.cycleCount, inputTokens, outputTokens };
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
        log.warn("check refused: the limit is reached", { max: MAX_CHECKS });
        return { status: "error", errors: [{ message: "Check limit reached: stop and answer the admin now." }] };
      }
      const result = await check(source);
      state.last = result;
      if (result.status === "ok") state.passed = source;
      return result as unknown as JSONValue;
    },
  });
  return { tool: checkTool, passed: () => state.passed, last: () => state.last, calls: () => state.calls };
}
