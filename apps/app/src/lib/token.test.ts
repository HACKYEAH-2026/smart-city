import { describe, expect, test } from "bun:test";
import type { Storage } from "./storage";
import { createTokenStore, TOKEN_KEY } from "./token";

const memory = (): Storage & { map: Map<string, string> } => {
  const map = new Map<string, string>();
  return {
    map,
    get: async (k) => map.get(k) ?? null,
    set: async (k, v) => void map.set(k, v),
    remove: async (k) => void map.delete(k),
  };
};

describe("token", () => {
  test("capture stores the token from set-auth-token and builds the Bearer header", async () => {
    const s = memory();
    const t = createTokenStore(s);
    await t.capture(new Headers({ "set-auth-token": "abc" }));
    expect(t.headers()).toEqual({ authorization: "Bearer abc" });
    expect(s.map.get(TOKEN_KEY)).toBe("abc");
  });

  test("load restores the token after a restart, clear removes it from memory and storage", async () => {
    const s = memory();
    s.map.set(TOKEN_KEY, "persisted");
    const t = createTokenStore(s);
    expect(t.isLoaded()).toBe(false);
    await t.load();
    expect(t.get()).toBe("persisted");
    await t.clear();
    expect(t.headers()).toEqual({});
    expect(s.map.has(TOKEN_KEY)).toBe(false);
  });

  test("a response without the header does not overwrite the token", async () => {
    const t = createTokenStore(memory());
    await t.capture(new Headers({ "set-auth-token": "abc" }));
    await t.capture(new Headers());
    expect(t.get()).toBe("abc");
  });
});
