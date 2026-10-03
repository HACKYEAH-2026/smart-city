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

  test("without an embedding model: names the missing settings", async () => {
    await expect(ai({}).embed("Latarnia")).rejects.toThrow("(AI_API_KEY, AI_EMBEDDING_MODEL)");
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
