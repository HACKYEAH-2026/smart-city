import type { ReactNode } from "react";
import { Text, type TextStyle } from "react-native";

/**
 * Video-only stand-in for Expo Router: a frame has no navigator, so a link is just styled text and the
 * navigation hooks report the dashboard (the tab bar marks "Pulpit") and do nothing.
 */
export function Link(props: {
  href: string;
  asChild?: boolean;
  style?: TextStyle | TextStyle[];
  children?: ReactNode;
}) {
  return props.asChild ? props.children : <Text style={props.style}>{props.children}</Text>;
}

export const usePathname = () => "/app";
export const useLocalSearchParams = () => ({});
export const useRouter = () => ({ push: () => {}, replace: () => {}, back: () => {}, setParams: () => {} });
