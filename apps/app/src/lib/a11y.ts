import { type AccessibilityRole, type AccessibilityState, Platform } from "react-native";

/** What a toggle button (a vote) spreads onto its Pressable so its state is announced. */
export type ToggleA11y = {
  accessibilityRole: AccessibilityRole;
  accessibilityState: AccessibilityState;
  "aria-pressed"?: boolean;
};

/**
 * A toggle button's state for screen readers: `aria-pressed` on the web (react-native-web renders it on the button);
 * natively a "togglebutton" with `checked`, as React Native has no pressed state. `state` keeps the rest (disabled).
 */
export function toggleA11y(pressed: boolean, state: AccessibilityState = {}): ToggleA11y {
  return Platform.OS === "web"
    ? { accessibilityRole: "button", accessibilityState: state, "aria-pressed": pressed }
    : { accessibilityRole: "togglebutton", accessibilityState: { ...state, checked: pressed } };
}
