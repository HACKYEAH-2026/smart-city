import { createContext, type ReactNode, useContext } from "react";
import { StyleSheet, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { type SharedValue, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, layout } from "../theme";
import { AppFooter, AppHeader } from "./AppHeader";
import { BottomTabBar } from "./BottomTabBar";

export interface ScreenProps {
  children: ReactNode;
  /** Show the app header and footer (default). Off for screens with their own chrome, e.g. login. */
  chrome?: boolean;
  /** Decoration drawn behind the content, from the top edge (e.g. the map on login). Not interactive. */
  backdrop?: ReactNode;
  /** Show the bottom bar with the main sections (dashboard, places, account). */
  tabBar?: boolean;
  /** Drawn over the whole screen, outside the scroll (e.g. a bottom sheet). */
  overlay?: ReactNode;
}

/** How far the content has scrolled (dp), shared with the backdrop, which reacts to it on the UI thread. */
const ScrollYContext = createContext<SharedValue<number> | null>(null);

/** The scroll position of the screen whose backdrop is rendering (see Screen). */
export function useScrollY(): SharedValue<number> {
  const scrollY = useContext(ScrollYContext);
  if (!scrollY) throw new Error("useScrollY is used outside Screen's backdrop");
  return scrollY;
}

/**
 * Screen shell (COMPONENTS.md → Screen): background, safe-area insets, scrolling content,
 * optional app header and footer. Dedicated CTA buttons go last in `children`.
 * Keyboard: the focused field scrolls above it together with the button below it, and the first tap on a
 * button while the keyboard is open presses it (instead of only closing the keyboard).
 */
export function Screen({ children, chrome = true, backdrop, tabBar = false, overlay }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  return (
    <View style={styles.root}>
      {backdrop ? (
        <ScrollYContext.Provider value={scrollY}>
          <View pointerEvents="none" style={styles.backdrop}>
            {backdrop}
          </View>
        </ScrollYContext.Provider>
      ) : null}
      <KeyboardAwareScrollView
        style={styles.scroll}
        onScroll={(e) => {
          scrollY.value = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        bottomOffset={layout.keyboardBottomOffset}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + layout.screenTopOffset,
            paddingBottom: insets.bottom + layout.screenBottomPadding,
          },
        ]}
      >
        <View role="main" style={styles.frame}>
          {chrome ? <AppHeader /> : null}
          {children}
          {chrome ? <AppFooter /> : null}
        </View>
      </KeyboardAwareScrollView>
      {tabBar ? <BottomTabBar /> : null}
      {overlay}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  backdrop: { position: "absolute", top: 0, left: 0, right: 0 },
  content: { flexGrow: 1, paddingHorizontal: layout.screenPaddingX },
  frame: {
    width: "100%",
    maxWidth: layout.contentMaxWidth,
    alignSelf: "center",
    flexGrow: 1,
    gap: layout.sectionGap,
  },
});
