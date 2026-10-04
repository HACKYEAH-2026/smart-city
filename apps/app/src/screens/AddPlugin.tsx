import type { PlacePlugin } from "@app/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import Head from "expo-router/head";
import { Plus, Sparkles } from "lucide-react-native";
import { type ReactNode, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  ActionRow,
  Button,
  Feedback,
  Icon,
  IconBox,
  NoticeScreen,
  Screen,
  SearchField,
  Text,
  TitleHeader,
} from "../components";
import { useCommunity, usePlacePlugins, useSwitchPlugin } from "../data/communities";
import { goBack } from "../lib/navigation";
import { catalogPlugins, pluginSubtitle } from "../lib/placePlugins";
import { t } from "../texts";
import { colors, layout, radii, shadows, sizes, spacing } from "../theme";

/**
 * The plugin catalog of a place (design E-KatalogWidzetow; Zarządzaj miejscem → Rozszerzenia → "Dodaj rozszerzenie"),
 * for its admins: the plugins that are not on yet, filtered as the admin types. "Dodaj do miejsca" switches one on
 * right away; at the bottom, "Stwórz rozszerzenie z AI" opens the plugin builder. Other members get a message.
 */
export default function AddPlugin() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const place = useCommunity(slug);
  const back = () => goBack(router, `/app/c/${slug}/manage`);
  const header = <TitleHeader eyebrow={place.data?.name ?? ""} title={t.add_plugin_title} onBack={back} />;

  if (place.isPending) return <NoticeScreen header={header} text={t.loading} />;
  if (!place.data) return <NoticeScreen header={header} text={t.manage_load_error} alert />;
  if (place.data.role !== "admin") return <NoticeScreen header={header} text={t.manage_admins_only} />;
  return <Catalog header={header} slug={slug} />;
}

function Catalog({ header, slug }: { header: ReactNode; slug: string }) {
  const plugins = usePlacePlugins(slug);
  const add = useSwitchPlugin(slug);
  const [search, setSearch] = useState("");
  const [added, setAdded] = useState<string | null>(null);
  const all = plugins.data ?? [];
  const found = catalogPlugins(all, search);
  const addToPlace = (plugin: PlacePlugin) => {
    setAdded(null);
    add.mutate({ pluginId: plugin.id, enabled: true }, { onSuccess: () => setAdded(plugin.name) });
  };
  return (
    <Screen chrome={false}>
      <Head>
        <title>{t.add_plugin_title}</title>
      </Head>
      {header}
      <SearchField variant="outlined" label={t.add_plugin_search} value={search} onChangeText={setSearch} />
      <Feedback ok={added ? `${t.add_plugin_added}: ${added}` : null} error={add.isError ? t.add_plugin_error : null} />
      <View style={styles.section}>
        <Text variant="label" color="textSecondary">
          {t.manage_plugins_title}
        </Text>
        {plugins.isPending ? (
          <Text variant="bodyL" color="textSecondary">
            {t.loading}
          </Text>
        ) : found.length ? (
          <View role="list" aria-label={t.manage_plugins_title} style={styles.section}>
            {found.map((plugin) => (
              <PluginCard key={plugin.id} plugin={plugin} disabled={add.isPending} onAdd={() => addToPlace(plugin)} />
            ))}
          </View>
        ) : (
          <Text variant="bodyL" color="textSecondary">
            {catalogPlugins(all, "").length ? t.add_plugin_no_results : t.add_plugin_all_added}
          </Text>
        )}
      </View>
      <ActionRow
        icon={Sparkles}
        title={t.build_entry_title}
        subtitle={t.build_entry_subtitle}
        href={`/app/c/${slug}/build`}
      />
    </Screen>
  );
}

/** A plugin that can be added: its icon, name and what it brings, then "Dodaj do miejsca". The card is not a link. */
function PluginCard({ plugin, disabled, onAdd }: { plugin: PlacePlugin; disabled: boolean; onAdd: () => void }) {
  return (
    <View role="listitem" aria-label={plugin.name} style={styles.card}>
      <View style={styles.cardTop}>
        <IconBox icon={plugin.icon} size="xl" neutral />
        <View style={styles.cardText}>
          <Text variant="cardTitleL">{plugin.name}</Text>
          <Text variant="small" color="textSecondary" numberOfLines={2}>
            {pluginSubtitle(plugin)}
          </Text>
        </View>
      </View>
      <Button
        label={t.add_plugin_add}
        accessibilityLabel={`${t.add_plugin_add}: ${plugin.name}`}
        variant="accent"
        size="sm"
        leftIcon={<Icon icon={Plus} size={sizes.iconS} color="primaryPressed" strokeWidth={2.4} />}
        disabled={disabled}
        onPress={onAdd}
        style={styles.addButton}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing[5] },
  card: {
    gap: spacing[7],
    padding: layout.pluginCardPadding,
    borderRadius: radii["3xl"],
    backgroundColor: colors.surface,
    ...shadows.cardRaised,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: spacing[7] },
  cardText: { flex: 1, gap: spacing[1] },
  addButton: { height: sizes.buttonPluginAdd },
});
