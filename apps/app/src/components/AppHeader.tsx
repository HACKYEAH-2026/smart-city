import { Pressable, StyleSheet, View } from "react-native";
import { locales, useI18n } from "../lib/i18n";
import { borders, colors, spacing } from "../theme";
import { Link } from "./Link";
import { Text } from "./Text";

/** Top bar of every screen: wordmark and navigation. */
export function AppHeader() {
  const { t } = useI18n();
  return (
    <View role="banner" style={styles.header}>
      <Link href="/app" variant="nav">
        <Text variant="brand">{t.app_name()}</Text>
      </Link>
      <View role="navigation" aria-label={t.nav_label()} style={styles.nav}>
        <Link href="/login" variant="nav">
          {t.nav_login()}
        </Link>
        <Link href="/app" variant="nav">
          {t.nav_open_app()}
        </Link>
      </View>
    </View>
  );
}

/** Bottom bar of every screen: app name and the language switcher. */
export function AppFooter() {
  const { t, locale, setLocale } = useI18n();
  return (
    <View style={styles.footer}>
      <Text variant="caption" color="textSecondary">
        {t.app_name()}
      </Text>
      <View role="navigation" aria-label={t.language_label()} style={styles.nav}>
        {locales.map((l) => {
          const active = l === locale;
          return (
            <Pressable key={l} role="link" aria-current={active ? "true" : undefined} onPress={() => setLocale(l)}>
              <Text variant={active ? "tabActive" : "tab"} color={active ? "text" : "textSecondary"}>
                {l.toUpperCase()}
              </Text>
            </Pressable>
          );
        })}
      </View>
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
