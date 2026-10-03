import type { PushMessage, PushSender } from "./types";

export const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
/** Expo accepts at most 100 messages per request. */
const BATCH = 100;

type Ticket = { status: "ok" | "error"; details?: { error?: string } };

const batches = <T>(items: T[]): T[][] =>
  Array.from({ length: Math.ceil(items.length / BATCH) }, (_, i) => items.slice(i * BATCH, (i + 1) * BATCH));

/**
 * Push to Android and iOS through the Expo Push Service (it forwards to FCM and APNs with the credentials stored
 * in the Expo project). `accessToken` (EXPO_ACCESS_TOKEN) is needed only when the project enables enhanced push
 * security. Tickets come back in message order; DeviceNotRegistered = the app was uninstalled.
 */
export class ExpoPushSender implements PushSender {
  private readonly fetch: typeof globalThis.fetch;
  private readonly accessToken?: string;

  constructor(opts: { fetch?: typeof globalThis.fetch; accessToken?: string } = {}) {
    this.fetch = opts.fetch ?? globalThis.fetch;
    this.accessToken = opts.accessToken;
  }

  async send(messages: PushMessage[]): Promise<{ invalidTokens: string[] }> {
    const results = await Promise.all(batches(messages).map((batch) => this.sendBatch(batch)));
    return { invalidTokens: results.flat() };
  }

  private async sendBatch(batch: PushMessage[]): Promise<string[]> {
    const res = await this.fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        ...(this.accessToken ? { authorization: `Bearer ${this.accessToken}` } : {}),
      },
      body: JSON.stringify(batch),
    });
    if (!res.ok) throw new Error(`Expo push failed: HTTP ${res.status} ${await res.text()}`);
    const { data } = (await res.json()) as { data: Ticket[] };
    return batch.filter((_, i) => data[i]?.details?.error === "DeviceNotRegistered").map((m) => m.to);
  }
}
