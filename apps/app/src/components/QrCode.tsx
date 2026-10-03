import qrcode from "qrcode-generator";
import { useMemo } from "react";
import { View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { colors } from "../theme";

export interface QrCodeProps {
  /** Text to encode (e.g. an invite link). */
  value: string;
  /** Side in dp. */
  size: number;
  /** Accessible name of the image. */
  label: string;
}

/** QR code drawn with react-native-svg (same on phones and the web): dark modules on white, with a quiet zone. */
export function QrCode({ value, size, label }: QrCodeProps) {
  const { modules, path } = useMemo(() => qrPath(value), [value]);
  return (
    <View role="img" aria-label={label} style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`-${QUIET} -${QUIET} ${modules + 2 * QUIET} ${modules + 2 * QUIET}`}>
        <Rect x={-QUIET} y={-QUIET} width={modules + 2 * QUIET} height={modules + 2 * QUIET} fill={colors.surface} />
        <Path d={path} fill={colors.text} />
      </Svg>
    </View>
  );
}

/** Quiet zone around the code, in modules (the standard asks for 4; 2 is enough on a white card). */
const QUIET = 2;

/** One SVG path with a 1 × 1 square per dark module; error correction M survives a crease in a printout. */
function qrPath(value: string): { modules: number; path: string } {
  const qr = qrcode(0, "M");
  qr.addData(value);
  qr.make();
  const modules = qr.getModuleCount();
  const cells = Array.from({ length: modules * modules }, (_, i) => [Math.floor(i / modules), i % modules] as const);
  const path = cells
    .filter(([row, col]) => qr.isDark(row, col))
    .map(([row, col]) => `M${col} ${row}h1v1h-1z`)
    .join("");
  return { modules, path };
}
