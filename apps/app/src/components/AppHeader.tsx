import { StyleSheet, View } from "react-native";
import { t } from "../texts";
import { borders, colors, spacing } from "../theme";
import { Brand } from "./Brand";
import { Link } from "./Link";
import { Text } from "./Text";

/** Top bar of every screen: wordmark and navigation. */
export function AppHeader() {
  return (
    <View role="banner" style={styles.header}>
      <Brand href="/app" />
      <View role="navigation" aria-label={t.nav_label} style={styles.nav}>
        <Link href="/login" variant="nav">
          {t.nav_login}
        </Link>
        <Link href="/app" variant="nav">
          {t.nav_open_app}
        </Link>
      </View>
    </View>
  );
}

/** Bottom bar of every screen: app name. */
export function AppFooter() {
  return (
    <View style={styles.footer}>
      <Text variant="caption" color="textSecondary">
        {t.app_name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[8],
    paddingBottom: spacing[9],
    borderBottomWidth: borders.hairline,
    borderBottomColor: colors.borderSubtle,
  },
  footer: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[6],
    paddingTop: spacing[9],
    borderTopWidth: borders.hairline,
    borderTopColor: colors.borderSubtle,
  },
  nav: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing[8] },
});
