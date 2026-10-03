import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { borders, colors, sizes } from "../theme";

/**
 * The QR scanner's frame (COMPONENTS.md → ScannerFrame): a square with four corner brackets.
 * `children` fill the square, e.g. the camera preview.
 */
export function ScannerFrame({ children }: { children: ReactNode }) {
  return (
    <View style={styles.frame}>
      {children}
      <View style={[styles.corner, styles.topLeft]} />
      <View style={[styles.corner, styles.topRight]} />
      <View style={[styles.corner, styles.bottomLeft]} />
      <View style={[styles.corner, styles.bottomRight]} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: sizes.scannerFrame,
    height: sizes.scannerFrame,
    borderRadius: sizes.scannerRadius,
  },
  corner: {
    position: "absolute",
    width: sizes.scannerCorner,
    height: sizes.scannerCorner,
    borderColor: colors.onPrimary,
  },
  topLeft: {
    left: 0,
    top: 0,
    borderLeftWidth: borders.scanner,
    borderTopWidth: borders.scanner,
    borderTopLeftRadius: sizes.scannerRadius,
  },
  topRight: {
    right: 0,
    top: 0,
    borderRightWidth: borders.scanner,
    borderTopWidth: borders.scanner,
    borderTopRightRadius: sizes.scannerRadius,
  },
  bottomLeft: {
    left: 0,
    bottom: 0,
    borderLeftWidth: borders.scanner,
    borderBottomWidth: borders.scanner,
    borderBottomLeftRadius: sizes.scannerRadius,
  },
  bottomRight: {
    right: 0,
    bottom: 0,
    borderRightWidth: borders.scanner,
    borderBottomWidth: borders.scanner,
    borderBottomRightRadius: sizes.scannerRadius,
  },
});
