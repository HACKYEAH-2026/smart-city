import type { GeoPoint } from "@app/plugin-sdk";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { parseResponse } from "hono/client";
import { api } from "../lib/api";

/** Maps: addresses for a place's pin (the API asks the geocoder) and the map of places. */
const geo = api.api.geo;

export const mapPlacesKey = ["geo", "places"] as const;

/** Addresses matching a submitted search (null = nothing submitted yet); `near` = the map's centre. */
export function useAddressSearch(query: string | null, near: GeoPoint) {
  return useQuery({
    queryKey: ["geo", "search", query],
    queryFn: () =>
      parseResponse(geo.search.$get({ query: { q: query ?? "", lat: String(near.lat), lng: String(near.lng) } })),
    enabled: Boolean(query),
    staleTime: Number.POSITIVE_INFINITY,
  });
}

/** Rounded to about a metre, so the same spot is asked once. */
const round = (value: number) => value.toFixed(5);

/** The address at the pin (null = no pin). Keeps the previous answer while the next one loads. */
export function useAddressAt(point: GeoPoint | null) {
  return useQuery({
    queryKey: ["geo", "reverse", point ? round(point.lat) : null, point ? round(point.lng) : null],
    queryFn: () =>
      parseResponse(geo.reverse.$get({ query: { lat: round(point?.lat ?? 0), lng: round(point?.lng ?? 0) } })),
    enabled: point !== null,
    staleTime: Number.POSITIVE_INFINITY,
    placeholderData: keepPreviousData,
  });
}

/** Places on the map: the public ones and the user's own (refreshed after creating a place, see communities.ts). */
export function useMapPlaces() {
  return useQuery({ queryKey: mapPlacesKey, queryFn: () => parseResponse(geo.places.$get()) });
}
