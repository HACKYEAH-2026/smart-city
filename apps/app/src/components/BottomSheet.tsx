import GorhomBottomSheet, { BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import { X } from "lucide-react-native";
import type { ReactNode } from "react";
import { useRef } from "react";
import { StyleSheet, View } from "react-native";
import { t } from "../texts";
import { colors, opacity, radii, sizes, spacing } from "../theme";
import { Heading } from "./Heading";
import { IconButton } from "./IconButton";

export interface BottomSheetProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
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

function OpenSheet({ title, onClose, children }: Omit<BottomSheetProps, "visible">) {
  const ref = useRef<GorhomBottomSheet>(null);
  return (
    <GorhomBottomSheet
      ref={ref}
      index={0}
      enableDynamicSizing
      enablePanDownToClose
      onClose={onClose}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handle}
      backdropComponent={(props) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          pressBehavior="close"
          opacity={opacity.scrim}
        />
      )}
    >
      <BottomSheetView role="dialog" aria-label={title} style={styles.content}>
        <View style={styles.head}>
          <Heading level={2}>{title}</Heading>
          <IconButton icon={X} label={t.close} onPress={() => ref.current?.close()} variant="roundSunken" />
        </View>
        {children}
      </BottomSheetView>
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
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
