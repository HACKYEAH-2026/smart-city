import type { ReactNode } from "react";
import { Text, type TextStyle } from "react-native";

/** Video-only stand-in for Expo Router: a frame has no navigator, so a link is just styled text. */
export function Link(props: { href: string; style?: TextStyle | TextStyle[]; children?: ReactNode }) {
  return <Text style={props.style}>{props.children}</Text>;
}
