import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

/**
 * Light haptic tick when a control is pressed (onPressIn, so it lands with the touch). Android: the system "virtual
 * key" haptic (no VIBRATE permission, follows the user's touch-feedback setting); iOS: a light impact. Web: none.
 * Best effort: a device without haptics simply stays silent.
 */
export function tapFeedback(): void {
  const feedback =
    Platform.OS === "android"
      ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Virtual_Key)
      : Platform.OS === "ios"
        ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        : Promise.resolve();
  feedback.catch(() => {});
}
