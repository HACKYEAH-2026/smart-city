import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, layout } from "../theme";
import { AppFooter, AppHeader } from "./AppHeader";

/**
 * Screen shell (COMPONENTS.md → Screen): background, safe-area insets, scrolling content,
 * app header and footer. Every screen renders inside it; dedicated CTA buttons go last in `children`.
 */
export function Screen({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + layout.screenTopOffset,
            paddingBottom: insets.bottom + layout.screenBottomPadding,
          },
        ]}
      >
        <View role="main" style={styles.frame}>
          <AppHeader />
          {children}
          <AppFooter />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, paddingHorizontal: layout.screenPaddingX },
  frame: {
    width: "100%",
    maxWidth: layout.contentMaxWidth,
    alignSelf: "center",
    flexGrow: 1,
    gap: layout.sectionGap,
  },
});
