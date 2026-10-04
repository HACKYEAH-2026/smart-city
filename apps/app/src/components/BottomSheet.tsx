import GorhomBottomSheet, { BottomSheetBackdrop, BottomSheetScrollView, BottomSheetView } from "@gorhom/bottom-sheet";
import { Sparkles, X } from "lucide-react-native";
import type { ReactNode } from "react";
import { useRef } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { t } from "../texts";
import { colors, opacity, radii, sizes, spacing } from "../theme";
import { Heading } from "./Heading";
import { Icon } from "./Icon";
import { IconButton } from "./IconButton";
import { Text } from "./Text";

export interface BottomSheetProps {
  visible: boolean;
  title: string;
  /** A small label over the title (e.g. what the sheet is about). */
  eyebrow?: string;
  onClose: () => void;
  children: ReactNode;
  /**
   * The content scrolls once the sheet reaches the top of the screen (a long list of options, a plugin view). Without
   * it the sheet is as tall as its content, up to the screen.
   */
  scrollable?: boolean;
  /** False while the sheet must stay (e.g. its action is running): no pan down, no backdrop tap, close disabled. */
  dismissible?: boolean;
  accentEyebrow?: boolean;
}

/**
 * Bottom sheet (COMPONENTS.md → BottomSheet) on @gorhom/bottom-sheet: native gestures and spring motion. The dimmed
 * backdrop fades on its own (it does not move with the sheet); pan down, a tap on the backdrop or the close button
 * slide it away, then `onClose` runs. Render it outside the scrolling content (`Screen` → `overlay`).
 * Mounted only while `visible`: gorhom never moves a sheet that mounts closed to its closed position, it stays at
 * the window height. Where the app draws under the system bars and the window is shorter than the screen (Android
 * in Expo Go), the top of the sheet then showed above the bottom edge, with an invisible backdrop taking every tap.
 */
export function BottomSheet({ visible, ...sheet }: BottomSheetProps) {
  return visible ? <OpenSheet {...sheet} /> : null;
}

function OpenSheet({
  title,
  eyebrow,
  onClose,
  children,
  scrollable = false,
  dismissible = true,
  accentEyebrow = false,
}: Omit<BottomSheetProps, "visible">) {
  const ref = useRef<GorhomBottomSheet>(null);
  const insets = useSafeAreaInsets();
  const body = (
    <View role="dialog" aria-label={title} style={styles.content}>
      <View style={styles.head}>
        <View style={styles.title}>
          {eyebrow ? (
            <View style={styles.eyebrow}>
              {accentEyebrow ? <Icon icon={Sparkles} size={sizes.iconXs} color="primary" /> : null}
              <Text
                variant={accentEyebrow ? "smallStrong" : "label"}
                color={accentEyebrow ? "primary" : "textSecondary"}
              >
                {eyebrow}
              </Text>
            </View>
          ) : null}
          <Heading level={2}>{title}</Heading>
        </View>
        <IconButton
          icon={X}
          label={t.close}
          onPress={() => ref.current?.close()}
          variant="plain"
          disabled={!dismissible}
        />
      </View>
      {children}
    </View>
  );
  return (
    <GorhomBottomSheet
      ref={ref}
      index={0}
      enableDynamicSizing
      enablePanDownToClose={dismissible}
      topInset={insets.top}
      onClose={onClose}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handle}
      backdropComponent={(props) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          pressBehavior={dismissible ? "close" : "none"}
          opacity={accentEyebrow ? opacity.pluginScrim : opacity.scrim}
        />
      )}
    >
      {scrollable ? <BottomSheetScrollView>{body}</BottomSheetScrollView> : <BottomSheetView>{body}</BottomSheetView>}
    </GorhomBottomSheet>
  );
}

const styles = StyleSheet.create({
  background: { backgroundColor: colors.background, borderRadius: radii.sheet },
  handle: {
    width: sizes.sheetHandleWidth,
    height: sizes.sheetHandleHeight,
    borderRadius: radii.pill,
    backgroundColor: colors.dashed,
  },
  content: {
    paddingTop: spacing[4],
    paddingHorizontal: spacing[10],
    paddingBottom: spacing[12],
    gap: spacing[9],
  },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing[6] },
  title: { flex: 1, gap: spacing[1] },
  eyebrow: { flexDirection: "row", alignItems: "center", gap: spacing[3] },
});
