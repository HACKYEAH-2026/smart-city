import { createContext, type ReactNode, useContext, useRef } from "react";
import { StyleSheet, View } from "react-native";
import {
  KeyboardAvoidingView,
  KeyboardAwareScrollView,
  type KeyboardAwareScrollViewRef,
} from "react-native-keyboard-controller";
import { type SharedValue, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { borders, colors, layout, spacing } from "../theme";
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
  /** Content gap override for edge-to-edge media screens. */
  gap?: number;
  /**
   * Pinned under the scrolling content and above the keyboard (e.g. a chat's message field): the content shrinks to
   * make room for it instead of passing under it.
   */
  footer?: ReactNode;
  /** Keep the end of the content in view as it grows (a chat: the newest message is at the bottom). */
  stickToEnd?: boolean;
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
export function Screen({
  children,
  chrome = true,
  backdrop,
  tabBar = false,
  overlay,
  gap,
  footer,
  stickToEnd = false,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const scroll = useRef<KeyboardAwareScrollViewRef>(null);
  const content = (
    <KeyboardAwareScrollView
      ref={scroll}
      style={styles.scroll}
      // With a footer the focused field is the footer's, which the avoiding view below keeps above the keyboard.
      enabled={!footer}
      onContentSizeChange={stickToEnd ? () => scroll.current?.scrollToEnd({ animated: false }) : undefined}
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
          paddingBottom: (footer ? 0 : insets.bottom) + layout.screenBottomPadding,
        },
      ]}
    >
      <View role="main" style={[styles.frame, gap === undefined ? undefined : { gap }]}>
        {chrome ? <AppHeader /> : null}
        {children}
        {chrome ? <AppFooter /> : null}
      </View>
    </KeyboardAwareScrollView>
  );
  return (
    <View style={styles.root}>
      {backdrop ? (
        <ScrollYContext.Provider value={scrollY}>
          <View pointerEvents="none" style={styles.backdrop}>
            {backdrop}
          </View>
        </ScrollYContext.Provider>
      ) : null}
      {footer ? (
        <KeyboardAvoidingView behavior="padding" style={styles.fill}>
          {content}
          <View style={[styles.footer, { paddingBottom: insets.bottom + spacing[4] }]}>
            <View style={styles.footerFrame}>{footer}</View>
          </View>
        </KeyboardAvoidingView>
      ) : (
        content
      )}
      {tabBar ? <BottomTabBar /> : null}
      {overlay}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  fill: { flex: 1 },
  footer: {
    paddingTop: spacing[4],
    paddingHorizontal: layout.screenPaddingX,
    backgroundColor: colors.background,
    borderTopWidth: borders.hairline,
    borderTopColor: colors.borderSubtle,
  },
  footerFrame: { width: "100%", maxWidth: layout.contentMaxWidth, alignSelf: "center" },
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
