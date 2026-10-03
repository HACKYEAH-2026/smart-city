import { type Ref, useImperativeHandle, useRef } from "react";
import { Linking, StyleSheet } from "react-native";
import WebView, { type WebViewMessageEvent } from "react-native-webview";
import { MAP_HTML } from "./html";
import type { MapCommand, MapEvent, MapSpec } from "./spec";

export type MapSurfaceHandle = { send: (command: MapCommand) => void };
export type MapSurfaceProps = {
  /** Read once, when the page is ready; later changes go through `send`. */
  spec: MapSpec;
  label: string;
  onEvent: (event: MapEvent) => void;
  ref?: Ref<MapSurfaceHandle>;
};

/** The page's own origin; any other navigation (the map's attribution links) opens in the browser. */
const BASE_URL = "https://map.twojemiejsce.local/";

const inject = (view: WebView | null, message: unknown) =>
  view?.injectJavaScript(`window.__receive(${JSON.stringify(message)});true;`);

/**
 * Native: the map page (html.ts) in react-native-webview, which Expo Go ships. Commands wait until the page says
 * "ready" (it cannot receive them before), then go in with injectJavaScript.
 */
export function MapSurface({ spec, label, onEvent, ref }: MapSurfaceProps) {
  const view = useRef<WebView>(null);
  const ready = useRef(false);
  const queue = useRef<MapCommand[]>([]);
  const specRef = useRef(spec);
  specRef.current = spec;
  useImperativeHandle(ref, () => ({
    send: (command) => (ready.current ? inject(view.current, command) : queue.current.push(command)),
  }));

  const onMessage = (e: WebViewMessageEvent) => {
    const event = JSON.parse(e.nativeEvent.data) as MapEvent;
    if (event.type === "ready") {
      ready.current = true;
      inject(view.current, { type: "init", spec: specRef.current });
      for (const command of queue.current.splice(0)) inject(view.current, command);
    }
    onEvent(event);
  };

  return (
    <WebView
      ref={view}
      accessibilityLabel={label}
      source={{ html: MAP_HTML, baseUrl: BASE_URL }}
      originWhitelist={["*"]}
      onMessage={onMessage}
      onShouldStartLoadWithRequest={(request) => {
        if (request.url.startsWith(BASE_URL) || request.url === "about:blank") return true;
        Linking.openURL(request.url);
        return false;
      }}
      scrollEnabled={false}
      overScrollMode="never"
      bounces={false}
      style={styles.view}
    />
  );
}

const styles = StyleSheet.create({ view: { flex: 1, backgroundColor: "transparent" } });
