import type { MyPlace } from "@app/shared";

/**
 * The place the dashboard shows: the most recently opened one; without a visit yet, the default place;
 * otherwise the first place of the list. Null when the user has no places.
 */
export function currentPlace(places: MyPlace[]): MyPlace | null {
  const visited = places
    .filter((p) => p.lastVisitAt !== null)
    .sort((a, b) => (b.lastVisitAt ?? "").localeCompare(a.lastVisitAt ?? ""));
  return visited[0] ?? places.find((p) => p.isDefault) ?? places[0] ?? null;
}

/**
 * Two-letter avatar text: first letters of the first two words. Place avatars ("Osiedle Słoneczne" → "OS") and the
 * account avatar ("Jan Kowalski" → "JK").
 */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0] ?? "")
    .join("")
    .toLocaleUpperCase("pl");
}
