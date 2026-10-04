import { describe, expect, test } from "bun:test";
import type { FileService } from "../files/service";
import { AIService } from "./service";
import type { AIProviders } from "./types";

/** ctx.ai.embed: configuration, input and its own rate limit (embedding never reads files). */
describe("ctx.ai.embed", () => {
  const ai = (providers: AIProviders) => new AIService(providers, {} as FileService).forPlugin("installation_1");
  const sent: string[] = [];
  const embedding = {
    async embed(text: string) {
      sent.push(text);
      return [0.6, 0.8];
    },
  };

  test("without an embedding model (no AI_API_KEY): names the missing key", async () => {
    await expect(ai({}).embed("Latarnia")).rejects.toThrow("(AI_API_KEY)");
  });

  test("sends the trimmed text and returns the model's vector", async () => {
    expect(await ai({ embedding }).embed("  Nie świeci latarnia \n")).toEqual([0.6, 0.8]);
    expect(sent.at(-1)).toBe("Nie świeci latarnia");
  });

  test("empty and too long texts are rejected before the model", async () => {
    const before = sent.length;
    await expect(ai({ embedding }).embed("   ")).rejects.toThrow("empty text");
    await expect(ai({ embedding }).embed("a".repeat(8001))).rejects.toThrow("longer than 8000 characters");
    expect(sent.length).toBe(before);
  });

  test("600 embeddings a minute per installation, counted apart from model calls", async () => {
    const plugin = ai({ embedding, language: { generate: async () => "ok" } });
    await Promise.all(Array.from({ length: 600 }, () => plugin.embed("Latarnia")));
    await expect(plugin.embed("Latarnia")).rejects.toThrow("rate limit");
    expect(await plugin.call({ prompt: "Streść" })).toBe("ok");
  });
});

/** ctx.ai.call with `timeoutMs`: the host gives up on a slow model and tells it to stop. */
describe("ctx.ai.call timeoutMs", () => {
  const ai = (providers: AIProviders) => new AIService(providers, {} as FileService).forPlugin("installation_2");

  test("a model slower than timeoutMs: the call rejects as timed out and the model's signal aborts", async () => {
    const signals: (AbortSignal | undefined)[] = [];
    const slow = {
      generate: (req: { signal?: AbortSignal }) => {
        signals.push(req.signal);
        return new Promise<never>(() => {});
      },
    };
    await expect(ai({ language: slow }).call({ prompt: "Kategoria?", timeoutMs: 20 })).rejects.toThrow(
      "ctx.ai.call timed out after 20 ms",
    );
    expect(signals[0]?.aborted).toBe(true);
  });

  test("a model within timeoutMs answers as usual; without timeoutMs no signal is passed", async () => {
    const signals: (AbortSignal | undefined)[] = [];
    const fast = {
      generate: async (req: { signal?: AbortSignal }) => {
        signals.push(req.signal);
        return "Oświetlenie";
      },
    };
    expect(await ai({ language: fast }).call({ prompt: "Kategoria?", timeoutMs: 1000 })).toBe("Oświetlenie");
    expect(await ai({ language: fast }).call({ prompt: "Kategoria?" })).toBe("Oświetlenie");
    expect(signals[0]?.aborted).toBe(false);
    expect(signals[1]).toBeUndefined();
  });

  test("timeoutMs outside 1–60000 or not whole is rejected before the model", async () => {
    const generate = async () => "ok";
    for (const timeoutMs of [0, -5, 1.5, 60_001]) {
      await expect(ai({ language: { generate } }).call({ prompt: "x", timeoutMs })).rejects.toThrow(
        "timeoutMs must be an integer from 1 to 60000",
      );
    }
  });
});
