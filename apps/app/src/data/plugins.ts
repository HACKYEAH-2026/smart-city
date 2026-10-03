import { useQuery } from "@tanstack/react-query";
import { parseResponse } from "hono/client";
import { api } from "../lib/api";

/** Built-in plugins a new place can start with (the "new place" wizard). They change only with a new API release. */
export function usePluginCatalog() {
  return useQuery({
    queryKey: ["plugins"],
    queryFn: () => parseResponse(api.api.plugins.$get()),
    staleTime: Number.POSITIVE_INFINITY,
  });
}
