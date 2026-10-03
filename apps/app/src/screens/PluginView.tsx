import type { Action } from "@app/plugin-sdk";
import { useLocalSearchParams, useRouter } from "expo-router";
import Head from "expo-router/head";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { AppLink, Body, Page } from "../components/ui";
import { usePluginView, useToolCall } from "../data/communities";
import { useFlash } from "../lib/flash";
import { useI18n } from "../lib/i18n";
import { uploadPluginImage } from "../lib/upload";
import { pluginHref, viewParamsFrom } from "../plugins/href";
import { PluginRenderer } from "../plugins/Renderer";
import { space, tone } from "../theme";

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
    <Page narrow>
      <Head>
        <title>{screen.data?.type === "Screen" ? screen.data.title : t.communities_title()}</title>
      </Head>
      <View style={styles.stack}>
        <AppLink href={`/app/c/${slug}`}>{t.plugin_back()}</AppLink>
        {toast ? (
          <View role="status" style={styles.toast}>
            <Body style={{ color: tone.success.fg }}>{toast}</Body>
          </View>
        ) : null}
        {toolError ? (
          <Body tone="error" role="alert">
            {toolError}
          </Body>
        ) : null}
        {call.isError ? (
          <Body tone="error" role="alert">
            {t.plugin_action_error()}
          </Body>
        ) : null}
        {screen.isPending ? (
          <Body tone="soft">{t.loading()}</Body>
        ) : screen.isError ? (
          <Body tone="error" role="alert">
            {t.plugin_load_error()}
          </Body>
        ) : (
          <PluginRenderer
            key={generation}
            node={screen.data}
            onAction={onAction}
            busy={call.isPending}
            upload={upload}
          />
        )}
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.l },
  toast: { backgroundColor: tone.success.bg, borderRadius: 12, padding: space.l },
});
