import type { Action, GeoLocation, Tone, ToolAction, UIIcon, UINode, WidgetLink } from "@app/plugin-sdk";
import { launchCameraAsync, launchImageLibraryAsync, type MediaType } from "expo-image-picker";
import {
  AlertTriangle,
  ArrowUp,
  Camera,
  ChevronRight,
  Image as GalleryIcon,
  Lightbulb,
  type LucideIcon,
  MapPin,
  Megaphone,
  MessagesSquare,
  Plus,
  Send,
  Share2,
  X,
} from "lucide-react-native";
import { createContext, type ReactNode, useContext, useState } from "react";
import { Image, Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
  SegmentedControl,
  SuccessMark,
  SwitchRow,
  Text,
  TextField,
} from "../components";
import { tapFeedback } from "../lib/haptics";
import { STREET_ZOOM } from "../lib/map/spec";
import { initials } from "../lib/places";
import { relativeTime } from "../lib/relativeTime";
import { shareLink } from "../lib/share";
import LocationPicker from "../screens/LocationPicker";
import { t } from "../texts";
import { borders, type ColorToken, colors, layout, opacity, radii, shadows, sizes, spacing } from "../theme";
import { PluginMap } from "./PluginMap";

/**
 * Server-Driven UI renderer: turns the tree from the plugin API into design-system components.
 * The plugin runs no code here — actions (navigation, tool) are handled by the screen via `onAction`.
 * New node type: schema in packages/sdk/src/ui.ts + a branch in `PluginNode`.
 */
/** Uploads a photo from an ImagePicker field → FileId (provided by the screen, which knows the community and plugin). */
export type UploadImage = (asset: import("expo-image-picker").ImagePickerAsset) => Promise<string>;

/** Nodes that float over the screen, outside its scroll (a screen's "Zgłoś" button): PluginView draws them as an overlay. */
export const isFloating = (node: UINode) => node.type === "Fab";

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
const toBadgeTone = (tone: Tone | undefined): BadgeTone => {
  if (tone === "danger") return "accent";
  if (tone === "info" || tone === "warning" || tone === "success") return tone;
  return "neutral";
};

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
          <View style={styles.screenHead}>
            {node.eyebrow ? (
              <Text variant="label" color="textSecondary">
                {node.eyebrow}
              </Text>
            ) : null}
            <Heading level={1}>{node.title}</Heading>
          </View>
          <Children nodes={node.children.filter((n) => !isFloating(n))} />
        </View>
      );
    // With `onPress` the dashboard makes the whole tile pressable (plugins/Dashboard.tsx); without a `link` the chevron
    // shows it. The header: an icon, the title and a subtitle, and the link (e.g. "Wszystkie") on the right.
    case "Widget":
      return (
        <Card style={styles.widget}>
          <View role="region" aria-label={node.title} style={styles.widgetBody}>
            <View style={styles.widgetHead}>
              {node.icon ? (
                <View style={styles.widgetIcon}>
                  <Icon icon={UI_ICON[node.icon]} size={sizes.iconM} color="primary" strokeWidth={1.9} />
                </View>
              ) : null}
              <View style={styles.widgetHeadText}>
                <Heading level={2} style={styles.cardTitle}>
                  {node.title}
                </Heading>
                {node.subtitle ? (
                  <Text variant="small" color="textSecondary">
                    {node.subtitle}
                  </Text>
                ) : null}
              </View>
              {node.link ? (
                <WidgetLinkButton link={node.link} />
              ) : node.onPress ? (
                <Icon icon={ChevronRight} size={sizes.iconS} color="iconMuted" />
              ) : null}
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
      return node.grow ? (
        <GrowRow nodes={node.children} />
      ) : (
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
      if (node.counter || node.tags) return <ListCard node={node} />;
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
    case "Button": {
      const variant = BUTTON_VARIANT[node.variant ?? "primary"];
      // Inside a widget the buttons sit side by side: a smaller size with less padding, so the labels fit.
      return (
        <Button
          label={node.label}
          variant={variant}
          size={inWidget ? "md" : "lg"}
          leftIcon={
            node.icon ? <Icon icon={UI_ICON[node.icon]} size={sizes.iconS} color={iconColor(variant)} /> : undefined
          }
          style={inWidget ? styles.widgetButton : undefined}
          disabled={busy && node.action.type === "tool"}
          onPress={() => onAction(node.action)}
          onLongPress={onLongPress}
        />
      );
    }
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
    case "Highlight":
      return <HighlightTile node={node} />;
    case "Tabs":
      return <PluginTabs node={node} />;
    case "Timeline":
      return <PluginTimeline node={node} />;
    case "Place":
      return (
        <View style={styles.placeRow}>
          <Icon icon={MapPin} size={sizes.iconS} color="primary" strokeWidth={2} />
          <Text variant="body" style={styles.placeText}>
            {node.text}
          </Text>
        </View>
      );
    case "Tags":
      return (
        <View style={styles.tags}>
          {node.items.map((tag, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: tags keep their order.
            <TagBadge key={`${tag.text}-${i}`} tag={tag} />
          ))}
        </View>
      );
    case "Share":
      return <ShareButton node={node} />;
    case "Fab":
      return <FloatingAction node={node} />;
    case "Activity":
      return <ActivityRow node={node} />;
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

/**
 * A list card with tags and a counter (design: a report in the list): the counter at the left (votes), the tags, the
 * title and the subtitle at the right. Without a counter it still lays out the same way.
 */
function ListCard({ node }: { node: Extract<UINode, { type: "Card" }> }) {
  const { onAction, onLongPress } = useContext(ActionsContext);
  const body = (
    <View style={styles.listCard}>
      {node.counter ? <Counter counter={node.counter} /> : null}
      <View style={styles.listCardText}>
        {node.tags?.length ? (
          <View style={styles.tags}>
            {node.tags.map((tag, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: tags of one card keep their order; the text may repeat.
              <TagBadge key={`${tag.text}-${i}`} tag={tag} />
            ))}
          </View>
        ) : null}
        <Text variant="cardTitle">{node.title}</Text>
        {node.subtitle ? (
          <Text variant="small" color="textSecondary">
            {node.subtitle}
          </Text>
        ) : null}
        <Children nodes={node.children} />
      </View>
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

/**
 * The counter of a list card (votes): an arrow and the number. Pressed (the viewer counted it) it is filled red; with no
 * action it cannot be pressed again, so it is shown as it is.
 */
function Counter({ counter }: { counter: NonNullable<Extract<UINode, { type: "Card" }>["counter"]> }) {
  const { onAction, busy } = useContext(ActionsContext);
  const action = counter.action;
  const color = counter.pressed ? "onPrimary" : "text";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={counter.label}
      accessibilityState={{ disabled: !action || busy, selected: counter.pressed }}
      disabled={!action || busy}
      onPressIn={action ? tapFeedback : undefined}
      onPress={() => action && onAction(action)}
      style={({ pressed }) => [
        styles.counter,
        counter.pressed ? styles.counterOn : styles.counterOff,
        pressed && action && styles.pressedTile,
      ]}
    >
      <Icon icon={ArrowUp} size={sizes.iconS} color={color} strokeWidth={2.4} />
      <Text variant="buttonM" color={color}>
        {counter.value}
      </Text>
    </Pressable>
  );
}

/** A tag on a list card: the plugin's tone, an optional icon, an optional dot (a status). */
function TagBadge({ tag }: { tag: NonNullable<Extract<UINode, { type: "Card" }>["tags"]>[number] }) {
  return (
    <Badge text={tag.text} tone={toBadgeTone(tag.tone)} icon={tag.icon ? UI_ICON[tag.icon] : undefined} dot={tag.dot} />
  );
}

/** Tabs that only navigate: a segmented track (sorting) or a row of chips (filters). The plugin marks the selected one. */
function PluginTabs({ node }: { node: Extract<UINode, { type: "Tabs" }> }) {
  const { onAction } = useContext(ActionsContext);
  const selected = node.options.find((o) => o.selected)?.label ?? node.options[0]?.label ?? "";
  if (node.variant === "chips") {
    return (
      <View role="radiogroup" aria-label={node.label} style={styles.chips}>
        {node.options.map((o) => (
          <Chip key={o.label} label={o.label} selected={o.label === selected} onPress={() => onAction(o.action)} />
        ))}
      </View>
    );
  }
  return (
    <View role="group" aria-label={node.label}>
      <SegmentedControl
        options={node.options.map((o) => ({ value: o.label, label: o.label }))}
        value={selected}
        onChange={(label) => {
          const option = node.options.find((o) => o.label === label);
          if (option) onAction(option.action);
        }}
      />
    </View>
  );
}

/** The tone of a timeline step's dot, from the same palette as the tags. */
const TIMELINE_DOT: Record<Tone, ColorToken> = {
  neutral: "dot",
  info: "infoText",
  warning: "warningText",
  success: "successText",
  danger: "primary",
};

/**
 * The steps of something that moves on (a report's progress): a dot per step, joined by a line, with the step's title,
 * its date and an optional note in a box.
 */
function PluginTimeline({ node }: { node: Extract<UINode, { type: "Timeline" }> }) {
  return (
    <View role="list" aria-label={t.plugin_progress} style={styles.timelineCard}>
      {node.items.map((item, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the steps keep their order; they are the history.
        <View key={i} role="listitem" style={styles.step}>
          <View style={styles.stepRail}>
            <View style={[styles.stepDot, { backgroundColor: colors[TIMELINE_DOT[item.tone ?? "neutral"]] }]} />
            {i < node.items.length - 1 ? <View style={styles.stepLine} /> : null}
          </View>
          <View style={styles.stepBody}>
            <Text variant="cardTitle">{item.at ? `${item.title} · ${item.at}` : item.title}</Text>
            {item.text ? (
              <Text variant="body" color="textBody" style={styles.stepNote}>
                {item.text}
              </Text>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

/** Shares a link to a place in the app through the system share sheet (design: "Udostępnij"). */
function ShareButton({ node }: { node: Extract<UINode, { type: "Share" }> }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={node.label}
      onPressIn={tapFeedback}
      onPress={() => shareLink(node.path)}
      style={({ pressed }) => [styles.squareButton, styles.squareOutline, pressed && styles.pressedTile]}
    >
      <Icon icon={Share2} size={sizes.iconS} color="text" strokeWidth={1.9} />
    </Pressable>
  );
}

/** The floating button of a screen (design: "Zgłoś" with a camera): bottom right, above the scrolling content. */
function FloatingAction({ node }: { node: Extract<UINode, { type: "Fab" }> }) {
  const { onAction } = useContext(ActionsContext);
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={node.label}
      onPressIn={tapFeedback}
      onPress={() => onAction(node.action)}
      style={({ pressed }) => [styles.fab, { bottom: insets.bottom + spacing[9] }, pressed && styles.pressedTile]}
    >
      {node.icon ? <Icon icon={UI_ICON[node.icon]} size={sizes.iconM} color="onPrimary" strokeWidth={2} /> : null}
      <Text variant="button" color="onPrimary">
        {node.label}
      </Text>
    </Pressable>
  );
}

/** The widget header's link ("Wszystkie"): a text button; the tile itself opens the same view. */
function WidgetLinkButton({ link }: { link: WidgetLink }) {
  const { onAction } = useContext(ActionsContext);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={link.label}
      hitSlop={spacing[5]}
      onPress={() => onAction(link.action)}
      style={({ pressed }) => (pressed ? { opacity: opacity.pressed } : undefined)}
    >
      <Text variant="buttonS" color="text">
        {link.label}
      </Text>
    </Pressable>
  );
}

/** The widget's highlighted item: a thumbnail, an eyebrow, the title and the votes with an up arrow. Tapping opens it. */
function HighlightTile({ node }: { node: Extract<UINode, { type: "Highlight" }> }) {
  const { onAction, onLongPress } = useContext(ActionsContext);
  const body = (
    <View style={styles.highlight}>
      <View style={styles.highlightThumb}>
        {node.image?.url ? (
          <View role="img" aria-label={node.image.alt} style={styles.highlightPhoto}>
            <Image source={{ uri: node.image.url }} style={styles.highlightPhoto} resizeMode="cover" />
          </View>
        ) : null}
      </View>
      <View style={styles.highlightText}>
        <Text variant="label" color="textSecondary">
          {node.eyebrow}
        </Text>
        <Text variant="cardTitle" numberOfLines={2}>
          {node.title}
        </Text>
      </View>
      {node.votes !== undefined ? (
        <View style={styles.votes}>
          <Icon icon={ArrowUp} size={sizes.iconS} color="primary" strokeWidth={2.2} />
          <Text variant="cardTitle" color="primary">
            {node.votes}
          </Text>
        </View>
      ) : null}
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

/**
 * Someone's activity: their initials, the title with the time ("5 min temu") and a line of text. New for the user
 * (`unread`): a red avatar, time and dot. In a widget one compact row between the list's dividers; on a screen a card
 * with the text in full (e.g. a message in a thread).
 */
function ActivityRow({ node }: { node: Extract<UINode, { type: "Activity" }> }) {
  const { onAction, onLongPress } = useContext(ActionsContext);
  const inWidget = useContext(InWidgetContext);
  const time = node.at ? relativeTime(node.at, new Date(), inWidget ? "short" : "long") : null;
  const body = (
    <View style={inWidget ? styles.activity : undefined}>
      <View style={styles.activityRow}>
        {node.person ? (
          <View style={[styles.avatar, node.unread && styles.avatarNew]}>
            <Text variant="buttonS" color={node.unread ? "primary" : "text"}>
              {initials(node.person)}
            </Text>
          </View>
        ) : null}
        <View style={styles.activityText}>
          <View style={[styles.activityLine, styles.activityHead]}>
            <Text variant="cardTitle" numberOfLines={inWidget ? 1 : undefined} style={styles.activityGrow}>
              {node.title}
            </Text>
            {time ? (
              <Text variant="small" color={node.unread ? "primary" : "textSecondary"}>
                {time}
              </Text>
            ) : null}
          </View>
          <View style={styles.activityLine}>
            {node.text ? (
              <Text
                variant={inWidget ? "caption" : "body"}
                color={inWidget ? "textSecondary" : "text"}
                numberOfLines={inWidget ? 1 : undefined}
                style={styles.activityGrow}
              >
                {node.text}
              </Text>
            ) : null}
            {node.unread ? <View aria-label={t.plugin_activity_new} role="img" style={styles.newDot} /> : null}
          </View>
        </View>
      </View>
    </View>
  );
  const content = inWidget ? body : <Card>{body}</Card>;
  const onPress = node.onPress;
  if (!onPress) return content;
  const label = [node.title, node.unread ? t.plugin_activity_new : null, node.text, time].filter(Boolean).join(", ");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => onAction(onPress)}
      onLongPress={onLongPress}
      style={({ pressed }) => (pressed ? { opacity: opacity.pressed } : undefined)}
    >
      {content}
    </Pressable>
  );
}

/** Children share the row's width equally (`grow`), e.g. two buttons side by side in a widget. */
function GrowRow({ nodes }: { nodes: UINode[] }) {
  return (
    <View style={styles.rowGrow}>
      {nodes.map((n, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: as in Children, the order is the identity.
        <View key={`${n.type}-${i}`} style={n.type === "Share" ? undefined : styles.growCell}>
          <PluginNode node={n} />
        </View>
      ))}
    </View>
  );
}

/** The icon's colour on a button: white on the red primary button, ink on the others. */
const iconColor = (variant: ButtonVariant): "onPrimary" | "text" => (variant === "primary" ? "onPrimary" : "text");

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
      {node.inline ? (
        <View style={styles.composer}>
          <View style={styles.composerField}>
            <Children nodes={node.children} />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={node.submitLabel}
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPressIn={tapFeedback}
            onPress={() => onAction(submit)}
            style={({ pressed }) => [
              styles.squareButton,
              styles.squarePrimary,
              pressed && styles.pressedTile,
              busy && styles.disabledTile,
            ]}
          >
            <Icon icon={Send} size={sizes.iconS} color="onPrimary" strokeWidth={2} />
          </Pressable>
        </View>
      ) : (
        <View style={styles.stack}>
          <Children nodes={node.children} />
          <Button label={node.submitLabel} disabled={busy} onPress={() => onAction(submit)} />
        </View>
      )}
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
    } catch (error) {
      console.warn("plugin photo upload failed", { mime: asset.mimeType, name: asset.fileName, error });
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
            <View role="img" aria-label={t.plugin_photo_preview} style={styles.photoImage}>
              <Image source={{ uri: preview }} style={styles.photoImage} />
            </View>
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
              icon={o.icon ? UI_ICON[o.icon] : undefined}
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

/** The icons a node can show, keyed by the names in packages/sdk (UI_ICONS). */
const UI_ICON: Record<UIIcon, LucideIcon> = {
  alert: AlertTriangle,
  idea: Lightbulb,
  camera: Camera,
  megaphone: Megaphone,
  share: Share2,
  send: Send,
  pin: MapPin,
  chat: MessagesSquare,
  plus: Plus,
};

const styles = StyleSheet.create({
  photoRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing[4] },
  // No overflow clipping on the tile: the remove button sits over its corner. The rounding clips the photo only.
  photoTile: { width: sizes.photoTile, height: sizes.photoTile },
  photoImage: { width: "100%", height: "100%", borderRadius: radii.xl, overflow: "hidden" },
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
  // Fills the widget: the content spreads from the header to the actions, so the frame is never half empty.
  widgetBody: { flex: 1, gap: spacing[6], justifyContent: "space-between" },
  widgetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing[4] },
  placeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[4],
    padding: spacing[5],
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  placeText: { flex: 1, minWidth: 0 },
  timeline: { gap: spacing[2] },
  timelineCard: {
    gap: spacing[2],
    padding: spacing[8],
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  step: { flexDirection: "row", gap: spacing[6] },
  stepRail: { alignItems: "center", width: spacing[6] },
  stepDot: {
    width: sizes.tagDot + spacing[1],
    height: sizes.tagDot + spacing[1],
    borderRadius: radii.pill,
    marginTop: spacing[2],
  },
  stepLine: { flex: 1, width: borders.hairline, backgroundColor: colors.divider, marginVertical: spacing[1] },
  stepBody: { flex: 1, minWidth: 0, gap: spacing[2], paddingBottom: spacing[6] },
  stepNote: { backgroundColor: colors.background, borderRadius: radii.lg, padding: spacing[4] },
  widgetIcon: {
    width: sizes.avatarLg,
    height: sizes.avatarLg,
    borderRadius: radii.md,
    backgroundColor: colors.primaryTint,
    alignItems: "center",
    justifyContent: "center",
  },
  widgetHeadText: { flex: 1, gap: spacing[1] },
  widgetButton: { paddingHorizontal: spacing[4] },
  screenHead: { gap: spacing[2] },
  listCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing[6],
    padding: spacing[6],
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  listCardText: { flex: 1, minWidth: 0, gap: spacing[2] },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
  counter: {
    width: sizes.voteWidth,
    minHeight: sizes.voteHeight,
    borderRadius: radii.lg,
    borderWidth: borders.hairline,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[1],
    flexShrink: 0,
  },
  counterOff: { backgroundColor: colors.surface, borderColor: colors.border },
  counterOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  fab: {
    position: "absolute",
    right: layout.screenPaddingX,
    height: sizes.fab,
    paddingHorizontal: spacing[8],
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[4],
    ...shadows.floating,
  },
  rowGrow: { flexDirection: "row", gap: spacing[4] },
  /** A square icon button beside a field or a button, the height of a main button. */
  squareButton: {
    width: sizes.squareButton,
    height: sizes.squareButton,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  squareOutline: { backgroundColor: colors.surface, borderWidth: borders.hairline, borderColor: colors.border },
  squarePrimary: { backgroundColor: colors.primary },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: spacing[4] },
  composerField: { flex: 1, minWidth: 0 },
  growCell: { flex: 1, minWidth: 0 },
  highlight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[6],
    padding: spacing[5],
    borderRadius: radii.xl,
    backgroundColor: colors.background,
  },
  highlightThumb: {
    width: sizes.highlightThumb,
    height: sizes.highlightThumb,
    borderRadius: radii.md,
    overflow: "hidden",
    backgroundColor: colors.mapBase,
    flexShrink: 0,
  },
  highlightPhoto: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  highlightText: { flex: 1, minWidth: 0, gap: spacing[1] },
  votes: { alignItems: "center", flexShrink: 0 },
  activity: { paddingVertical: spacing[5] },
  activityRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing[6] },
  avatar: {
    width: sizes.avatarMd,
    height: sizes.avatarMd,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarNew: { backgroundColor: colors.primaryTint },
  activityText: { flex: 1, minWidth: 0, gap: spacing[1] },
  activityLine: { flexDirection: "row", alignItems: "center", gap: spacing[4] },
  activityHead: { alignItems: "flex-start" },
  activityGrow: { flex: 1, minWidth: 0 },
  newDot: { width: spacing[4], height: spacing[4], borderRadius: radii.pill, backgroundColor: colors.primary },
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
