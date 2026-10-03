import type { AiPlugin } from "@app/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { parseResponse } from "hono/client";
import { api } from "../lib/api";

/**
 * The plugin builder's data (frontend data pattern: useQuery + useMutation). The AI writes a version in the
 * background, so a plugin is polled while its latest version is "working". The place's list of plugins (drafts
 * included) is usePlacePlugins; publishing changes the place's plugins, navigation and dashboard, so all of the
 * place's data is refetched.
 */
const c = api.api.communities;

const placeKey = (slug: string) => ["communities", slug] as const;
const pluginsKey = (slug: string) => [...placeKey(slug), "plugins"] as const;
const aiPluginKey = (slug: string, id: string) => [...pluginsKey(slug), id] as const;

const POLL_MS = 2000;

/** An AI plugin of the place with its versions; polled every few seconds while the AI is writing. */
export function useAiPlugin(slug: string, id: string | undefined) {
  return useQuery({
    queryKey: aiPluginKey(slug, id ?? ""),
    queryFn: () => parseResponse(c[":slug"].plugins[":pluginId"].$get({ param: { slug, pluginId: id ?? "" } })),
    enabled: Boolean(id),
    refetchInterval: (query) => (query.state.data?.status === "working" ? POLL_MS : false),
  });
}

/** A new plugin from a description; resolves with the draft (its first version is being written). */
export function useCreatePlugin(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (request: string) => parseResponse(c[":slug"].plugins.$post({ param: { slug }, json: { request } })),
    onSuccess: (plugin: AiPlugin) => {
      qc.setQueryData(aiPluginKey(slug, plugin.id), plugin);
      return qc.invalidateQueries({ queryKey: pluginsKey(slug), exact: true });
    },
  });
}

/** A change to the plugin: a new version the AI writes from the latest ready one. */
export function useChangePlugin(slug: string, id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (request: string) =>
      parseResponse(
        c[":slug"].plugins[":pluginId"].versions.$post({ param: { slug, pluginId: id }, json: { request } }),
      ),
    onSuccess: (plugin: AiPlugin) => {
      qc.setQueryData(aiPluginKey(slug, id), plugin);
      return qc.invalidateQueries({ queryKey: pluginsKey(slug), exact: true });
    },
  });
}

/** Installs the latest ready version in the place and switches it on. */
export function usePublishPlugin(slug: string, id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => parseResponse(c[":slug"].plugins[":pluginId"].publish.$post({ param: { slug, pluginId: id } })),
    onSuccess: (plugin: AiPlugin) => {
      qc.setQueryData(aiPluginKey(slug, id), plugin);
      return qc.invalidateQueries({ queryKey: placeKey(slug) });
    },
  });
}
