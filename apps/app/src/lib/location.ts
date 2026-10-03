import type { GeoPoint } from "@app/plugin-sdk";
import * as Location from "expo-location";

/**
 * Where the user is right now ("Moja lokalizacja" on a map): asks for permission the first time, then reads one
 * position (expo-location; the browser's geolocation on the web). Null when the user refuses or it fails, and the
 * map stays where it was.
 */
export async function currentPosition(): Promise<GeoPoint | null> {
  const permission = await Location.requestForegroundPermissionsAsync().catch(() => null);
  if (!permission?.granted) return null;
  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null);
  return position ? { lat: position.coords.latitude, lng: position.coords.longitude } : null;
}
