import type { PlaceCreate } from "@app/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { parseResponse } from "hono/client";
import { api } from "../lib/api";

/**
 * The signed-in user's own data on the account (frontend data pattern: useQuery + useMutation): the notification
 * inbox the places' plugins fill (ctx.notify) and the saved addresses that "near" notifications reach.
 */
const me = api.api.me;

const notificationsKey = ["me", "notifications"] as const;
const savedPlacesKey = ["me", "places"] as const;

/** The newest notifications and the unread count; refetched periodically while shown (a push may bring more). */
export function useNotifications() {
  return useQuery({
    queryKey: notificationsKey,
    queryFn: () => parseResponse(me.notifications.$get()),
    refetchInterval: 30_000,
  });
}

/** Marks the given notifications as read; without ids, all of them. */
export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids?: string[]) => parseResponse(me.notifications.read.$post({ json: ids ? { ids } : {} })),
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationsKey }),
  });
}

/** Saved addresses (private to the user): "near" notifications reach the user there. */
export function useSavedPlaces() {
  return useQuery({ queryKey: savedPlacesKey, queryFn: () => parseResponse(me.places.$get()) });
}

export function useAddSavedPlace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (place: PlaceCreate) => parseResponse(me.places.$post({ json: place })),
    onSuccess: () => qc.invalidateQueries({ queryKey: savedPlacesKey }),
  });
}

export function useRemoveSavedPlace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await me.places[":id"].$delete({ param: { id } });
      if (!res.ok) throw new Error(`saved place not removed: HTTP ${res.status}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: savedPlacesKey }),
  });
}
