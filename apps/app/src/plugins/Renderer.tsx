import type { Action, Tone, ToolAction, UINode } from "@app/plugin-sdk";
import { launchImageLibraryAsync } from "expo-image-picker";
import { createContext, type ReactNode, useContext, useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import {
  Badge,
  type BadgeTone,
  Button,
  type ButtonVariant,
  Card,
  Heading,
  RadioCard,
  Text,
  TextField,
} from "../components";
import { t } from "../texts";
import { borders, colors, opacity, radii, sizes, spacing } from "../theme";

/**
 * Server-Driven UI renderer: turns the tree from the plugin API into design-system components.
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

/** Plugin button variants (SDK) → design-system button variants. */
const BUTTON_VARIANT: Record<NonNullable<Extract<UINode, { type: "Button" }>["variant"]>, ButtonVariant> = {
  primary: "primary",
  quiet: "secondary",
  danger: "destructiveGhost",
};

/** Plugin tones → design-system badge tones. The design has no success/warning/info colors, so only danger stands out. */
const toBadgeTone = (tone: Tone | undefined): BadgeTone => (tone === "danger" ? "accent" : "neutral");

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
  const { onAction, busy } = useContext(ActionsContext);
  switch (node.type) {
    case "Screen":
      return (
        <View style={styles.stack}>
          <Heading level={1}>{node.title}</Heading>
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
            {node.badge ? <Badge text={node.badge.text} tone={toBadgeTone(node.badge.tone)} /> : null}
          </View>
          {node.subtitle ? (
            <Text variant="caption" color="textSecondary">
              {node.subtitle}
            </Text>
          ) : null}
          <Children nodes={node.children} />
        </>
      );
      const onPress = node.onPress;
      return onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={node.title}
          onPress={() => onAction(onPress)}
          style={({ pressed }) => (pressed ? { opacity: opacity.pressed } : undefined)}
        >
          <Card>{body}</Card>
        </Pressable>
      ) : (
        <Card>{body}</Card>
      );
    }
    case "Form":
      return <PluginForm node={node} />;
    case "Heading":
      return <Heading level={node.level ?? 2}>{node.text}</Heading>;
    case "Text":
      return (
        <Text variant="body" color={node.tone === "soft" ? "textSecondary" : "text"}>
          {node.text}
        </Text>
      );
    case "Badge":
      return <Badge text={node.text} tone={toBadgeTone(node.tone)} />;
    case "Button":
      return (
        <Button
          label={node.label}
          variant={BUTTON_VARIANT[node.variant ?? "primary"]}
          disabled={busy && node.action.type === "tool"}
          onPress={() => onAction(node.action)}
        />
      );
    case "Progress": {
      const pct = Math.min(100, Math.round((node.value / node.max) * 100));
      return (
        <View style={styles.stackTight}>
          <Text variant="small" color="textSecondary">
            {node.label}
          </Text>
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
          <Text variant="label" color="textSecondary">
            {node.label}
          </Text>
          <Text variant="heading">{node.value}</Text>
        </View>
      );
    case "Empty":
      return (
        <View style={styles.empty}>
          <Text variant="bodyL" color="textSecondary">
            {node.text}
          </Text>
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
      return (
        <Text variant="bodyL" color="textSecondary">
          {t.plugin_unsupported}
        </Text>
      );
  }
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
      <Text variant="label" color="textSecondary">
        {node.label}
      </Text>
      {preview ? (
        <Image role="img" aria-label={t.plugin_photo_preview} source={{ uri: preview }} style={styles.image} />
      ) : null}
      <View style={styles.row}>
        <Button
          label={preview ? t.plugin_photo_change : t.plugin_photo_pick}
          variant="secondary"
          size="sm"
          fullWidth={false}
          disabled={state === "uploading"}
          onPress={pick}
        />
        {preview ? (
          <Button
            label={t.plugin_photo_remove}
            variant="destructiveGhost"
            size="sm"
            fullWidth={false}
            onPress={remove}
          />
        ) : null}
      </View>
      {state === "uploading" ? (
        <Text variant="caption" color="textSecondary">
          {t.plugin_photo_uploading}
        </Text>
      ) : null}
      {state === "error" ? (
        <Text variant="bodyL" color="primaryPressed" role="alert">
          {t.plugin_photo_error}
        </Text>
      ) : null}
    </View>
  );
}

/** Select as a radio group — same code native and web, keyboard accessible. */
function FormSelect({ node }: { node: Extract<UINode, { type: "Select" }> }) {
  const form = useContext(FormContext);
  const current = form?.values[node.name];
  return (
    <View style={styles.stackTight}>
      <Text variant="label" color="textSecondary">
        {node.label}
      </Text>
      <View role="radiogroup" aria-label={node.label} style={styles.stackTight}>
        {node.options.map((o) => (
          <RadioCard
            key={o.value}
            label={o.label}
            selected={o.value === current}
            onPress={() => form?.set(node.name, o.value)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing[9] },
  stackTight: { gap: spacing[2] },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing[4] },
  list: { gap: spacing[6] },
  cardHead: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[4],
  },
  cardTitle: { flexShrink: 1 },
  track: {
    height: sizes.stepBarHeight,
    borderRadius: sizes.stepBarHeight / 2,
    backgroundColor: colors.border,
    overflow: "hidden",
  },
  fill: { height: "100%", backgroundColor: colors.primary },
  image: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: radii["3xl"],
    backgroundColor: colors.mapBase,
  },
  empty: {
    padding: spacing[9],
    borderWidth: borders.row,
    borderStyle: "dashed",
    borderColor: colors.dashed,
    borderRadius: radii["3xl"],
  },
});
