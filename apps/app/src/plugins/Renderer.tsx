import type { Action, Tone, ToolAction, UINode } from "@app/plugin-sdk";
import { launchImageLibraryAsync } from "expo-image-picker";
import { createContext, type ReactNode, useContext, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Body, Button, Heading, TextField } from "../components/ui";
import { useI18n } from "../lib/i18n";
import { color, font, radius, shadow, space, tone as tones } from "../theme";

/**
 * Server-Driven UI renderer: turns the tree from the plugin API into primitives from components/ui.tsx.
 * The plugin runs no code here — actions (navigation, tool) are handled by the screen via `onAction`.
 * New node type: schema in packages/sdk/src/ui.ts + a branch in `PluginNode`.
 */
/** Uploads a photo from an ImagePicker field → FileId (provided by the screen, which knows the community and plugin). */
export type UploadImage = (asset: import("expo-image-picker").ImagePickerAsset) => Promise<string>;

type Actions = { onAction: (action: Action) => void; busy: boolean; upload: UploadImage };
const ActionsContext = createContext<Actions>({
  onAction: () => {},
  busy: false,
  upload: () => Promise.reject(new Error("upload unavailable")),
});

/** Form values; `undefined` removes the field (e.g. a removed photo does not end up in args). */
type Form = { values: Record<string, string>; set: (name: string, value: string | undefined) => void };
const FormContext = createContext<Form | null>(null);

export function PluginRenderer(props: {
  node: UINode;
  onAction: (action: Action) => void;
  busy: boolean;
  upload: UploadImage;
}) {
  return (
    <ActionsContext.Provider value={{ onAction: props.onAction, busy: props.busy, upload: props.upload }}>
      <PluginNode node={props.node} />
    </ActionsContext.Provider>
  );
}

const Children = ({ nodes }: { nodes?: UINode[] }) =>
  nodes?.map((n, i) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: the server tree has no stable ids; order = identity
    <PluginNode key={`${n.type}-${i}`} node={n} />
  ));

function PluginNode({ node }: { node: UINode }): ReactNode {
  const { t } = useI18n();
  const { onAction, busy } = useContext(ActionsContext);
  switch (node.type) {
    case "Screen":
      return (
        <View style={styles.stack}>
          <Heading level={1} size="section">
            {node.title}
          </Heading>
          <Children nodes={node.children} />
        </View>
      );
    case "Stack":
      return (
        <View style={styles.stack}>
          <Children nodes={node.children} />
        </View>
      );
    case "Row":
      return (
        <View style={styles.row}>
          <Children nodes={node.children} />
        </View>
      );
    case "List":
      return (
        <View role="list" aria-label={node.label} style={styles.list}>
          {node.children.map((n, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: as above.
            <View key={i} role="listitem">
              <PluginNode node={n} />
            </View>
          ))}
        </View>
      );
    case "Card": {
      const body = (
        <>
          <View style={styles.cardHead}>
            <Heading level={3} style={styles.cardTitle}>
              {node.title}
            </Heading>
            {node.badge ? <Badge text={node.badge.text} tone={node.badge.tone} /> : null}
          </View>
          {node.subtitle ? <Body tone="soft">{node.subtitle}</Body> : null}
          <Children nodes={node.children} />
        </>
      );
      const onPress = node.onPress;
      return onPress ? (
        <Pressable
          role="button"
          aria-label={node.title}
          onPress={() => onAction(onPress)}
          style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
        >
          {body}
        </Pressable>
      ) : (
        <View style={styles.card}>{body}</View>
      );
    }
    case "Form":
      return <PluginForm node={node} />;
    case "Heading":
      return <Heading level={node.level ?? 2}>{node.text}</Heading>;
    case "Text":
      return <Body tone={node.tone === "soft" ? "soft" : "ink"}>{node.text}</Body>;
    case "Badge":
      return <Badge text={node.text} tone={node.tone} />;
    case "Button":
      return (
        <Button
          label={node.label}
          variant={node.variant ?? "primary"}
          disabled={busy && node.action.type === "tool"}
          onPress={() => onAction(node.action)}
        />
      );
    case "Progress": {
      const pct = Math.min(100, Math.round((node.value / node.max) * 100));
      return (
        <View style={styles.stackTight}>
          <Body size="small" tone="soft">
            {node.label}
          </Body>
          <View
            role="progressbar"
            aria-label={node.label}
            aria-valuemin={0}
            aria-valuemax={node.max}
            aria-valuenow={node.value}
            style={styles.track}
          >
            <View style={[styles.fill, { width: `${pct}%` }]} />
          </View>
        </View>
      );
    }
    case "Stat":
      return (
        <View style={styles.stackTight}>
          <Body size="small" tone="soft">
            {node.label}
          </Body>
          <Text style={styles.statValue}>{node.value}</Text>
        </View>
      );
    case "Empty":
      return (
        <View style={styles.empty}>
          <Body tone="soft">{node.text}</Body>
        </View>
      );
    case "TextInput":
      return <FormTextInput node={node} />;
    case "Image":
      return node.url ? (
        <Image role="img" aria-label={node.alt} source={{ uri: node.url }} style={styles.image} resizeMode="cover" />
      ) : null;
    case "ImagePicker":
      return <FormImagePicker node={node} />;
    case "Select":
      return <FormSelect node={node} />;
    default:
      return <Body tone="soft">{t.plugin_unsupported()}</Body>;
  }
}

function Badge(props: { text: string; tone?: Tone | undefined }) {
  const c = tones[props.tone ?? "neutral"];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.fg }]}>{props.text}</Text>
    </View>
  );
}

/** Initial form field values (from `value` on nodes), including nested ones. */
function initialValues(nodes: UINode[]): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (n: UINode) => {
    if ((n.type === "TextInput" || n.type === "Select") && n.value !== undefined) out[n.name] = n.value;
    if ("children" in n) n.children?.forEach(walk);
  };
  nodes.forEach(walk);
  return out;
}

function PluginForm({ node }: { node: Extract<UINode, { type: "Form" }> }) {
  const { onAction, busy } = useContext(ActionsContext);
  const [values, setValues] = useState(() => initialValues(node.children));
  const submit: ToolAction = { ...node.submit, args: { ...node.submit.args, ...values } };
  return (
    <FormContext.Provider
      value={{
        values,
        set: (k, v) =>
          setValues((s) => {
            const { [k]: _, ...rest } = s;
            return v === undefined ? rest : { ...rest, [k]: v };
          }),
      }}
    >
      <View style={styles.stack}>
        <Children nodes={node.children} />
        <Button label={node.submitLabel} disabled={busy} onPress={() => onAction(submit)} />
      </View>
    </FormContext.Provider>
  );
}

function FormTextInput({ node }: { node: Extract<UINode, { type: "TextInput" }> }) {
  const form = useContext(FormContext);
  return (
    <TextField
      label={node.label}
      multiline={node.multiline}
      value={form?.values[node.name] ?? ""}
      onChangeText={(v) => form?.set(node.name, v)}
    />
  );
}

/** Photo picker: gallery → upload → FileId in the form field; preview and removal. */
function FormImagePicker({ node }: { node: Extract<UINode, { type: "ImagePicker" }> }) {
  const { t } = useI18n();
  const form = useContext(FormContext);
  const { upload } = useContext(ActionsContext);
  const [preview, setPreview] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "uploading" | "error">("idle");

  const pick = async () => {
    const res = await launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
    const asset = res.canceled ? undefined : res.assets[0];
    if (!asset) return;
    setState("uploading");
    try {
      form?.set(node.name, await upload(asset));
      setPreview(asset.uri);
      setState("idle");
    } catch {
      setState("error");
    }
  };
  const remove = () => {
    form?.set(node.name, undefined);
    setPreview(null);
  };

  return (
    <View style={styles.stackTight}>
      <Text style={styles.fieldLabel}>{node.label}</Text>
      {preview ? (
        <Image role="img" aria-label={t.plugin_photo_preview()} source={{ uri: preview }} style={styles.image} />
      ) : null}
      <View style={styles.row}>
        <Button
          label={preview ? t.plugin_photo_change() : t.plugin_photo_pick()}
          variant="quiet"
          disabled={state === "uploading"}
          onPress={pick}
        />
        {preview ? <Button label={t.plugin_photo_remove()} variant="quiet" onPress={remove} /> : null}
      </View>
      {state === "uploading" ? <Body tone="soft">{t.plugin_photo_uploading()}</Body> : null}
      {state === "error" ? (
        <Body tone="error" role="alert">
          {t.plugin_photo_error()}
        </Body>
      ) : null}
    </View>
  );
}

/** Select as a radio button group — same code native and web, keyboard accessible. */
function FormSelect({ node }: { node: Extract<UINode, { type: "Select" }> }) {
  const form = useContext(FormContext);
  const current = form?.values[node.name];
  return (
    <View style={styles.stackTight}>
      <Text style={styles.fieldLabel}>{node.label}</Text>
      <View role="radiogroup" aria-label={node.label} style={styles.row}>
        {node.options.map((o) => {
          const checked = o.value === current;
          return (
            <Pressable
              key={o.value}
              role="radio"
              aria-checked={checked}
              aria-label={o.label}
              onPress={() => form?.set(node.name, o.value)}
              style={[styles.chip, checked && styles.chipOn]}
            >
              <Text style={[styles.chipText, checked && styles.chipTextOn]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.l },
  stackTight: { gap: space.xs },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.s },
  list: { gap: space.m },
  card: { backgroundColor: color.sheet, borderRadius: radius.card, padding: space.xl, gap: space.s, ...shadow.sheet },
  cardHead: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.s,
  },
  cardTitle: { flexShrink: 1 },
  badge: {
    borderRadius: radius.control,
    paddingHorizontal: space.m,
    paddingVertical: space.xs,
    alignSelf: "flex-start",
  },
  badgeText: { fontFamily: font.text, fontSize: 14, fontWeight: "600" },
  track: { height: 10, borderRadius: radius.control, backgroundColor: color.paperDeep, overflow: "hidden" },
  fill: { height: "100%", backgroundColor: color.ink },
  image: { width: "100%", aspectRatio: 4 / 3, borderRadius: radius.card, backgroundColor: color.paperDeep },
  statValue: { fontFamily: font.display, fontSize: 24, color: color.ink },
  empty: {
    padding: space.xl,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: color.rule,
    borderRadius: radius.card,
  },
  fieldLabel: { fontFamily: font.text, fontSize: 14, fontWeight: "600", color: color.inkSoft },
  chip: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: space.l,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: color.rule,
    backgroundColor: color.sheet,
  },
  chipOn: { backgroundColor: color.ink, borderColor: color.ink },
  chipText: { fontFamily: font.text, fontSize: 15, color: color.ink },
  chipTextOn: { color: color.onInk, fontWeight: "600" },
});
