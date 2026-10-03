import type { GoogleClientIds } from "@app/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { parseResponse } from "hono/client";
import { useEffect, useState } from "react";
import { api, authClient, tokens } from "../lib/api";
import { googleIdToken, googleSignInAvailable, googleSignOut } from "../lib/google";
import { unregisterDevice } from "./push";

/** Token loaded once at startup (natively: Keychain/Keystore — asynchronously). */
const loading = tokens.load();

export function useTokensReady(): boolean {
  const [ready, setReady] = useState(tokens.isLoaded());
  useEffect(() => {
    let alive = true;
    loading.then(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);
  return ready;
}

export const sessionKey = ["session"] as const;

async function fetchSession() {
  if (!tokens.get()) return null;
  const { data } = await authClient.getSession();
  return data?.user ?? null;
}

/** Signed-in user (null = no session). Waits for the token to load. */
export function useSession() {
  const ready = useTokensReady();
  return useQuery({ queryKey: sessionKey, enabled: ready, queryFn: fetchSession });
}

/** Auth calls never throw: a failed request (also an unreachable API) becomes `{ error }`, as Better Auth reports. */
const networkError = (error: unknown) => ({ error });

/** Google client IDs from the API; null = no Google button (off on the API, or no account picker here: Expo Go). */
export function useGoogleClientIds() {
  return useQuery({
    queryKey: ["auth-providers"],
    queryFn: () => parseResponse(api.api["auth-providers"].$get()),
    staleTime: Number.POSITIVE_INFINITY,
    select: ({ google }) => (google && googleSignInAvailable(google) ? google : null),
  });
}

/** "exists" = the email already has a password account; Google is not linked to it (apps/api/src/auth.ts). */
export type GoogleSignInResult = "ok" | "cancelled" | "exists" | "error";

const errorCode = (error: unknown) => (error && typeof error === "object" && "code" in error ? error.code : null);

/** The account picker gives an ID token; the API verifies it and opens a session (creating the account at first). */
async function googleSession(ids: GoogleClientIds): Promise<GoogleSignInResult> {
  const token = await googleIdToken(ids);
  if (!token) return "cancelled";
  const { error } = await authClient.signIn.social({ provider: "google", idToken: { token } }).catch(networkError);
  if (!error) return "ok";
  return errorCode(error) === "OAUTH_LINK_ERROR" ? "exists" : "error";
}

const googleFailed = (err: unknown): GoogleSignInResult => {
  // E.g. DEVELOPER_ERROR on Android: the app's package or SHA-1 is not registered in the Google project.
  console.warn("google: sign-in failed", err);
  return "error";
};

/**
 * Sign-in/sign-up/sign-out; error = false (also when the API is unreachable: the screen shows its message
 * instead of an uncaught "Failed to fetch"); Google returns a GoogleSignInResult. After a session change we fetch it
 * EXPLICITLY (fetchQuery) before the screen moves on — invalidateQueries alone does not refresh an inactive
 * query, so the /app guard would see the stale "no session" result.
 */
export function useAuthActions() {
  const qc = useQueryClient();
  const refresh = () => qc.fetchQuery({ queryKey: sessionKey, queryFn: fetchSession, staleTime: 0 });
  return {
    signIn: async (email: string, password: string) => {
      const { error } = await authClient.signIn.email({ email, password }).catch(networkError);
      if (!error) await refresh();
      return !error;
    },
    signUp: async (email: string, password: string, name: string) => {
      const { error } = await authClient.signUp.email({ email, password, name: name || email }).catch(networkError);
      if (!error) await refresh();
      return !error;
    },
    signInWithGoogle: async (ids: GoogleClientIds) => {
      const result = await googleSession(ids).catch(googleFailed);
      if (result === "ok") await refresh();
      return result;
    },
    signOut: async () => {
      await unregisterDevice().catch(() => {});
      await googleSignOut().catch(() => {});
      await authClient.signOut();
      await tokens.clear();
      qc.clear();
      qc.setQueryData(sessionKey, null);
    },
  };
}
