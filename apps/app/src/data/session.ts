import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { authClient, tokens } from "../lib/api";

/** Token wczytywany raz przy starcie (natywnie: Keychain/Keystore — asynchronicznie). */
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

/** Zalogowany użytkownik (null = brak sesji). Czeka na wczytanie tokenu. */
export function useSession() {
  const ready = useTokensReady();
  return useQuery({ queryKey: sessionKey, enabled: ready, queryFn: fetchSession });
}

/**
 * Logowanie/rejestracja/wylogowanie; błąd = false. Po zmianie sesji pobieramy ją JAWNIE
 * (fetchQuery), zanim ekran przejdzie dalej — samo invalidateQueries nie odświeża nieaktywnego
 * zapytania, więc strażnik /app zobaczyłby stary wynik "brak sesji".
 */
export function useAuthActions() {
  const qc = useQueryClient();
  const refresh = () => qc.fetchQuery({ queryKey: sessionKey, queryFn: fetchSession, staleTime: 0 });
  return {
    signIn: async (email: string, password: string) => {
      const { error } = await authClient.signIn.email({ email, password });
      if (!error) await refresh();
      return !error;
    },
    signUp: async (email: string, password: string, name: string) => {
      const { error } = await authClient.signUp.email({ email, password, name: name || email });
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
