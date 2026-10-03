import type { AppType } from "@app/api";
import { createAuthClient } from "better-auth/client";
import { hc } from "hono/client";
import { apiBaseUrl } from "./config";
import { storage } from "./storage";
import { createTokenStore } from "./token";

export const tokens = createTokenStore(storage);

/** Klient RPC: typy tras i odpowiedzi pochodzą wprost z apps/api (jedno źródło prawdy). */
export const api = hc<AppType>(apiBaseUrl(), { headers: () => tokens.headers() });

export const authClient = createAuthClient({
  baseURL: apiBaseUrl(),
  basePath: "/api/auth",
  fetchOptions: {
    auth: { type: "Bearer", token: () => tokens.get() ?? "" },
    onSuccess: (ctx) => tokens.capture(ctx.response.headers),
  },
});
