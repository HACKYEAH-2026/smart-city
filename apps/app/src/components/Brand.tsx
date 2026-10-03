import { MapPin } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { t } from "../texts";
import { spacing } from "../theme";
import { Icon } from "./Icon";
import { Text } from "./Text";

/** Wordmark: red pin + "Twoje Miejsce" (design: top of the login and no-places screens). */
export function Brand() {
  return (
    <View style={styles.brand}>
      <View aria-hidden>
        <Icon icon={MapPin} color="primary" strokeWidth={2.2} />
      </View>
      <Text variant="brand">{t.app_name}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: "row", alignItems: "center", gap: spacing[4] },
});
