import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
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
}

/**
 * Screen shell (COMPONENTS.md → Screen): background, safe-area insets, scrolling content,
 * optional app header and footer. Dedicated CTA buttons go last in `children`.
 * Keyboard: the focused field scrolls above it together with the button below it, and the first tap on a
 * button while the keyboard is open presses it (instead of only closing the keyboard).
 */
export function Screen({ children, chrome = true, backdrop, tabBar = false }: ScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      {backdrop ? (
        <View pointerEvents="none" style={styles.backdrop}>
          {backdrop}
        </View>
      ) : null}
      <KeyboardAwareScrollView
        style={styles.scroll}
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
