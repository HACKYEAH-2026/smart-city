import type { GeoPoint } from "@app/plugin-sdk";
import type { GeoAddress } from "@app/shared";

/**
 * Finding addresses for the place's location picker: by text (the search field) and at a point (the pin).
 * The API asks on the app's behalf, so the providers, their limits and their terms stay on the server.
 */
export interface Geocoder {
  /** Addresses matching the text, the ones near `near` (the map's centre) first. */
  search(query: string, near?: GeoPoint): Promise<GeoAddress[]>;
  /** The address at the point, or null when there is none nearby (a field, a park). */
  reverse(point: GeoPoint): Promise<GeoAddress | null>;
}
