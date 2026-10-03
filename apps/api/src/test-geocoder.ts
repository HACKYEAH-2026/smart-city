import type { GeoPoint } from "@app/plugin-sdk";
import { addressLine, type GeoAddress } from "@app/shared";
import type { Geocoder } from "./services/geo/types";

/**
 * Geocoder for integration tests and E2E: a few fixed Kraków addresses, no network. A search matches the addresses
 * that contain every word of the query; the address at a point is the nearest one. Never import it from production
 * code.
 */
export const TEST_ADDRESSES: GeoAddress[] = [
  { label: "Floriańska 15", detail: "31-019 Kraków", lat: 50.06274, lng: 19.93986 },
  { label: "pl. Wszystkich Świętych 3-4", detail: "31-004 Kraków", lat: 50.05967, lng: 19.93775 },
  { label: "Rynek Główny 1", detail: "31-042 Kraków", lat: 50.06165, lng: 19.93733 },
];

const distance2 = (a: GeoPoint, b: GeoPoint) => (a.lat - b.lat) ** 2 + (a.lng - b.lng) ** 2;

export class TestGeocoder implements Geocoder {
  async search(query: string) {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return TEST_ADDRESSES.filter((a) => words.every((word) => addressLine(a).toLowerCase().includes(word)));
  }

  async reverse(point: GeoPoint) {
    return TEST_ADDRESSES.toSorted((a, b) => distance2(a, point) - distance2(b, point))[0] ?? null;
  }
}
