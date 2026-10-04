import { createContext, type ReactNode, useContext, useRef, useState } from "react";
import type { ToastMessage } from "../components/Toast";

/**
 * "Flash" message for a specific screen: survives navigation (e.g. a plugin tool result shown
 * on the screen the plugin redirected to) and does not leak to other screens. Provider in app/_layout.tsx.
 * Each message shown gets a new `n`, so the same text twice (two votes) pops up twice.
 */
type Message = { text: string; href: string };
type Flash = { messageFor: (href: string) => ToastMessage | null; show: (message: Message | null) => void };
const FlashContext = createContext<Flash>({ messageFor: () => null, show: () => {} });

export function FlashProvider(props: { children: ReactNode }) {
  const [message, setMessage] = useState<(Message & { n: number }) | null>(null);
  const shown = useRef(0);
  const show = (next: Message | null) => {
    shown.current += 1;
    setMessage(next && { ...next, n: shown.current });
  };
  const messageFor = (href: string) => (message?.href === href ? { text: message.text, n: message.n } : null);
  return <FlashContext.Provider value={{ messageFor, show }}>{props.children}</FlashContext.Provider>;
}

export const useFlash = () => useContext(FlashContext);
