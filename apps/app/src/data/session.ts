import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { authClient, tokens } from "../lib/api";

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

/**
 * Sign-in/sign-up/sign-out; error = false (also when the API is unreachable: the screen shows its message
 * instead of an uncaught "Failed to fetch"). After a session change we fetch it EXPLICITLY
 * (fetchQuery) before the screen moves on — invalidateQueries alone does not refresh an inactive
 * query, so the /app guard would see the stale "no session" result.
 */
const networkError = (error: unknown) => ({ error });

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
    signOut: async () => {
      await authClient.signOut();
      await tokens.clear();
      qc.clear();
      qc.setQueryData(sessionKey, null);
    },
  };
}
