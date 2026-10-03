import type { ToolResult, ViewParams } from "@app/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { parseResponse } from "hono/client";
import { api } from "../lib/api";

/**
 * Dane społeczności i wtyczek (wzorzec jak notes.ts). Widoki wtyczek przychodzą z API jako drzewo UI
 * (Server-Driven UI); po wywołaniu narzędzia odświeżamy wszystkie widoki tej wtyczki.
 */
const c = api.api.communities;

export const communitiesKey = ["communities"] as const;
const communityKey = (slug: string) => ["communities", slug] as const;
const pluginKey = (slug: string, pluginId: string) => [...communityKey(slug), "plugin", pluginId] as const;

export function useCommunities() {
  return useQuery({ queryKey: communitiesKey, queryFn: () => parseResponse(c.$get()) });
}

export function useCommunity(slug: string) {
  return useQuery({ queryKey: communityKey(slug), queryFn: () => parseResponse(c[":slug"].$get({ param: { slug } })) });
}

/** Nawigacja odpytywana co kilka sekund: nowo zainstalowana wtyczka pojawia się bez przeładowania. */
export function useCommunityNav(slug: string) {
  return useQuery({
    queryKey: [...communityKey(slug), "nav"],
    queryFn: () => parseResponse(c[":slug"].nav.$get({ param: { slug } })),
    refetchInterval: 5000,
  });
}

export function usePluginView(slug: string, pluginId: string, view: string, params: ViewParams) {
  return useQuery({
    queryKey: [...pluginKey(slug, pluginId), "view", view, params],
    queryFn: () =>
      parseResponse(
        c[":slug"].plugins[":pluginId"].views[":view"].$get({ param: { slug, pluginId, view }, query: params }),
      ),
  });
}

export function useToolCall(slug: string, pluginId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tool, args }: { tool: string; args: Record<string, unknown> }): Promise<ToolResult> =>
      parseResponse(
        c[":slug"].plugins[":pluginId"].tools[":tool"].$post({ param: { slug, pluginId, tool }, json: { args } }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: pluginKey(slug, pluginId) }),
  });
}
