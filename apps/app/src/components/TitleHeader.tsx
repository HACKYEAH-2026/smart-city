import { ChevronLeft } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { t } from "../texts";
import { spacing } from "../theme";
import { Heading } from "./Heading";
import { IconButton } from "./IconButton";
import { Text } from "./Text";

export interface TitleHeaderProps {
  /** Small label above the title, e.g. the place's name. */
  eyebrow: string;
  /** The screen's title (h1). */
  title: string;
  onBack: () => void;
}

/**
 * Header of a place's admin screens (COMPONENTS.md → ScreenHeader, title variant): back, then the eyebrow label over
 * the title, e.g. "Kraków" over "Zarządzaj miejscem".
 */
export function TitleHeader({ eyebrow, title, onBack }: TitleHeaderProps) {
  return (
    <View style={styles.row}>
      <IconButton variant="plain" icon={ChevronLeft} label={t.back} onPress={onBack} />
      <View style={styles.text}>
        <Text variant="label" color="textSecondary" numberOfLines={1}>
          {eyebrow}
        </Text>
        <Heading level={1} variant="headingS">
          {title}
        </Heading>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing[7] },
  text: { flex: 1, gap: spacing[1] },
});
