import type { GeoPoint } from "@app/plugin-sdk";
import * as Location from "expo-location";

/** A position the device fixed this recently is good enough: no wait for a new one. */
const FRESH_MS = 60_000;

const lastKnown = () => Location.getLastKnownPositionAsync({ maxAge: FRESH_MS }).catch(() => null);
const fresh = () => Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }).catch(() => null);

/**
 * Where the user is right now ("Moja lokalizacja" on a map): asks for permission the first time, then takes a recent
 * fix or reads a new, precise one (a place's pin is a building; expo-location, the browser's geolocation on the web).
 * Null when the user refuses or it fails, and the map stays where it was.
 */
export async function currentPosition(): Promise<GeoPoint | null> {
  const permission = await Location.requestForegroundPermissionsAsync().catch(() => null);
  if (!permission?.granted) return null;
  const position = (await lastKnown()) ?? (await fresh());
  return position ? { lat: position.coords.latitude, lng: position.coords.longitude } : null;
}
