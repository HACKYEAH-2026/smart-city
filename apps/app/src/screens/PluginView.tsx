import type { Action } from "@app/plugin-sdk";
import { useLocalSearchParams, useRouter } from "expo-router";
import Head from "expo-router/head";
import { ChevronLeft } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { IconButton, Screen, Text } from "../components";
import { usePluginView, useToolCall } from "../data/communities";
import { useFlash } from "../lib/flash";
import { uploadPluginImage } from "../lib/upload";
import { pluginHref, viewParamsFrom } from "../plugins/href";
import { isFloating, PluginRenderer } from "../plugins/Renderer";
import { t } from "../texts";
import { colors, radii, spacing } from "../theme";

/** Plugin view screen: fetches the UI tree from the API, renders it and handles actions. */
export default function PluginView() {
  const router = useRouter();
  const all = useLocalSearchParams<{ slug: string; plugin: string; view: string }>();
  const { slug, plugin, view } = all;
  const params = viewParamsFrom(all);
  const screen = usePluginView(slug, plugin, view, params);
  const call = useToolCall(slug, plugin);
  const flash = useFlash();
  const here = pluginHref(slug, plugin, view, params);
  const toast = flash.messageFor(here);
  // After a successful tool call: a fresh tree (clean forms); a plain refetch does not wipe typed text.
  const [generation, setGeneration] = useState(0);
  // Error message from the tool result (e.g. "This issue no longer exists") — content from the plugin.
  const [toolError, setToolError] = useState<string | null>(null);
  const upload = (asset: Parameters<typeof uploadPluginImage>[2]) => uploadPluginImage(slug, plugin, asset);

  const onAction = (action: Action) => {
    setToolError(null);
    if (action.type === "navigate") {
      flash.show(null);
      // A tab or filter of the same view only changes its params: no screen transition (a slide), and going back
      // leaves the list rather than each tab press.
      if (action.replace && action.view === view) {
        router.setParams(action.params ?? {});
        return;
      }
      const href = pluginHref(slug, plugin, action.view, action.params) as never;
      if (action.replace) router.replace(href);
      else router.push(href);
      return;
    }
    call.mutate(
      { tool: action.tool, args: action.args ?? {} },
      {
        onSuccess: (result) => {
          if (result.error) {
            setToolError(result.error);
            return;
          }
          if (result.close && !result.navigate) {
            flash.show(null);
            router.back();
            return;
          }
          const next = result.navigate ? pluginHref(slug, plugin, result.navigate.view, result.navigate.params) : here;
          flash.show(result.toast ? { text: result.toast, href: next } : null);
          setGeneration((g) => g + 1);
          if (next !== here) router.push(next as never);
        },
      },
    );
  };

  // Floating buttons of the screen (outside its scroll), drawn over the whole screen.
  const floating = screen.data?.type === "Screen" ? screen.data.children.filter(isFloating) : [];

  return (
    <Screen
      chrome={false}
      overlay={floating.map((node, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the floating nodes keep their place in the tree.
        <PluginRenderer key={i} node={node} onAction={onAction} busy={call.isPending} upload={upload} />
      ))}
    >
      <Head>
        <title>{screen.data?.type === "Screen" ? screen.data.title : t.app_name}</title>
      </Head>
      <IconButton icon={ChevronLeft} label={t.back} variant="square" href="/app" />
      {toast ? (
        <View role="status" style={styles.toast}>
          <Text variant="bodyL" color="primaryPressed">
            {toast}
          </Text>
        </View>
      ) : null}
      {toolError ? (
        <Text variant="bodyL" color="primaryPressed" role="alert">
          {toolError}
        </Text>
      ) : null}
      {call.isError ? (
        <Text variant="bodyL" color="primaryPressed" role="alert">
          {t.plugin_action_error}
        </Text>
      ) : null}
      {screen.isPending ? (
        <Text variant="bodyL" color="textSecondary">
          {t.loading}
        </Text>
      ) : screen.isError ? (
        <Text variant="bodyL" color="primaryPressed" role="alert">
          {t.plugin_load_error}
        </Text>
      ) : (
        <PluginRenderer key={generation} node={screen.data} onAction={onAction} busy={call.isPending} upload={upload} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  toast: { backgroundColor: colors.primaryTint, borderRadius: radii.md, padding: spacing[8] },
});
