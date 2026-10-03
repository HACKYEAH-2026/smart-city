import { createContext, type ReactNode, useContext, useState } from "react";

/**
 * "Flash" message for a specific screen: survives navigation (e.g. a plugin tool result shown
 * on the screen the plugin redirected to) and does not leak to other screens. Provider in app/_layout.tsx.
 */
type Message = { text: string; href: string };
type Flash = { messageFor: (href: string) => string | null; show: (message: Message | null) => void };
const FlashContext = createContext<Flash>({ messageFor: () => null, show: () => {} });

export function FlashProvider(props: { children: ReactNode }) {
  const [message, show] = useState<Message | null>(null);
  const messageFor = (href: string) => (message?.href === href ? message.text : null);
  return <FlashContext.Provider value={{ messageFor, show }}>{props.children}</FlashContext.Provider>;
}

export const useFlash = () => useContext(FlashContext);
