import { describe, expect, test } from "bun:test";
import { EXPO_PUSH_URL, ExpoPushSender } from "../src/services/push/expo";
import type { PushMessage } from "../src/services/push/types";

/** Expo Push Service client: batching, auth, and which device tokens to forget. No network: fetch is faked. */
type Call = { url: string; headers: Headers; body: PushMessage[] };

const message = (n: number): PushMessage => ({
  to: `ExponentPushToken[device-${n}]`,
  title: "Uwaga, dzik!",
  body: "Ok. 150 m od Ciebie",
  data: { notificationId: `n${n}`, community: "krakow", pluginId: "sightings", open: null },
  sound: "default",
  priority: "high",
  channelId: "alerts",
});

/** A fake Expo API: answers each batch with tickets from `ticket(message)`. */
function fakeExpo(ticket: (m: PushMessage) => unknown = () => ({ status: "ok", id: "t" }), status = 200) {
  const calls: Call[] = [];
  const fetch = async (url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as PushMessage[];
    calls.push({ url: String(url), headers: new Headers(init?.headers), body });
    return new Response(JSON.stringify({ data: body.map(ticket) }), { status });
  };
  return { calls, fetch: fetch as typeof globalThis.fetch };
}

describe("ExpoPushSender", () => {
  test("sends in batches of at most 100; Authorization only with an access token", async () => {
    const plain = fakeExpo();
    await new ExpoPushSender({ fetch: plain.fetch }).send(Array.from({ length: 250 }, (_, n) => message(n)));
    expect(plain.calls.map((c) => c.body.length)).toEqual([100, 100, 50]);
    expect(plain.calls[0]?.url).toBe(EXPO_PUSH_URL);
    expect(plain.calls[0]?.body[0]).toEqual(message(0));
    expect(plain.calls[0]?.headers.get("content-type")).toBe("application/json");
    expect(plain.calls[0]?.headers.get("authorization")).toBeNull();

    const secured = fakeExpo();
    await new ExpoPushSender({ fetch: secured.fetch, accessToken: "expo-secret" }).send([message(1)]);
    expect(secured.calls[0]?.headers.get("authorization")).toBe("Bearer expo-secret");
  });

  test("nothing to send: no request", async () => {
    const expo = fakeExpo();
    expect(await new ExpoPushSender({ fetch: expo.fetch }).send([])).toEqual({ invalidTokens: [] });
    expect(expo.calls).toEqual([]);
  });

  test("tokens Expo reports as DeviceNotRegistered are returned to be forgotten", async () => {
    const expo = fakeExpo((m) =>
      m.to.includes("device-1")
        ? { status: "error", message: "not registered", details: { error: "DeviceNotRegistered" } }
        : m.to.includes("device-2")
          ? { status: "error", message: "rate", details: { error: "MessageRateExceeded" } }
          : { status: "ok", id: "t" },
    );
    const result = await new ExpoPushSender({ fetch: expo.fetch }).send([message(0), message(1), message(2)]);
    expect(result).toEqual({ invalidTokens: ["ExponentPushToken[device-1]"] });
  });

  test("an HTTP error from Expo throws (the caller logs it)", async () => {
    const expo = fakeExpo(undefined, 500);
    await expect(new ExpoPushSender({ fetch: expo.fetch }).send([message(0)])).rejects.toThrow("500");
  });
});
