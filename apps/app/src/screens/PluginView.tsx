import type { Action } from "@app/plugin-sdk";
import { useLocalSearchParams, useRouter } from "expo-router";
import Head from "expo-router/head";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Link, Screen, Text } from "../components";
import { usePluginView, useToolCall } from "../data/communities";
import { useFlash } from "../lib/flash";
import { useI18n } from "../lib/i18n";
import { uploadPluginImage } from "../lib/upload";
import { pluginHref, viewParamsFrom } from "../plugins/href";
import { PluginRenderer } from "../plugins/Renderer";
import { colors, radii, spacing } from "../theme";

/** Plugin view screen: fetches the UI tree from the API, renders it and handles actions. */
export default function PluginView() {
  const { t } = useI18n();
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
      router.push(pluginHref(slug, plugin, action.view, action.params) as never);
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

  return (
    <Screen>
      <Head>
        <title>{screen.data?.type === "Screen" ? screen.data.title : t.communities_title()}</title>
      </Head>
      <Link href={`/app/c/${slug}`}>{t.plugin_back()}</Link>
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
          {t.plugin_action_error()}
        </Text>
      ) : null}
      {screen.isPending ? (
        <Text variant="bodyL" color="textSecondary">
          {t.loading()}
        </Text>
      ) : screen.isError ? (
        <Text variant="bodyL" color="primaryPressed" role="alert">
          {t.plugin_load_error()}
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
