import GorhomBottomSheet, { BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import { X } from "lucide-react-native";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { t } from "../texts";
import { borders, colors, opacity, radii, sizes, spacing } from "../theme";
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
 * backdrop fades on its own (it does not move with the sheet); pan down or a tap on the backdrop closes it.
 * Render it outside the scrolling content (`Screen` → `overlay`).
 */
export function BottomSheet({ visible, title, onClose, children }: BottomSheetProps) {
  const ref = useRef<GorhomBottomSheet>(null);
  useEffect(() => {
    if (visible) ref.current?.snapToIndex(0);
    else ref.current?.close();
  }, [visible]);
  return (
    <GorhomBottomSheet
      ref={ref}
      index={-1}
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
      <BottomSheetView style={styles.content}>
        <View style={styles.head}>
          <Heading level={2}>{title}</Heading>
          <IconButton icon={X} label={t.close} onPress={onClose} />
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
    borderRadius: radii.xs,
    borderWidth: borders.hairline,
    borderStyle: "dashed",
    borderColor: colors.dashed,
    backgroundColor: "transparent",
  },
  content: {
    paddingTop: spacing[4],
    paddingHorizontal: spacing[10],
    paddingBottom: spacing[12],
    gap: spacing[9],
  },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
