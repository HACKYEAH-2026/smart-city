import type { ToolResult, ViewParams } from "@app/plugin-sdk";
import type { JoinPlace, NewPlace } from "@app/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { parseResponse } from "hono/client";
import { api } from "../lib/api";

/**
 * Community and plugin data (frontend data pattern: useQuery + useMutation). Plugin views arrive from the API as a UI tree
 * (Server-Driven UI); after a tool call we refresh all views of that plugin.
 */
const c = api.api.communities;

export const communitiesKey = ["communities"] as const;
const communityKey = (slug: string) => ["communities", slug] as const;
const dashboardKey = (slug: string) => [...communityKey(slug), "dashboard"] as const;
const pluginKey = (slug: string, pluginId: string) => [...communityKey(slug), "plugin", pluginId] as const;

export function useCommunities() {
  return useQuery({ queryKey: communitiesKey, queryFn: () => parseResponse(c.$get()) });
}

export function useCommunity(slug: string) {
  return useQuery({ queryKey: communityKey(slug), queryFn: () => parseResponse(c[":slug"].$get({ param: { slug } })) });
}

/** Navigation polled every few seconds: a newly installed plugin appears without a reload. */
export function useCommunityNav(slug: string) {
  return useQuery({
    queryKey: [...communityKey(slug), "nav"],
    queryFn: () => parseResponse(c[":slug"].nav.$get({ param: { slug } })),
    refetchInterval: 5000,
  });
}

/** Dashboard (widgets rendered for this user, in the community's order); refetched on every visit and periodically. */
export function useDashboard(slug: string) {
  return useQuery({
    queryKey: dashboardKey(slug),
    queryFn: () => parseResponse(c[":slug"].dashboard.$get({ param: { slug } })),
    refetchInterval: 15000,
  });
}

/** Community admins: save the dashboard widget order ("<pluginId>/<widget>" keys). */
export function useSaveDashboardOrder(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (order: string[]) => parseResponse(c[":slug"].dashboard.$patch({ param: { slug }, json: { order } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: dashboardKey(slug) }),
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

/** Opening a place: it becomes the user's last visited place (the dashboard shows it). */
export function useVisitPlace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slug: string) => parseResponse(c[":slug"].visit.$post({ param: { slug } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: communitiesKey }),
  });
}

/** The place behind an invite code, before joining; no retries, an unknown code is an answer. */
export function usePlacePreview(code: string) {
  return useQuery({
    queryKey: ["communities", "invite", code],
    queryFn: () => parseResponse(c.invite[":code"].$get({ param: { code } })),
    retry: false,
  });
}

/** Looks a place up by an invite code the user typed or pasted (nothing is joined); a wrong code is an error. */
export function useFindPlace() {
  return useMutation({
    mutationFn: (code: string) => parseResponse(c.invite[":code"].$get({ param: { code } })),
  });
}

/** Joins an open place by its invite code; the place becomes the user's last visited one. */
export function useJoinPlace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (join: JoinPlace) => parseResponse(c.join.$post({ json: join })),
    onSuccess: () => qc.invalidateQueries({ queryKey: communitiesKey }),
  });
}

/** Makes a place the user's default place. */
export function useSetDefaultPlace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slug: string) => parseResponse(c[":slug"].default.$put({ param: { slug } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: communitiesKey }),
  });
}

/** Creating a place (the wizard's answers): the creator becomes its admin; the answer holds the invite code. */
export function useCreatePlace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (place: NewPlace) => parseResponse(c.$post({ json: place })),
    onSuccess: () => qc.invalidateQueries({ queryKey: communitiesKey }),
  });
}

const invitations = api.api.invitations;
export const invitationsKey = ["invitations"] as const;

/** Invitations to places addressed to the signed-in user. */
export function useInvitations() {
  return useQuery({ queryKey: invitationsKey, queryFn: () => parseResponse(invitations.$get()) });
}

/** Accepting an invitation joins the place, which then becomes the user's last visited one. */
export function useAcceptInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => parseResponse(invitations[":id"].accept.$post({ param: { id } })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: invitationsKey });
      qc.invalidateQueries({ queryKey: communitiesKey });
    },
  });
}

/** Declining an invitation removes it. */
export function useDeclineInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => parseResponse(invitations[":id"].$delete({ param: { id } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: invitationsKey }),
  });
}
