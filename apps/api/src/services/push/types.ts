import type { PushData } from "@app/shared";

/**
 * One push to one device, in the Expo Push Service message format. Android shows it on `channelId` (the app
 * creates "alerts" with high importance and "default"); `data` tells the app what to open on tap.
 */
export type PushMessage = {
  to: string;
  title: string;
  body: string;
  data: PushData;
  sound: "default";
  priority: "default" | "high";
  channelId: "alerts" | "default";
};

/** Delivers pushes to phones; returns the tokens of devices that no longer exist (to forget them). */
export interface PushSender {
  send(messages: PushMessage[]): Promise<{ invalidTokens: string[] }>;
}
