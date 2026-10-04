import type { PlacePlugin } from "@app/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import Head from "expo-router/head";
import { ChevronLeft } from "lucide-react-native";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Badge, Button, Feedback, Heading, IconBox, IconButton, NoticeScreen, Screen, Text } from "../components";
import { useCommunity, useDashboardLayout, usePlacePlugins, usePluginView, useSwitchPlugin } from "../data/communities";
import { confirmDestructive } from "../lib/confirm";
import { useFlash } from "../lib/flash";
import { sizeLabel } from "../lib/layoutDraft";
import { goBack } from "../lib/navigation";
import { uploadPluginImage } from "../lib/upload";
import { type SheetTarget, usePluginActions } from "../plugins/actions";
import { usePluginOverlays } from "../plugins/overlays";
import { PluginSheet } from "../plugins/PluginSheet";
import { PluginRenderer } from "../plugins/Renderer";
import { t } from "../texts";
import { borders, colors, radii, shadows, spacing } from "../theme";

/**
 * A plugin's page in "Zarządzaj miejscem" (design Z-StronaPluginu), for the place's admins: the plugin's own admin part
 * (its `adminView`: stats, links to its admin views), its widget on the dashboard, and removing it from the place
 * (switched off: its data waits for it to come back). Members who are not admins get a message instead.
 */
export default function PluginPage() {
  const { slug, pluginId } = useLocalSearchParams<{ slug: string; pluginId: string }>();
  const router = useRouter();
  const place = useCommunity(slug);
  const plugins = usePlacePlugins(slug);
  const back = () => goBack(router, `/app/c/${slug}/manage`);
  const plugin = plugins.data?.find((p) => p.id === pluginId && p.enabled && !p.draft);
  const header = <PageHeader plugin={plugin} onBack={back} />;

  if (place.isPending || (place.data?.role === "admin" && plugins.isPending)) {
    return <NoticeScreen header={header} text={t.loading} />;
  }
  if (!place.data) return <NoticeScreen header={header} text={t.manage_load_error} alert />;
  if (place.data.role !== "admin") return <NoticeScreen header={header} text={t.manage_admins_only} />;
  if (!plugin) return <NoticeScreen header={header} text={t.plugin_page_not_found} />;
  return <Page slug={slug} plugin={plugin} header={header} onRemoved={back} />;
}

/** Back, the plugin's emoji in a box, "Rozszerzenie" over its name. */
function PageHeader({ plugin, onBack }: { plugin: PlacePlugin | undefined; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <IconButton icon={ChevronLeft} label={t.back} variant="square" onPress={onBack} />
      {plugin ? <IconBox icon={plugin.icon} size="xl" neutral /> : null}
      <View style={styles.headerText}>
        <Text variant="label" color="textSecondary">
          {t.plugin_page_eyebrow}
        </Text>
        <Heading level={1} variant="headingS">
          {plugin?.name ?? ""}
        </Heading>
      </View>
    </View>
  );
}

function Page({
  slug,
  plugin,
  header,
  onRemoved,
}: {
  slug: string;
  plugin: PlacePlugin;
  header: ReactNode;
  onRemoved: () => void;
}) {
  const here = `/app/c/${slug}/manage/${plugin.id}`;
  // A view as a sheet and a node's overlay (a Menu's options), dropped when the page is left.
  const overlays = usePluginOverlays(here);
  const upload = (asset: Parameters<typeof uploadPluginImage>[2]) => uploadPluginImage(slug, plugin.id, asset);
  return (
    <Screen
      chrome={false}
      overlay={
        <>
          {overlays.overlay}
          {overlays.sheet ? (
            <PluginSheet
              slug={slug}
              plugin={plugin.id}
              target={overlays.sheet}
              here={here}
              upload={upload}
              onOpen={overlays.openSheet}
              onClose={overlays.closeSheet}
            />
          ) : null}
        </>
      }
    >
      <Head>
        <title>{plugin.name}</title>
      </Head>
      {header}
      {plugin.adminView ? (
        <AdminPart
          slug={slug}
          plugin={plugin.id}
          view={plugin.adminView}
          here={here}
          upload={upload}
          openSheet={overlays.openSheet}
          showOverlay={overlays.showOverlay}
        />
      ) : null}
      <WidgetSection slug={slug} plugin={plugin} />
      <View style={styles.grow} />
      <RemovePlugin slug={slug} plugin={plugin} onRemoved={onRemoved} />
    </Screen>
  );
}

/**
 * The plugin's own part of its page: the content of its `adminView` (the host draws the header, so the view's title,
 * eyebrow, actions and floating buttons are left out). Its actions work as on the plugin's screens.
 */
function AdminPart({
  slug,
  plugin,
  view,
  here,
  upload,
  openSheet,
  showOverlay,
}: {
  slug: string;
  plugin: string;
  view: string;
  here: string;
  upload: (asset: Parameters<typeof uploadPluginImage>[2]) => Promise<string>;
  openSheet: (target: SheetTarget) => void;
  showOverlay: (overlay: ReactNode | null) => void;
}) {
  const screen = usePluginView(slug, plugin, view, {});
  const toast = useFlash().messageFor(here);
  const actions = usePluginActions(slug, plugin, { here, openSheet });
  const error = actions.toolError ?? (actions.failed ? t.plugin_action_error : null);
  if (screen.isPending) {
    return (
      <Text variant="bodyL" color="textSecondary">
        {t.loading}
      </Text>
    );
  }
  if (screen.isError || screen.data?.type !== "Screen") {
    return (
      <Text variant="bodyL" color="primaryPressed" role="alert">
        {t.plugin_load_error}
      </Text>
    );
  }
  return (
    <>
      <Feedback ok={toast} error={error} />
      <PluginRenderer
        key={`${here}/${view}`}
        node={screen.data}
        onAction={actions.onAction}
        busy={actions.busy}
        upload={upload}
        showOverlay={showOverlay}
      />
    </>
  );
}

/** "Widżet rozszerzenia": the widget's name and the sizes it may have, whether it is on the dashboard, the layout editor. */
function WidgetSection({ slug, plugin }: { slug: string; plugin: PlacePlugin }) {
  const layout = useDashboardLayout(slug);
  const shown = layout.data?.widgets.find((w) => w.pluginId === plugin.id);
  const hidden = layout.data?.available.find((w) => w.pluginId === plugin.id);
  const sizes = plugin.sizes.map((size) => sizeLabel(size, true)).join(", ");
  return (
    <View style={styles.section}>
      <Text variant="label" color="textSecondary">
        {t.plugin_page_widget}
      </Text>
      <View style={styles.group}>
        <View style={styles.widgetRow}>
          <View style={styles.grow}>
            <Text variant="rowTitle">{(shown ?? hidden)?.title ?? plugin.name}</Text>
            {sizes ? (
              <Text variant="small" color="textSecondary">
                {`${t.manage_layout_sizes} ${sizes}`}
              </Text>
            ) : null}
          </View>
          {layout.data ? (
            // Badge aligns itself to the start, which in a row is the top: the wrapper centres it.
            <View>
              <Badge
                text={shown ? t.plugin_page_on_dashboard : t.plugin_page_off_dashboard}
                tone={shown ? "success" : "neutral"}
              />
            </View>
          ) : null}
        </View>
        <View style={styles.widgetFoot}>
          <Button label={t.manage_layout_edit} variant="tint" size="sm" href={`/app/c/${slug}/layout`} />
        </View>
      </View>
    </View>
  );
}

/** "Usuń rozszerzenie z miejsca": asks first, then switches the plugin off (its data stays for when it comes back). */
function RemovePlugin({ slug, plugin, onRemoved }: { slug: string; plugin: PlacePlugin; onRemoved: () => void }) {
  // Leaving is part of the switch, not of this component: the refetch after it shows the page as "not found" and
  // unmounts this component, so a per-call callback here would never run.
  const remove = useSwitchPlugin(slug, { onSwitched: onRemoved });
  const ask = async () => {
    const confirmed = await confirmDestructive({
      title: t.plugin_page_remove_title,
      message: t.plugin_page_remove_body,
      confirm: t.plugin_page_remove_confirm,
      cancel: t.create_cancel,
    });
    if (confirmed) remove.mutate({ pluginId: plugin.id, enabled: false });
  };
  return (
    <View style={styles.remove}>
      <Feedback error={remove.isError ? t.plugin_page_remove_error : null} />
      <Button label={t.plugin_page_remove} variant="destructiveGhost" disabled={remove.isPending} onPress={ask} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: spacing[7] },
  headerText: { flex: 1, minWidth: 0, gap: spacing[1] },
  grow: { flex: 1 },
  section: { gap: spacing[5] },
  group: { borderRadius: radii["2xl"], backgroundColor: colors.surface, ...shadows.card },
  widgetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[6],
    paddingVertical: spacing[6],
    paddingHorizontal: spacing[8],
  },
  widgetFoot: {
    paddingTop: spacing[6],
    paddingHorizontal: spacing[8],
    paddingBottom: spacing[8],
    borderTopWidth: borders.hairline,
    borderTopColor: colors.divider,
  },
  remove: { alignItems: "center", gap: spacing[4] },
});
