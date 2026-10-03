import { geoPointSchema } from "@app/plugin-sdk";
import { z } from "zod";
import type { JoinRule, PlaceKind } from "./communities";

/** Contracts of /api/geo: finding addresses (the place's location picker) and the map of places. */

/** Searching for an address; `near` (the map's centre) ranks nearby results first. */
export const geoSearchSchema = z.object({
  q: z.string().trim().min(2).max(120),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});
/** The address at a point on the map (query string: numbers as text). */
export const geoReverseSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

/**
 * An address with its point. `label` and `detail` are the two lines of a search result ("TwistCafe" /
 * "Floriańska 15, 31-019 Kraków"); `address` is the postal address alone, what a place stores: "Floriańska 15,
 * 31-019 Kraków".
 */
export const geoAddressSchema = geoPointSchema.extend({ label: z.string(), detail: z.string(), address: z.string() });
export type GeoAddress = z.infer<typeof geoAddressSchema>;

/**
 * A place on the map of places (GET /api/geo/places): public places and the user's own. `slug` only for its members
 * (they can open it); others learn its name, kind, address and join rule.
 */
export type MapPlace = {
  id: string;
  name: string;
  kind: PlaceKind;
  address: string;
  joinRule: JoinRule;
  lat: number;
  lng: number;
  slug: string | null;
};
