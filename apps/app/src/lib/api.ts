import type { AppType } from "@app/api";
import { createAuthClient } from "better-auth/client";
import { hc } from "hono/client";
import { apiBaseUrl } from "./config";
import { storage } from "./storage";
import { createTokenStore } from "./token";

export const tokens = createTokenStore(storage);

/** RPC client: route and response types come straight from apps/api (single source of truth). */
export const api = hc<AppType>(apiBaseUrl(), { headers: () => tokens.headers() });

export const authClient = createAuthClient({
  baseURL: apiBaseUrl(),
  basePath: "/api/auth",
  fetchOptions: {
    auth: { type: "Bearer", token: () => tokens.get() ?? "" },
    onSuccess: (ctx) => tokens.capture(ctx.response.headers),
  },
});
