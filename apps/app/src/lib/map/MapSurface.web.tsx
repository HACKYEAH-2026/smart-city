import { useEffect, useImperativeHandle, useRef } from "react";
import { MAP_HTML } from "./html";
import type { MapSurfaceProps } from "./MapSurface";
import type { MapCommand, MapEvent } from "./spec";

export type { MapSurfaceHandle, MapSurfaceProps } from "./MapSurface";

const post = (frame: HTMLIFrameElement | null, message: unknown) =>
  frame?.contentWindow?.postMessage(JSON.stringify(message), "*");

/**
 * Web: the same map page (html.ts) in an iframe, talking over postMessage. An iframe is a DOM element (there is no
 * React Native one), which is why it lives here in src/lib.
 */
export function MapSurface({ spec, label, onEvent, ref }: MapSurfaceProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const ready = useRef(false);
  const queue = useRef<MapCommand[]>([]);
  const latest = useRef({ spec, onEvent });
  latest.current = { spec, onEvent };
  useImperativeHandle(ref, () => ({
    send: (command) => (ready.current ? post(frame.current, command) : queue.current.push(command)),
  }));

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || typeof e.data !== "string") return;
      const event = JSON.parse(e.data) as MapEvent;
      if (event.type === "ready") {
        ready.current = true;
        post(frame.current, { type: "init", spec: latest.current.spec });
        for (const command of queue.current.splice(0)) post(frame.current, command);
      }
      latest.current.onEvent(event);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <iframe
      ref={frame}
      title={label}
      srcDoc={MAP_HTML}
      style={{ border: 0, width: "100%", height: "100%", display: "block" }}
    />
  );
}
