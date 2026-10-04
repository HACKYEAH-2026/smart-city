import { Link as RouterLink, usePathname, useRouter } from "expo-router";
import { LayoutDashboard, type LucideIcon, Map as MapIcon, MapPin, User } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tapFeedback } from "../lib/haptics";
import { usePressed } from "../lib/pressed";
import { t } from "../texts";
import { borders, colors, opacity, radii, sizes, spacing } from "../theme";
import { Icon } from "./Icon";
import { Text } from "./Text";

/**
 * Bottom bar with the main sections (COMPONENTS.md → BottomTabBar). The active tab is the current route.
 * "Miejsca" is not a screen of its own: it opens the place switcher over the dashboard (design E-Dashboard);
 * "Mapa" is the map of places.
 */
export function BottomTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // On the dashboard, the switcher only sets its URL param: the dashboard stays mounted (its map is not reloaded and
  // the screen does not fade through the background). From other sections it is a normal replace.
  const openSwitcher = (event: { preventDefault(): void }) => {
    if (pathname !== "/app") return;
    event.preventDefault();
    router.setParams({ places: "1" });
  };
  const tabs = [
    { href: "/app", label: t.tab_dashboard, icon: LayoutDashboard, onPress: undefined },
    { href: "/app?places=1", label: t.tab_places, icon: MapPin, onPress: openSwitcher },
    { href: "/app/map", label: t.tab_map, icon: MapIcon, onPress: undefined },
    { href: "/app/account", label: t.tab_account, icon: User, onPress: undefined },
  ] as const;
  return (
    <View role="navigation" aria-label={t.nav_main} style={[styles.bar, { paddingBottom: insets.bottom + spacing[4] }]}>
      {tabs.map((tab) => (
        <TabLink
          key={tab.href}
          href={tab.href}
          label={tab.label}
          icon={tab.icon}
          active={pathname === tab.href}
          onPress={tab.onPress}
        />
      ))}
    </View>
  );
}

/**
 * One section of the bar: a link that replaces the current one (no stack growth), so the new section fades in and
 * back works as expected. The pressed state is an object style, since Slot (asChild) drops style functions.
 */
function TabLink({
  href,
  label,
  icon,
  active,
  onPress,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  /** Runs instead of the navigation when it calls preventDefault. */
  onPress?: (event: { preventDefault(): void }) => void;
}) {
  const press = usePressed(tapFeedback);
  return (
    <RouterLink href={href as never} replace asChild onPress={onPress}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={label}
        aria-current={active ? "page" : undefined}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={StyleSheet.flatten([styles.tab, press.pressed && styles.pressed])}
      >
        <Icon icon={icon} size={sizes.tabIcon} color={active ? "primary" : "textSecondary"} />
        <Text variant={active ? "tabActive" : "tab"} color={active ? "primary" : "textSecondary"}>
          {label}
        </Text>
        {active ? <View style={styles.dot} /> : null}
      </Pressable>
    </RouterLink>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: opacity.pressed },
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
