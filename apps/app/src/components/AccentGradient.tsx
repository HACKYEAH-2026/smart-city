import { LinearGradient } from "expo-linear-gradient";
import { type ReactNode, useState } from "react";
import type { LayoutChangeEvent, StyleProp, ViewStyle } from "react-native";
import { gradients } from "../theme";

interface Size {
  width: number;
  height: number;
}

/**
 * The accent gradient (`gradients.accent`) along the diagonal: from the top left corner to the bottom right one, at
 * 45° in pixels whatever the shape. Start and end are fractions of the box, so they are worked out from its size
 * (until it is measured, the corners are used). Where a gradient does not fit (text, icons, lines, dots), use
 * `colors.primary`.
 */
export function AccentGradient({ style, children }: { style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  const [size, setSize] = useState<Size | null>(null);
  const { start, end } = diagonal(size);
  return (
    <LinearGradient
      colors={gradients.accent}
      start={start}
      end={end}
      onLayout={(event: LayoutChangeEvent) => {
        const { width, height } = event.nativeEvent.layout;
        setSize((prev) => (prev?.width === width && prev.height === height ? prev : { width, height }));
      }}
      style={style}
    >
      {children}
    </LinearGradient>
  );
}

/**
 * Points for a 45° gradient in a box: the vector (s, s) in pixels, with s = (width + height) / 2, so the colours run
 * from the top left corner (0) to the bottom right corner (1). Returned as fractions of width and height.
 */
function diagonal(size: Size | null): { start: [number, number]; end: [number, number] } {
  if (!size || size.width === 0 || size.height === 0) return { start: [0, 0], end: [1, 1] };
  const s = (size.width + size.height) / 2;
  return { start: [0, 0], end: [s / size.width, s / size.height] };
}
