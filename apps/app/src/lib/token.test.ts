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
  test("capture zapisuje token z set-auth-token i buduje nagłówek Bearer", async () => {
    const s = memory();
    const t = createTokenStore(s);
    await t.capture(new Headers({ "set-auth-token": "abc" }));
    expect(t.headers()).toEqual({ authorization: "Bearer abc" });
    expect(s.map.get(TOKEN_KEY)).toBe("abc");
  });

  test("load przywraca token po restarcie, clear usuwa go z pamięci i magazynu", async () => {
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

  test("odpowiedź bez nagłówka nie nadpisuje tokenu", async () => {
    const t = createTokenStore(memory());
    await t.capture(new Headers({ "set-auth-token": "abc" }));
    await t.capture(new Headers());
    expect(t.get()).toBe("abc");
  });
});
