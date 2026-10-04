import { useFocusEffect } from "expo-router";
import { type ReactNode, useCallback, useState } from "react";
import type { SheetTarget } from "./actions";

type Overlays = { here: string; sheet: SheetTarget | null; overlay: ReactNode | null };

const none = (here: string): Overlays => ({ here, sheet: null, overlay: null });
/** The overlays as they are for the screen at `here` (none when they were opened at another address). */
const at = (state: Overlays, here: string): Overlays => (state.here === here ? state : none(here));

/**
 * What a plugin screen draws over itself: a view as a sheet, a node's overlay (a Menu's options). Both belong to the
 * screen at `here`: they are dropped when the screen loses focus (another screen opened over it, from the sheet or
 * from anywhere else) and when its address changes (a tab, a filter), so they never come back stale.
 */
export function usePluginOverlays(here: string) {
  const [state, setState] = useState<Overlays>(() => none(here));
  const current = at(state, here);
  useFocusEffect(useCallback(() => () => setState(none(here)), [here]));
  return {
    sheet: current.sheet,
    overlay: current.overlay,
    openSheet: (sheet: SheetTarget) => setState((s) => ({ ...at(s, here), sheet })),
    closeSheet: () => setState((s) => ({ ...at(s, here), sheet: null })),
    showOverlay: (overlay: ReactNode | null) => setState((s) => ({ ...at(s, here), overlay })),
  };
}
