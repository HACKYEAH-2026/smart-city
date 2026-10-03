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

/**
 * Firmer haptic when a long press takes effect (e.g. the dashboard enters edit mode). Android: the system
 * "long press" haptic; iOS: a medium impact. Web: none. Best effort, like `tapFeedback`.
 */
export function longPressFeedback(): void {
  const feedback =
    Platform.OS === "android"
      ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Long_Press)
      : Platform.OS === "ios"
        ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        : Promise.resolve();
  feedback.catch(() => {});
}
