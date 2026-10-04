import type { ToolResult, ViewParams } from "@app/plugin-sdk";
import type { DashboardLayoutInput, JoinPlace, MemberRole, NewPlace, PlaceUpdate } from "@app/shared";
import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { parseResponse } from "hono/client";
import { api } from "../lib/api";
import { mapPlacesKey } from "./geo";

/**
 * Community and plugin data (frontend data pattern: useQuery + useMutation). Plugin views arrive from the API as a UI tree
 * (Server-Driven UI); after a tool call we refresh all views of that plugin.
 */
const c = api.api.communities;

export const communitiesKey = ["communities"] as const;
const communityKey = (slug: string) => ["communities", slug] as const;
const dashboardKey = (slug: string) => [...communityKey(slug), "dashboard"] as const;
/** Under the dashboard's key, so whatever refreshes the dashboard (a reorder, a plugin switched on) refreshes it too. */
const dashboardLayoutKey = (slug: string): readonly string[] => [...dashboardKey(slug), "layout"];
const pluginKey = (slug: string, pluginId: string) => [...communityKey(slug), "plugin", pluginId] as const;
const membersKey = (slug: string) => [...communityKey(slug), "members"];
/**
 * Reloads the place and everything under it. After a failed member change: another admin may have revoked the
 * caller's rights (403) or removed them (404), and the screens should show that, not stale admin controls.
 */
const refreshPlace = (qc: QueryClient, slug: string) => qc.invalidateQueries({ queryKey: communityKey(slug) });

export function useCommunities() {
  return useQuery({ queryKey: communitiesKey, queryFn: () => parseResponse(c.$get()) });
}

export function useCommunity(slug: string) {
  return useQuery({ queryKey: communityKey(slug), queryFn: () => parseResponse(c[":slug"].$get({ param: { slug } })) });
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

/**
 * Community admins: the dashboard layout to arrange (widgets on it with their sizes, and the removed ones). Fetched
 * again on every mount even when cached: the editor starts its draft only from data fetched after it opened, never
 * from a copy cached before.
 */
export function useDashboardLayout(slug: string) {
  return useQuery({
    queryKey: dashboardLayoutKey(slug),
    queryFn: () => parseResponse(c[":slug"].dashboard.layout.$get({ param: { slug } })),
    refetchOnMount: "always",
  });
}

/** Community admins: save the dashboard layout; the dashboard and the layout (under its key) are refetched. */
export function useSaveDashboardLayout(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (layout: DashboardLayoutInput) =>
      parseResponse(c[":slug"].dashboard.layout.$put({ param: { slug }, json: layout })),
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
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: communitiesKey }),
        qc.invalidateQueries({ queryKey: mapPlacesKey }),
      ]),
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
      void qc.invalidateQueries({ queryKey: invitationsKey });
      void qc.invalidateQueries({ queryKey: communitiesKey });
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

/** Managing a place, for its admins ("Zarządzaj miejscem"): members, plugins on and off, settings, deleting it. */
export function usePlaceMembers(slug: string) {
  return useQuery({
    queryKey: membersKey(slug),
    queryFn: () => parseResponse(c[":slug"].members.$get({ param: { slug } })),
  });
}

/** Makes another member an admin or a plain member again. */
export function useSetMemberRole(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string } & MemberRole) =>
      parseResponse(c[":slug"].members[":userId"].$patch({ param: { slug, userId }, json: { role } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: membersKey(slug) }),
    onError: () => refreshPlace(qc, slug),
  });
}

/** Removes another member from the place. */
export function useRemoveMember(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => parseResponse(c[":slug"].members[":userId"].$delete({ param: { slug, userId } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: membersKey(slug) }),
    onError: () => refreshPlace(qc, slug),
  });
}

/** The built-in plugins and whether each is on in the place. */
export function usePlacePlugins(slug: string) {
  return useQuery({
    queryKey: [...communityKey(slug), "plugins"],
    queryFn: () => parseResponse(c[":slug"].plugins.$get({ param: { slug } })),
  });
}

/**
 * Switches one of the place's plugins on or off: a built-in one or a published AI one (a draft goes on by publishing);
 * the place's navigation, dashboard and views follow. `onSwitched` runs once the API has switched it, before that
 * refetch: a screen that is about the plugin (its page) leaves before it shows the plugin gone. It is part of the
 * mutation, so it runs even when the refetch unmounts the component that asked.
 */
export function useSwitchPlugin(slug: string, options: { onSwitched?: () => void } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pluginId, enabled }: { pluginId: string; enabled: boolean }) =>
      parseResponse(c[":slug"].plugins[":pluginId"].$put({ param: { slug, pluginId }, json: { enabled } })),
    onSuccess: () => {
      options.onSwitched?.();
      return qc.invalidateQueries({ queryKey: communityKey(slug) });
    },
  });
}

/** Changes the place's settings (its name shows in every list of places, so all place data is refetched). */
export function useUpdatePlace(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (update: PlaceUpdate) => parseResponse(c[":slug"].$patch({ param: { slug }, json: update })),
    onSuccess: () => qc.invalidateQueries({ queryKey: communitiesKey }),
  });
}

/** Deletes the place for everyone. */
export function useDeletePlace(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => parseResponse(c[":slug"].$delete({ param: { slug } })),
    onSuccess: () => {
      qc.removeQueries({ queryKey: communityKey(slug) });
      return qc.invalidateQueries({ queryKey: communitiesKey });
    },
  });
}

/** An admin invites a user to the place by the email of their account. */
export function useInvite(slug: string) {
  return useMutation({
    mutationFn: (email: string) => parseResponse(invitations.$post({ json: { slug, email } })),
  });
}
