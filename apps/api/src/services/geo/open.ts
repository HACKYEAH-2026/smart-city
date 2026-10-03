import type { GeoPoint } from "@app/plugin-sdk";
import type { GeoAddress } from "@app/shared";
import type { Geocoder } from "./types";

/**
 * Geocoding from open data, no API keys:
 *  - search: Photon (komoot, OpenStreetMap data): free text, typos, points of interest, nearby results first;
 *  - the address at a pin: GUGiK's geocoding service (Usługa Uniwersalnego Geokodowania) over the national register of
 *    address points (PRG), the official address of the building; Photon where GUGiK has none within its radius.
 * Searches stay inside Poland. Both services ask for moderate use: one request per user action, nothing cached.
 */
const PHOTON_URL = "https://photon.komoot.io";
const GUGIK_URL = "https://services.gugik.gov.pl/uug/";
/** Poland's bounding box (lon/lat): min lon, min lat, max lon, max lat. */
const POLAND_BBOX = "14.07,49.0,24.15,54.84";
const SEARCH_LIMIT = 6;
const TIMEOUT_MS = 5000;
const USER_AGENT = "TwojeMiejsce/1.0 (https://github.com/HACKYEAH-2026/smart-city)";

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    street?: string;
    housenumber?: string;
    postcode?: string;
    city?: string;
    county?: string;
  };
};
type GugikAddress = {
  city: string;
  street: string | null;
  number: string | null;
  code: string | null;
  x: string;
  y: string;
};

/**
 * "TwistCafe" / "Floriańska 15, 31-019 Kraków"; a building without a name: "Floriańska 15" / "31-019 Kraków". The
 * postal address leaves the name out (a street is its own name).
 */
export function photonAddress({ geometry, properties: p }: PhotonFeature): GeoAddress {
  const street = [p.street, p.housenumber].filter(Boolean).join(" ");
  const town = [p.postcode, p.city ?? p.county].filter(Boolean).join(" ");
  const [lng, lat] = geometry.coordinates;
  return {
    label: p.name ?? (street || town),
    detail: [p.name ? street : "", town].filter(Boolean).join(", "),
    address: [street || p.name, town].filter(Boolean).join(", "),
    lat,
    lng,
  };
}

/** "Floriańska 12" / "31-022 Kraków"; in a village without streets: "Zabierzów 12" / "32-080 Zabierzów". */
export function gugikAddress(a: GugikAddress): GeoAddress {
  const label = [a.street ?? a.city, a.number].filter(Boolean).join(" ");
  const detail = [a.code, a.city].filter(Boolean).join(" ");
  return { label, detail, address: [label, detail].filter(Boolean).join(", "), lat: Number(a.y), lng: Number(a.x) };
}

const unique = (addresses: GeoAddress[]) =>
  addresses.filter((a, i) => addresses.findIndex((b) => b.label === a.label && b.detail === a.detail) === i);

async function getJson<T>(url: string, params: Record<string, string>): Promise<T> {
  const response = await fetch(`${url}?${new URLSearchParams(params)}`, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`geocoder ${url} answered ${response.status}`);
  return (await response.json()) as T;
}

const near = (point?: GeoPoint): Record<string, string> =>
  point ? { lat: String(point.lat), lon: String(point.lng) } : {};

export class OpenGeocoder implements Geocoder {
  async search(query: string, point?: GeoPoint) {
    const found = await getJson<{ features: PhotonFeature[] }>(`${PHOTON_URL}/api/`, {
      q: query,
      bbox: POLAND_BBOX,
      limit: String(SEARCH_LIMIT * 2),
      ...near(point),
    });
    return unique(found.features.map(photonAddress)).slice(0, SEARCH_LIMIT);
  }

  async reverse(point: GeoPoint) {
    const official = await getJson<{ results?: Record<string, GugikAddress> }>(GUGIK_URL, {
      request: "GetAddressReverse",
      location: `POINT(${point.lng} ${point.lat})`,
      srid: "4326",
    });
    const nearest = Object.values(official.results ?? {})[0];
    if (nearest) return gugikAddress(nearest);
    const osm = await getJson<{ features: PhotonFeature[] }>(`${PHOTON_URL}/reverse`, near(point));
    return osm.features[0] ? photonAddress(osm.features[0]) : null;
  }
}
