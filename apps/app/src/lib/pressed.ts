import { useState } from "react";

/**
 * Pressed state of a Pressable that is a link (`asChild`). Its style has to be an object: Expo Router's Slot drops a
 * style function, so the state is read here and applied as a plain style. `onFeedback` runs on press (haptics).
 */
export function usePressed(onFeedback?: () => void) {
  const [pressed, setPressed] = useState(false);
  return {
    pressed,
    onPressIn: () => {
      onFeedback?.();
      setPressed(true);
    },
    onPressOut: () => setPressed(false),
  };
}
