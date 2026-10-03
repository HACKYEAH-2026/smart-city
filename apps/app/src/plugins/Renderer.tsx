import type { Action, GeoLocation, Tone, ToolAction, UINode } from "@app/plugin-sdk";
import { launchCameraAsync, launchImageLibraryAsync, type MediaType } from "expo-image-picker";
import {
  AlertTriangle,
  Camera,
  ChevronRight,
  Image as GalleryIcon,
  Lightbulb,
  type LucideIcon,
  MapPin,
  X,
} from "lucide-react-native";
import { createContext, type ReactNode, useContext, useState } from "react";
import { Image, Modal, Pressable, StyleSheet, View } from "react-native";
import {
  Badge,
  type BadgeTone,
  Button,
  type ButtonVariant,
  Card,
  Chip,
  ChoiceButton,
  Heading,
  Icon,
  MapView,
  SuccessMark,
  SwitchRow,
  Text,
  TextField,
} from "../components";
import { tapFeedback } from "../lib/haptics";
import { STREET_ZOOM } from "../lib/map/spec";
import LocationPicker from "../screens/LocationPicker";
import { t } from "../texts";
import { borders, colors, opacity, radii, sizes, spacing } from "../theme";
import { PluginMap } from "./PluginMap";

/**
 * Server-Driven UI renderer: turns the tree from the plugin API into design-system components.
 * The plugin runs no code here — actions (navigation, tool) are handled by the screen via `onAction`.
 * New node type: schema in packages/sdk/src/ui.ts + a branch in `PluginNode`.
 */
/** Uploads a photo from an ImagePicker field → FileId (provided by the screen, which knows the community and plugin). */
export type UploadImage = (asset: import("expo-image-picker").ImagePickerAsset) => Promise<string>;

/** `onLongPress`: holding anything pressable inside (the dashboard: admins enter edit mode from anywhere on a tile). */
type Actions = { onAction: (action: Action) => void; busy: boolean; upload: UploadImage; onLongPress?: () => void };
const ActionsContext = createContext<Actions>({
  onAction: () => {},
  busy: false,
  upload: () => Promise.reject(new Error("upload unavailable")),
});

/** Inside a dashboard Widget: cards render as compact rows, so a few of them fit in a tile. */
const InWidgetContext = createContext(false);

/** A form field's value: text, a switch's on/off, or a place from a LocationInput. */
type FormValue = string | boolean | GeoLocation;
/** Form values; `undefined` removes the field (e.g. a removed photo does not end up in args). */
type Form = { values: Record<string, FormValue>; set: (name: string, value: FormValue | undefined) => void };
const text = (value: FormValue | undefined) => (typeof value === "string" ? value : "");
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
  onLongPress?: () => void;
}) {
  return (
    <ActionsContext.Provider
      value={{ onAction: props.onAction, busy: props.busy, upload: props.upload, onLongPress: props.onLongPress }}
    >
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
  const { onAction, busy, onLongPress } = useContext(ActionsContext);
  const inWidget = useContext(InWidgetContext);
  switch (node.type) {
    case "Screen":
      return (
        <View style={styles.stack}>
          <Heading level={1}>{node.title}</Heading>
          <Children nodes={node.children} />
        </View>
      );
    // With `onPress` the dashboard makes the whole tile pressable (plugins/Dashboard.tsx); the chevron shows it.
    case "Widget":
      return (
        <Card style={styles.widget}>
          <View role="region" aria-label={node.title} style={styles.widgetBody}>
            <View style={styles.widgetHead}>
              <Heading level={2} style={styles.cardTitle}>
                {node.title}
              </Heading>
              {node.onPress ? <Icon icon={ChevronRight} size={sizes.iconS} color="iconMuted" /> : null}
            </View>
            <InWidgetContext.Provider value={true}>
              <Children nodes={node.children} />
            </InWidgetContext.Provider>
          </View>
        </Card>
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
        <View role="list" aria-label={node.label} style={inWidget ? undefined : styles.list}>
          {node.children.map((n, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: as above.
            <View key={i} role="listitem" style={inWidget && i > 0 ? styles.divider : undefined}>
              <PluginNode node={n} />
            </View>
          ))}
        </View>
      );
    case "Card": {
      if (inWidget) return <WidgetRow node={node} />;
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
          onLongPress={onLongPress}
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
          onLongPress={onLongPress}
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
      return node.url ? <LabeledImage uri={node.url} label={node.alt} /> : null;
    case "ImagePicker":
      return <FormImagePicker node={node} />;
    case "Select":
      return <FormSelect node={node} />;
    case "Switch":
      return <FormSwitch node={node} />;
    case "Hero":
      return <Hero node={node} />;
    case "Map":
      return <PluginMap node={node} still={inWidget} onAction={onAction} />;
    case "LocationInput":
      return <FormLocationInput node={node} />;
    default:
      return (
        <Text variant="bodyL" color="textSecondary">
          {t.plugin_unsupported}
        </Text>
      );
  }
}

/** A card inside a widget: one row (title on one line, subtitle, badge on the right) between hairline dividers. */
function WidgetRow({ node }: { node: Extract<UINode, { type: "Card" }> }) {
  const { onAction, onLongPress } = useContext(ActionsContext);
  const body = (
    <View style={styles.widgetRow}>
      <View style={styles.widgetRowText}>
        <Text variant="cardTitle" numberOfLines={1}>
          {node.title}
        </Text>
        {node.subtitle ? (
          <Text variant="caption" color="textSecondary" numberOfLines={1}>
            {node.subtitle}
          </Text>
        ) : null}
        <Children nodes={node.children} />
      </View>
      {node.badge ? <Badge text={node.badge.text} tone={toBadgeTone(node.badge.tone)} /> : null}
    </View>
  );
  const onPress = node.onPress;
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={node.title}
      onPress={() => onAction(onPress)}
      onLongPress={onLongPress}
      style={({ pressed }) => (pressed ? { opacity: opacity.pressed } : undefined)}
    >
      {body}
    </Pressable>
  ) : (
    body
  );
}

/** Initial form field values (from `value` on nodes), including nested ones. */
function initialValues(nodes: UINode[]): Record<string, FormValue> {
  const out: Record<string, FormValue> = {};
  const walk = (n: UINode) => {
    if ((n.type === "TextInput" || n.type === "Select" || n.type === "Switch") && n.value !== undefined) {
      out[n.name] = n.value;
    }
    if (n.type === "LocationInput" && n.value) out[n.name] = { address: "", ...n.value };
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
      value={text(form?.values[node.name])}
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

  // The camera or the gallery; either way the photo is uploaded and its FileId goes into the form.
  const pick = async (fromCamera: boolean) => {
    const options = { mediaTypes: ["images"] as MediaType[], quality: 0.7 };
    const res = fromCamera ? await launchCameraAsync(options) : await launchImageLibraryAsync(options);
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
      <View role="group" aria-label={node.label} style={styles.photoRow}>
        {preview ? (
          <View style={styles.photoTile}>
            <Image
              source={{ uri: preview }}
              style={styles.photoImage}
              accessible
              accessibilityRole="image"
              accessibilityLabel={t.plugin_photo_preview}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.plugin_photo_remove}
              onPress={remove}
              style={styles.photoRemove}
            >
              <Icon icon={X} size={sizes.photoRemoveIcon} color="onPrimary" strokeWidth={2.6} />
            </Pressable>
          </View>
        ) : null}
        <AddPhotoTile
          icon={Camera}
          label={t.plugin_photo_camera}
          disabled={state === "uploading"}
          onPress={() => pick(true)}
        />
        <AddPhotoTile
          icon={GalleryIcon}
          label={t.plugin_photo_gallery}
          disabled={state === "uploading"}
          onPress={() => pick(false)}
        />
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

/** A square dashed tile that adds a photo (design: "Dodaj"): an icon and its label under it. */
function AddPhotoTile({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPressIn={tapFeedback}
      onPress={onPress}
      style={({ pressed }) => [styles.addTile, pressed && styles.pressedTile, disabled && styles.disabledTile]}
    >
      <Icon icon={icon} size={sizes.iconS} color="primary" strokeWidth={2} />
      <Text variant="small" color="textSecondary">
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * A place on the map: a button opens the app's location picker (address search, the user's position, a pin) over the
 * form; once picked, a still map with the pin, the address and buttons to change or remove it.
 */
function FormLocationInput({ node }: { node: Extract<UINode, { type: "LocationInput" }> }) {
  const form = useContext(FormContext);
  const [picking, setPicking] = useState(false);
  const current = form?.values[node.name];
  const value = typeof current === "object" ? current : undefined;
  return (
    <View style={styles.stackTight}>
      <Text variant="label" color="textSecondary">
        {node.label}
      </Text>
      {value ? (
        <>
          <MapView
            // A new place starts a new preview: the map's first view is its only one.
            key={`${value.lat},${value.lng}`}
            label={t.plugin_location_preview}
            center={value}
            zoom={STREET_ZOOM}
            pins={[{ id: "picked", title: value.address || node.label, lat: value.lat, lng: value.lng }]}
            interactive={false}
            style={styles.locationPreview}
          />
          {value.address ? <Text variant="body">{value.address}</Text> : null}
          <View style={styles.row}>
            <Button
              label={t.plugin_location_change}
              variant="secondary"
              size="sm"
              fullWidth={false}
              onPress={() => setPicking(true)}
            />
            <Button
              label={t.plugin_location_remove}
              variant="destructiveGhost"
              size="sm"
              fullWidth={false}
              onPress={() => form?.set(node.name, undefined)}
            />
          </View>
        </>
      ) : (
        <Button
          label={t.plugin_location_pick}
          variant="secondary"
          leftIcon={<Icon icon={MapPin} size={sizes.iconS} color="primary" />}
          onPress={() => setPicking(true)}
        />
      )}
      {picking ? (
        <Modal visible animationType="slide" onRequestClose={() => setPicking(false)}>
          <LocationPicker
            title={node.label}
            hint={t.plugin_location_hint}
            initial={value ?? null}
            onCancel={() => setPicking(false)}
            onConfirm={({ location, address }) => {
              form?.set(node.name, { ...location, address });
              setPicking(false);
            }}
          />
        </Modal>
      ) : null}
    </View>
  );
}

/**
 * A photo announced once: the label is on the wrapper. On the web, react-native-web adds a hidden <img> with the
 * Image's own label once the photo loads, which would be a second image with the same name.
 */
function LabeledImage({ uri, label }: { uri: string; label: string }) {
  return (
    <View role="img" aria-label={label}>
      <Image source={{ uri }} style={styles.image} resizeMode="cover" />
    </View>
  );
}

/**
 * Select as a radio group, same code native and web, keyboard accessible: large cards in two columns (`cards`, the
 * default) or a row of pills (`chips`).
 */
function FormSelect({ node }: { node: Extract<UINode, { type: "Select" }> }) {
  const form = useContext(FormContext);
  const current = form?.values[node.name];
  const choose = (value: string) => form?.set(node.name, value);
  return (
    <View style={styles.stackTight}>
      <Text variant="label" color="textSecondary">
        {node.label}
      </Text>
      {node.variant === "chips" ? (
        <View role="radiogroup" aria-label={node.label} style={styles.chips}>
          {node.options.map((o) => (
            <Chip key={o.value} label={o.label} selected={o.value === current} onPress={() => choose(o.value)} />
          ))}
        </View>
      ) : (
        <View role="radiogroup" aria-label={node.label} style={styles.cards}>
          {node.options.map((o) => (
            <ChoiceButton
              key={o.value}
              icon={o.icon ? SELECT_ICON[o.icon] : undefined}
              label={o.label}
              selected={o.value === current}
              onPress={() => choose(o.value)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

/** A yes/no field as a switch row; the tool gets a boolean. */
function FormSwitch({ node }: { node: Extract<UINode, { type: "Switch" }> }) {
  const form = useContext(FormContext);
  const value = form?.values[node.name] === true;
  return (
    <SwitchRow label={node.label} hint={node.hint} value={value} onChange={(next) => form?.set(node.name, next)} />
  );
}

/** The confirmation at the top of a view: a check mark, a title and an optional text (design: sent report). */
function Hero({ node }: { node: Extract<UINode, { type: "Hero" }> }) {
  return (
    <View style={styles.hero}>
      <SuccessMark />
      <Heading level={2} variant="headingS">
        {node.title}
      </Heading>
      {node.text ? (
        <Text variant="bodyL" color="textSecondary" style={styles.heroText}>
          {node.text}
        </Text>
      ) : null}
    </View>
  );
}

/** The icons a Select card can show, keyed by the names in packages/sdk (SELECT_ICONS). */
const SELECT_ICON: Record<"alert" | "idea", LucideIcon> = { alert: AlertTriangle, idea: Lightbulb };

const styles = StyleSheet.create({
  photoRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing[4] },
  photoTile: {
    width: sizes.photoTile,
    height: sizes.photoTile,
    borderRadius: radii.xl,
    overflow: "hidden",
  },
  photoImage: { width: "100%", height: "100%" },
  photoRemove: {
    position: "absolute",
    top: -spacing[2],
    right: -spacing[2],
    width: sizes.photoRemove,
    height: sizes.photoRemove,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.text,
    borderWidth: borders.selected,
    borderColor: colors.background,
  },
  addTile: {
    width: sizes.photoTile,
    height: sizes.photoTile,
    borderRadius: radii.xl,
    borderWidth: borders.row,
    borderStyle: "dashed",
    borderColor: colors.dashed,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[2],
  },
  pressedTile: { opacity: opacity.pressed },
  disabledTile: { opacity: opacity.disabled },
  stack: { gap: spacing[9] },
  stackTight: { gap: spacing[2] },
  cards: { flexDirection: "row", gap: spacing[4] },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing[4] },
  hero: { alignItems: "center", gap: spacing[6], paddingVertical: spacing[6] },
  heroText: { textAlign: "center", maxWidth: sizes.heroTextWidth },
  /** Fills the dashboard tile (fixed size from the plugin); content beyond it is clipped. */
  widget: { flex: 1, overflow: "hidden" },
  widgetBody: { gap: spacing[6] },
  widgetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing[4] },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing[4] },
  list: { gap: spacing[6] },
  divider: { borderTopWidth: borders.hairline, borderTopColor: colors.borderSubtle },
  widgetRow: { flexDirection: "row", alignItems: "center", gap: spacing[6], paddingVertical: spacing[5] },
  widgetRowText: { flex: 1, gap: spacing[1] },
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
  locationPreview: {
    height: sizes.locationPreview,
    borderRadius: radii.xl,
    borderWidth: borders.hairline,
    borderColor: colors.border,
  },
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
