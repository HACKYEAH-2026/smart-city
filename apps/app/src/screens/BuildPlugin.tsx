import type { AiPlugin, PlacePlugin, PluginOutline, PluginVersion, VersionError } from "@app/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import Head from "expo-router/head";
import { ChevronLeft, Sparkles } from "lucide-react-native";
import { type ReactNode, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import {
  ActionRow,
  Badge,
  Button,
  Card,
  Heading,
  Icon,
  IconButton,
  Link,
  Screen,
  Text,
  TextField,
} from "../components";
import { useAiPlugin, useChangePlugin, useCreatePlugin, usePublishPlugin } from "../data/builder";
import { useCommunity, usePlacePlugins } from "../data/communities";
import { goBack } from "../lib/navigation";
import { countOf } from "../lib/plural";
import { pluginHref } from "../plugins/href";
import { t } from "../texts";
import { colors, radii, sizes, spacing } from "../theme";

/** The shortest request the API accepts (pluginRequestSchema). */
const MIN_REQUEST = 10;

/** HTTP status of a failed API call (hono's DetailedError), to tell the user what went wrong. */
const statusOf = (err: unknown): number | undefined => (err as { statusCode?: number } | null)?.statusCode;

/** Why a request to the AI was not accepted: no model on the server, the day's limit, or anything else. */
const sendError = (err: unknown) => {
  const status = statusOf(err);
  if (status === 503) return t.build_unavailable;
  return status === 429 ? t.build_rate_limited : t.build_send_error;
};

const FAILURES: Record<VersionError, string> = {
  check_failed: t.build_failed_check_failed,
  timeout: t.build_failed_timeout,
  internal: t.build_failed_internal,
  ai_unavailable: t.build_failed_ai_unavailable,
};

/**
 * The plugin builder (Zarządzaj miejscem → Rozszerzenia → "Stwórz rozszerzenie z AI"), for a place's admins: describe a plugin and
 * the AI writes and checks it; until it is published it is a draft. Every later request is a new version, also after
 * publishing; publishing installs the latest ready version in the place. With `?plugin=` it shows that plugin's
 * versions; without, it starts a new plugin and lists the place's AI plugins.
 */
export default function BuildPlugin() {
  const { slug, plugin } = useLocalSearchParams<{ slug: string; plugin?: string }>();
  const router = useRouter();
  const place = useCommunity(slug);
  const back = () => goBack(router, plugin ? `/app/c/${slug}/build` : `/app/c/${slug}/manage`);
  const header = <Header eyebrow={place.data?.name ?? ""} onBack={back} />;

  if (place.isPending) return <Notice header={header} text={t.loading} />;
  if (!place.data) return <Notice header={header} text={t.manage_load_error} alert />;
  if (place.data.role !== "admin") return <Notice header={header} text={t.manage_admins_only} />;
  return (
    <Screen chrome={false}>
      <Head>
        <title>{t.build_title}</title>
      </Head>
      {header}
      {plugin ? (
        <PluginView slug={slug} id={plugin} />
      ) : (
        <NewPlugin slug={slug} onCreated={(id) => router.push(`/app/c/${slug}/build?plugin=${id}`)} />
      )}
    </Screen>
  );
}

/** Back button, the place's name above "Rozszerzenie z AI". */
function Header({ eyebrow, onBack }: { eyebrow: string; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <IconButton icon={ChevronLeft} label={t.back} onPress={onBack} />
      <View style={styles.headerText}>
        <Text variant="label" color="textSecondary" numberOfLines={1}>
          {eyebrow}
        </Text>
        <Heading level={1} variant="headingS">
          {t.build_title}
        </Heading>
      </View>
    </View>
  );
}

function Notice({ header, text, alert = false }: { header: ReactNode; text: string; alert?: boolean }) {
  return (
    <Screen chrome={false}>
      {header}
      <Text variant="bodyL" color="textSecondary" role={alert ? "alert" : undefined}>
        {text}
      </Text>
    </Screen>
  );
}

function Alert({ text }: { text: string | null }) {
  return text ? (
    <Text variant="bodyL" color="primaryPressed" role="alert">
      {text}
    </Text>
  ) : null;
}

/** The first request: what the place needs, in the admin's words. Then the place's AI plugins. */
function NewPlugin({ slug, onCreated }: { slug: string; onCreated: (id: string) => void }) {
  const create = useCreatePlugin(slug);
  const plugins = usePlacePlugins(slug);
  const own = (plugins.data ?? []).filter((p) => p.madeByAi);
  const [request, setRequest] = useState("");
  const submit = () => create.mutate(request.trim(), { onSuccess: (plugin) => onCreated(plugin.id) });
  const error = create.isError ? sendError(create.error) : null;
  return (
    <>
      <Text variant="bodyL" color="textSecondary">
        {t.build_lead}
      </Text>
      <TextField
        label={t.build_request_label}
        value={request}
        onChangeText={setRequest}
        placeholder={t.build_request_placeholder}
        multiline
      />
      <Alert text={error} />
      <Button
        label={t.build_create}
        leftIcon={<Icon icon={Sparkles} size={sizes.iconS} color="onPrimary" strokeWidth={2} />}
        disabled={request.trim().length < MIN_REQUEST || create.isPending}
        onPress={submit}
      />
      {own.length ? (
        <View style={styles.list}>
          <Heading level={2} variant="headingS">
            {t.build_plugins_title}
          </Heading>
          {own.map((item) => (
            <ActionRow
              key={item.id}
              icon={Sparkles}
              title={`${item.icon} ${item.name}`}
              subtitle={itemStatus(item)}
              href={`/app/c/${slug}/build?plugin=${item.id}`}
            />
          ))}
        </View>
      ) : null}
    </>
  );
}

const itemStatus = (item: PlacePlugin) => {
  if (item.working) return t.build_status_working;
  return item.draft ? t.build_status_draft : t.build_status_published;
};

/** The conversation with the AI: each request and what came of it; publishing; the next change. */
function PluginView({ slug, id }: { slug: string; id: string }) {
  const plugin = useAiPlugin(slug, id);
  if (plugin.isPending) return <Text color="textSecondary">{t.loading}</Text>;
  if (!plugin.data) return <Alert text={t.manage_load_error} />;
  return (
    <>
      <View style={styles.list}>
        {plugin.data.versions.map((version) => (
          <VersionView key={version.n} version={version} />
        ))}
      </View>
      <Publish slug={slug} plugin={plugin.data} />
      <Change slug={slug} plugin={plugin.data} />
    </>
  );
}

function VersionView({ version }: { version: PluginVersion }) {
  return (
    <View role="article" aria-label={`${t.build_version} ${version.n}`} style={styles.version}>
      <View style={styles.request}>
        <Text variant="label" color="textSecondary">
          {`${t.build_you} · ${t.build_version} ${version.n}`}
        </Text>
        <Text variant="body">{version.request}</Text>
      </View>
      {version.status === "working" ? <Working attempts={version.attempts} /> : null}
      {version.status === "failed" ? <Alert text={FAILURES[version.error ?? "internal"]} /> : null}
      {version.status === "ready" && version.outline ? (
        <OutlineCard outline={version.outline} summary={version.summary} />
      ) : null}
    </View>
  );
}

function Working({ attempts }: { attempts: number }) {
  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <ActivityIndicator color={colors.primary} />
        <Text variant="cardTitle" role="status">
          {attempts > 0 ? `${t.build_working_attempt} ${attempts}` : t.build_working}
        </Text>
      </View>
      <Text variant="caption" color="textSecondary">
        {t.build_working_hint}
      </Text>
    </Card>
  );
}

/** What the AI built: the plugin's name, description, what it holds, and the AI's own account of it. */
function OutlineCard({ outline, summary }: { outline: PluginOutline; summary: string | null }) {
  const holds = [
    countOf(outline.views.length, t.build_views),
    countOf(outline.tools.length, t.build_tools),
    countOf(outline.tables.length, t.build_tables),
    ...(outline.dashboardWidgets.length ? [countOf(outline.dashboardWidgets.length, t.build_widgets)] : []),
  ].join(" · ");
  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <Text variant="heading">{outline.icon}</Text>
        <View style={styles.grow}>
          <Heading level={3} variant="headingS">
            {outline.name}
          </Heading>
          <Text variant="small" color="textSecondary">
            {holds}
          </Text>
        </View>
        <Badge text={t.build_made_by_ai} tone="accent" />
      </View>
      {outline.description ? <Text variant="body">{outline.description}</Text> : null}
      {summary ? (
        <Text variant="caption" color="textSecondary">
          {summary}
        </Text>
      ) : null}
    </Card>
  );
}

/** A draft, or which version runs in the place (and opening it); publishing the latest ready version. */
function Publish({ slug, plugin }: { slug: string; plugin: AiPlugin }) {
  const publish = usePublishPlugin(slug, plugin.id);
  const ready = plugin.versions.findLast((v) => v.status === "ready");
  const live = plugin.versions.find((v) => v.n === plugin.published);
  const view = live?.outline?.views[0];
  const canPublish = ready !== undefined && ready.n !== plugin.published && plugin.status !== "working";
  return (
    <View style={styles.list}>
      {plugin.published === null ? (
        <Text variant="bodyL" color="textSecondary">
          {t.build_draft_note}
        </Text>
      ) : (
        <View style={styles.row}>
          <Text variant="bodyL" role="status" style={styles.grow}>
            {`${t.build_published} ${plugin.published}`}
          </Text>
          {view ? <Link href={pluginHref(slug, plugin.id, view)}>{t.build_open}</Link> : null}
        </View>
      )}
      <Alert text={publish.isError ? t.build_publish_error : null} />
      {canPublish ? (
        <Button
          label={plugin.published === null ? t.build_publish : t.build_update}
          disabled={publish.isPending}
          onPress={() => publish.mutate()}
        />
      ) : null}
    </View>
  );
}

/** What to change in the next version (one at a time: not while the AI is writing), also after publishing. */
function Change({ slug, plugin }: { slug: string; plugin: AiPlugin }) {
  const change = useChangePlugin(slug, plugin.id);
  const [request, setRequest] = useState("");
  const send = () => change.mutate(request.trim(), { onSuccess: () => setRequest("") });
  const error = change.isError ? sendError(change.error) : null;
  return (
    <View style={styles.list}>
      <TextField
        label={t.build_change_label}
        value={request}
        onChangeText={setRequest}
        placeholder={t.build_change_placeholder}
        multiline
      />
      <Alert text={error} />
      <Button
        label={t.build_change_send}
        variant="secondary"
        disabled={request.trim().length < MIN_REQUEST || change.isPending || plugin.status === "working"}
        onPress={send}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: spacing[7] },
  headerText: { flex: 1, gap: spacing[1] },
  list: { gap: spacing[6] },
  version: { gap: spacing[5] },
  request: {
    alignSelf: "flex-end",
    maxWidth: "90%",
    gap: spacing[2],
    padding: spacing[7],
    borderRadius: radii.xl,
    backgroundColor: colors.surfaceSunken,
  },
  card: { gap: spacing[5] },
  row: { flexDirection: "row", alignItems: "center", gap: spacing[6] },
  grow: { flex: 1, gap: spacing[1] },
});
