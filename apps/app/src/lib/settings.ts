import { Linking, Platform } from "react-native";

/** Whether the system settings for this app can be opened (not on the web, where the browser owns permissions). */
export const hasAppSettings = Platform.OS !== "web";

/** Opens this app's page in the system settings, where a denied permission (e.g. the camera) can be turned on. */
export function openAppSettings(): Promise<void> {
  return Linking.openSettings();
}
