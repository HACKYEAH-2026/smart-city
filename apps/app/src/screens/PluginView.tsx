import type { UINode } from "@app/plugin-sdk";
import { useLocalSearchParams } from "expo-router";
import Head from "expo-router/head";
import { ChevronLeft } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconButton, Screen, Text } from "../components";
import { usePluginView } from "../data/communities";
import { useFlash } from "../lib/flash";
import { uploadPluginImage } from "../lib/upload";
import { usePluginActions } from "../plugins/actions";
import { PluginGallery } from "../plugins/Gallery";
import { appHref, pluginHref, viewParamsFrom } from "../plugins/href";
import { usePluginOverlays } from "../plugins/overlays";
import { PluginSheet } from "../plugins/PluginSheet";
import { isFloating, PluginRenderer } from "../plugins/Renderer";
import { PluginScreenHeader } from "../plugins/ScreenHeader";
import { t } from "../texts";
import { colors, layout, radii, spacing } from "../theme";

type ScreenNode = Extract<UINode, { type: "Screen" }>;

/**
 * Plugin view screen: fetches the UI tree from the API, renders its header (PluginScreenHeader) and its content, and
 * handles actions (usePluginActions). A view opened with `present: "sheet"` is a bottom sheet over this screen. A
 * Gallery first in the view is drawn across the full width at the top, under a floating back button.
 */
export default function PluginView() {
  const all = useLocalSearchParams<{ slug: string; plugin: string; view: string }>();
  const { slug, plugin, view } = all;
  const params = viewParamsFrom(all);
  const screen = usePluginView(slug, plugin, view, params);
  const flash = useFlash();
  const here = pluginHref(slug, plugin, view, params);
  const toast = flash.messageFor(here);
  // A view as a sheet and a node's overlay (a Menu's options), dropped when the screen is left.
  const overlays = usePluginOverlays(here);
  const actions = usePluginActions(slug, plugin, {
    here,
    view,
    openSheet: overlays.openSheet,
  });
  const upload = (asset: Parameters<typeof uploadPluginImage>[2]) => uploadPluginImage(slug, plugin, asset);
  const node = screen.data?.type === "Screen" ? screen.data : undefined;

  // Where back leads: the view's own choice (e.g. a report goes back to the list); the dashboard when it names none.
  const back = node?.back;
  const backHref =
    back?.type === "app"
      ? appHref(slug, plugin, back.screen)
      : back
        ? pluginHref(slug, plugin, back.view, back.params)
        : "/app";
  const first = node?.children[0];
  const lead = first?.type === "Gallery" ? first : undefined;
  const content: ScreenNode | undefined = node && lead ? { ...node, children: node.children.slice(1) } : node;
  const renderer = { onAction: actions.onAction, busy: actions.busy, upload, showOverlay: overlays.showOverlay };

  return (
    <Screen
      chrome={false}
      gap={lead ? spacing[0] : undefined}
      overlay={
        <>
          {(node?.children ?? []).filter(isFloating).map((floating, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: the floating nodes keep their place in the tree.
            <PluginRenderer key={i} node={floating} {...renderer} />
          ))}
          {overlays.overlay}
          {overlays.sheet ? (
            <PluginSheet
              slug={slug}
              plugin={plugin}
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
        <title>{node ? node.title : t.app_name}</title>
      </Head>
      {lead ? <LeadGallery node={lead} backHref={backHref} /> : null}
      {node?.chrome === false ? null : node ? (
        <PluginScreenHeader node={node} backHref={lead ? null : backHref} onAction={actions.onAction} />
      ) : (
        <IconButton icon={ChevronLeft} label={t.back} variant="square" href={backHref} />
      )}
      {toast ? (
        <View role="status" style={styles.toast}>
          <Text variant="bodyL" color="primaryPressed">
            {toast}
          </Text>
        </View>
      ) : null}
      {actions.toolError ? (
        <Text variant="bodyL" color="primaryPressed" role="alert">
          {actions.toolError}
        </Text>
      ) : null}
      {actions.failed ? (
        <Text variant="bodyL" color="primaryPressed" role="alert">
          {t.plugin_action_error}
        </Text>
      ) : null}
      {screen.isPending ? (
        <Text variant="bodyL" color="textSecondary">
          {t.loading}
        </Text>
      ) : screen.isError || !content ? (
        <Text variant="bodyL" color="primaryPressed" role="alert">
          {t.plugin_load_error}
        </Text>
      ) : (
        <View style={[styles.content, lead && styles.afterGallery]}>
          <PluginRenderer key={here} node={content} {...renderer} />
        </View>
      )}
    </Screen>
  );
}

/** The view's first Gallery across the full width at the top of the screen (design Z-Szczegoly), back floating over it. */
function LeadGallery({ node, backHref }: { node: Extract<UINode, { type: "Gallery" }>; backHref: string }) {
  const insets = useSafeAreaInsets();
  const top = insets.top + layout.screenTopOffset;
  return (
    <View style={[styles.bleed, { marginTop: -top }]}>
      <PluginGallery node={node} edgeToEdge />
      <View style={[styles.floatingBack, { top }]}>
        <IconButton icon={ChevronLeft} label={t.back} variant="floating" href={backHref} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
  afterGallery: { paddingTop: spacing[8] },
  toast: { backgroundColor: colors.primaryTint, borderRadius: radii.md, padding: spacing[8] },
  bleed: { marginHorizontal: -layout.screenPaddingX },
  floatingBack: { position: "absolute", left: layout.screenPaddingX },
});
