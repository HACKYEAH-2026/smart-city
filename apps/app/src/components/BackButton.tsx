import { ChevronLeft } from "lucide-react-native";
import { t } from "../texts";
import type { ColorToken } from "../theme";
import { IconButton } from "./IconButton";

type BackButtonProps = {
  /** Accessible name; "Wróć" by default. */
  label?: string;
  /** The chevron's colour when the ink one does not show, e.g. white over a photo. */
  color?: ColorToken;
} & ({ onPress: () => void; href?: undefined } | { href: string; onPress?: undefined });

/**
 * Back at the top left of a screen: a chevron WITHOUT a background, everywhere (also over a map or a photo). The only
 * way to draw a back button (COMPONENTS.md → IconButton `plain`); the icon lines up with the content edge.
 */
export function BackButton({ label = t.back, color, ...target }: BackButtonProps) {
  return target.href !== undefined ? (
    <IconButton variant="plain" icon={ChevronLeft} label={label} color={color} href={target.href} />
  ) : (
    <IconButton variant="plain" icon={ChevronLeft} label={label} color={color} onPress={target.onPress} />
  );
}
