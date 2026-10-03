import { Link as RouterLink, usePathname } from "expo-router";
import { LayoutDashboard, MapPin, User } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { t } from "../texts";
import { borders, colors, radii, sizes, spacing } from "../theme";
import { Icon } from "./Icon";
import { Text } from "./Text";

/** Bottom bar with the three main sections (COMPONENTS.md → BottomTabBar). The active tab is the current route. */
export function BottomTabBar() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const tabs = [
    { href: "/app", label: t.tab_dashboard, icon: LayoutDashboard },
    { href: "/app/places", label: t.tab_places, icon: MapPin },
    { href: "/app/account", label: t.tab_account, icon: User },
  ] as const;
  return (
    <View role="navigation" aria-label={t.nav_main} style={[styles.bar, { paddingBottom: insets.bottom + spacing[4] }]}>
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <RouterLink key={tab.href} href={tab.href as never} asChild>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={tab.label}
              aria-current={active ? "page" : undefined}
              style={styles.tab}
            >
              <Icon icon={tab.icon} size={sizes.tabIcon} color={active ? "primary" : "textSecondary"} />
              <Text variant={active ? "tabActive" : "tab"} color={active ? "primary" : "textSecondary"}>
                {tab.label}
              </Text>
              {active ? <View style={styles.dot} /> : null}
            </Pressable>
          </RouterLink>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderTopWidth: borders.hairline,
    borderTopColor: colors.borderSubtle,
    paddingTop: spacing[4],
    paddingHorizontal: spacing[6],
  },
  tab: { flex: 1, alignItems: "center", gap: spacing[2], paddingVertical: spacing[4] },
  dot: { width: sizes.tabDot, height: sizes.tabDot, borderRadius: radii.pill, backgroundColor: colors.primary },
});
