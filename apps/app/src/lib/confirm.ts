import { Alert, Platform } from "react-native";

export type ConfirmOptions = { title: string; message: string; confirm: string; cancel: string };

/**
 * Asks before a destructive action (e.g. deleting a place); resolves true when the user confirms. The system dialog:
 * Alert on Android and iOS, the browser's confirm() on the web (react-native-web has no Alert buttons).
 */
export function confirmDestructive({ title, message, confirm, cancel }: ConfirmOptions): Promise<boolean> {
  if (Platform.OS === "web") return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(
      title,
      message,
      [
        { text: cancel, style: "cancel", onPress: () => resolve(false) },
        { text: confirm, style: "destructive", onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
}
