import { X } from "lucide-react-native";
import type { ReactNode } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
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

/** Bottom sheet over a dimmed screen (COMPONENTS.md → BottomSheet). Tapping the dimmed area closes it. */
export function BottomSheet({ visible, title, onClose, children }: BottomSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.wrap}>
        <Pressable accessibilityRole="none" style={styles.scrim} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.head}>
            <Heading level={2}>{title}</Heading>
            <IconButton icon={X} label={t.close} onPress={onClose} />
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "flex-end" },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: colors.text, opacity: opacity.scrim },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    paddingTop: spacing[6],
    paddingHorizontal: spacing[10],
    paddingBottom: spacing[12],
    gap: spacing[9],
  },
  handle: {
    alignSelf: "center",
    width: sizes.sheetHandleWidth,
    height: sizes.sheetHandleHeight,
    borderRadius: radii.xs,
    borderWidth: borders.hairline,
    borderStyle: "dashed",
    borderColor: colors.dashed,
  },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
