import type { Action, Tone, ToolAction, UINode, WidgetLink } from "@app/plugin-sdk";
import { ArrowUp, ChevronRight, MapPin, Send, Share2 } from "lucide-react-native";
import { type ReactNode, useContext, useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Badge,
  Button,
  type ButtonVariant,
  Card,
  Chip,
  Heading,
  Icon,
  SegmentedControl,
  SuccessMark,
  Text,
} from "../components";
import { toggleA11y } from "../lib/a11y";
import { tapFeedback } from "../lib/haptics";
import { initials } from "../lib/places";
import { relativeTime } from "../lib/relativeTime";
import { shareLink } from "../lib/share";
import { t } from "../texts";
import {
  borders,
  type ColorToken,
  colors,
  fontFamily,
  layout,
  opacity,
  radii,
  shadows,
  sizes,
  spacing,
} from "../theme";
import { CardRow } from "./CardRow";
import {
  type ActionOptions,
  ActionsContext,
  FormContext,
  InGroupContext,
  InlineFormContext,
  InSheetContext,
  InWidgetContext,
  type UploadImage,
} from "./context";
import { FormImagePicker, FormLocationInput, FormSelect, FormSwitch, FormTextInput, initialValues } from "./Fields";
import { PluginGallery } from "./Gallery";
import { UI_ICON } from "./icons";
import { PluginMenu } from "./Menu";
import { MetaLine } from "./MetaLine";
import { PluginMap } from "./PluginMap";
import { syncFormValues } from "./state";
import { TagList } from "./Tags";
import { toBadgeTone } from "./tone";

export type { UploadImage } from "./context";

/**
 * Server-Driven UI renderer: turns the tree from the plugin API into design-system components.
 * The plugin runs no code here — actions (navigation, tool) are handled by the screen via `onAction`.
 * New node type: schema in packages/sdk/src/ui.ts + a branch in `PluginNode`.
 * A Screen's header (back, eyebrow, title, actions) is the screen's (src/plugins/ScreenHeader.tsx); here a Screen is
 * its content only.
 */

/** Nodes that float over the screen, outside its scroll (a screen's "Zgłoś" button): PluginView draws them as an overlay. */
export const isFloating = (node: UINode) => node.type === "Fab";

export function PluginRenderer(props: {
  node: UINode;
  onAction: (action: Action, options?: ActionOptions) => void;
  busy: boolean;
  upload: UploadImage;
  onLongPress?: () => void;
  /** Draws a node's sheet (a Menu's options) over the whole screen; see Actions in ./context. */
  showOverlay?: (overlay: ReactNode | null) => void;
}) {
  const { node, ...actions } = props;
  return (
    <ActionsContext.Provider value={actions}>
      <PluginNode node={node} />
    </ActionsContext.Provider>
  );
}

const Children = ({ nodes }: { nodes?: UINode[] }) =>
  nodes?.map((n, i) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: the server tree has no stable ids; order = identity
    <PluginNode key={`${n.type}-${i}`} node={n} />
  ));

/** Plugin button variants (SDK) → design-system button variants. */
const BUTTON_VARIANT: Record<NonNullable<Extract<UINode, { type: "Button" }>["variant"]>, ButtonVariant> = {
  primary: "primary",
  quiet: "secondary",
  danger: "destructiveGhost",
  ink: "dark",
};

function PluginNode({ node }: { node: UINode }): ReactNode {
  const { onAction } = useContext(ActionsContext);
  const inWidget = useContext(InWidgetContext);
  const inSheet = useContext(InSheetContext);
  switch (node.type) {
    case "Screen":
      return (
        <View style={[styles.screen, (node.chrome === false || inSheet) && styles.confirmation]}>
          <Children nodes={node.children.filter((n) => !isFloating(n))} />
        </View>
      );
    case "Widget":
      return <WidgetTile node={node} />;
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
      return <PluginList node={node} />;
    case "Card":
      return (
        <CardRow
          node={node}
          headerContent={
            node.variant === "featured" && node.children?.[0]?.type === "Menu" ? (
              <PluginNode node={node.children[0]} />
            ) : undefined
          }
        >
          <Children
            nodes={
              node.variant === "featured" && node.children?.[0]?.type === "Menu"
                ? node.children.slice(1)
                : node.children
            }
          />
        </CardRow>
      );
    case "Form":
      return <PluginForm node={node} />;
    case "Heading":
      return (
        <Heading
          level={node.level ?? 2}
          variant={node.level === 3 ? "sectionLabel" : undefined}
          color={node.level === 3 ? "textSecondary" : "text"}
        >
          {node.text}
        </Heading>
      );
    case "Text":
      return (
        <Text variant="body" color={node.tone === "soft" ? "textSecondary" : "text"}>
          {node.text}
        </Text>
      );
    case "Badge":
      return <Badge text={node.text} tone={toBadgeTone(node.tone)} />;
    case "Button":
      return <PluginButton node={node} />;
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
        <View style={styles.stat}>
          <Text variant="headingS" color={STAT_COLOR[node.tone ?? "neutral"]}>
            {node.value}
          </Text>
          <Text variant="small" color="textSecondary">
            {node.label}
          </Text>
        </View>
      );
    case "Empty":
      return <EmptyState node={node} />;
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
      return <PlaceRow node={node} />;
    case "Notice":
      return (
        <View role="note" style={node.variant === "plain" ? styles.plainNotice : styles.notice}>
          {node.icon ? (
            <View aria-hidden>
              <Icon
                icon={UI_ICON[node.icon]}
                size={sizes.iconS}
                color={node.tone === "danger" || node.variant === "plain" ? "primary" : "textBody"}
                strokeWidth={2}
              />
            </View>
          ) : null}
          <Text
            variant={node.variant === "plain" ? "small" : "caption"}
            color={node.variant === "plain" ? "textSecondary" : "textBody"}
            style={styles.placeText}
          >
            {node.text}
          </Text>
        </View>
      );
    case "Meta":
      return <MetaLine items={node.items} />;
    case "Gallery":
      return <PluginGallery node={node} />;
    case "Menu":
      return <PluginMenu node={node} />;
    case "Tags":
      return <TagList items={node.items} />;
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

function PlaceRow({ node }: { node: Extract<UINode, { type: "Place" }> }) {
  const { onAction } = useContext(ActionsContext);
  const content = (
    <>
      <Icon icon={MapPin} size={sizes.iconS} color="primary" strokeWidth={2} />
      <Text variant="caption" style={styles.placeText}>
        {node.text}
      </Text>
      {node.action ? <Icon icon={ChevronRight} size={sizes.iconS} color="iconMuted" /> : null}
    </>
  );
  const action = node.action;
  return action ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={node.text}
      onPressIn={tapFeedback}
      onPress={() => onAction(action)}
      style={styles.placeRow}
    >
      {content}
    </Pressable>
  ) : (
    <View style={styles.placeRow}>{content}</View>
  );
}

/** A Stat's number: green for `success`, red for `danger`, ink otherwise. */
const STAT_COLOR: Record<Tone, ColorToken> = {
  neutral: "text",
  info: "text",
  warning: "text",
  success: "successText",
  danger: "primary",
};

/**
 * A dashboard widget. With `onPress` the dashboard makes the whole tile pressable (plugins/Dashboard.tsx); without a
 * `link` the chevron shows it. The header: an icon, the title and a subtitle, and the link (e.g. "12 aktywnych") on
 * the right.
 */
function WidgetTile({ node }: { node: Extract<UINode, { type: "Widget" }> }) {
  return (
    <Card style={styles.widget}>
      <View role="region" aria-label={node.title} style={styles.widgetBody}>
        <View style={styles.widgetHead}>
          {node.icon ? (
            <Icon icon={UI_ICON[node.icon]} size={sizes.widgetIcon} color="textBody" strokeWidth={1.9} />
          ) : null}
          <View style={styles.widgetHeadText}>
            <Heading level={2} variant="smallStrong" color="textSecondary" style={styles.shrink}>
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
}

/**
 * A list: separate cards (default), or one white group with the items as rows between hairlines (`grouped`). In a
 * widget the items are rows between hairlines either way.
 */
function PluginList({ node }: { node: Extract<UINode, { type: "List" }> }) {
  const inWidget = useContext(InWidgetContext);
  const grouped = !inWidget && node.variant === "grouped";
  const rows = inWidget || grouped;
  return (
    <View
      role="list"
      aria-label={node.label}
      style={grouped ? styles.group : inWidget ? styles.widgetList : styles.list}
    >
      <InGroupContext.Provider value={grouped}>
        {node.children.map((n, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: as in Children.
          <View key={i} role="listitem" style={rows && i > 0 ? styles.divider : undefined}>
            <PluginNode node={n} />
          </View>
        ))}
      </InGroupContext.Provider>
    </View>
  );
}

/**
 * A button: `ink` is the dark one. With `pressed` it is a toggle (a vote): pressed it is filled red, not pressed it is
 * outlined red, and its state is announced.
 */
function PluginButton({ node }: { node: Extract<UINode, { type: "Button" }> }) {
  const { onAction, busy, onLongPress } = useContext(ActionsContext);
  const inWidget = useContext(InWidgetContext);
  const variant: ButtonVariant = inWidget
    ? "dark"
    : node.pressed === undefined
      ? BUTTON_VARIANT[node.variant ?? "primary"]
      : node.pressed
        ? "primary"
        : "outline";
  const toggle = node.pressed === undefined ? {} : toggleA11y(node.pressed, { disabled: busy });
  // Widget actions keep their full height even when the content above them runs out of room.
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
      {...toggle}
    />
  );
}

/** The icon's colour on a button: white on the red and the dark buttons, red on the outlined one, ink on the others. */
const iconColor = (variant: ButtonVariant): ColorToken =>
  variant === "primary" || variant === "dark" ? "onPrimary" : variant === "outline" ? "primary" : "text";

/**
 * Nothing to show yet. On a screen: centred, an icon in a white box, the title (a heading) and the text. In a widget:
 * the title and the text centred in the rest of the tile, no icon.
 */
function EmptyState({ node }: { node: Extract<UINode, { type: "Empty" }> }) {
  const inWidget = useContext(InWidgetContext);
  if (inWidget) {
    return (
      <View style={styles.emptyWidget}>
        {node.title ? (
          <Text variant="rowTitle" style={styles.center}>
            {node.title}
          </Text>
        ) : null}
        <Text variant="caption" color="textSecondary" style={styles.center}>
          {node.text}
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.empty}>
      {node.icon ? (
        <View aria-hidden style={styles.emptyBox}>
          <Icon icon={UI_ICON[node.icon]} size={sizes.emptyBoxIcon} color="textBody" />
        </View>
      ) : null}
      {node.title ? (
        <Heading level={2} variant="cardTitleL" style={styles.center}>
          {node.title}
        </Heading>
      ) : null}
      <Text variant="bodyL" color="textSecondary" style={styles.center}>
        {node.text}
      </Text>
    </View>
  );
}

/**
 * Tabs that only navigate: a segmented track (sorting), a row of chips (filters) or big tiles with a count (states).
 * The plugin marks the selected one.
 */
function PluginTabs({ node }: { node: Extract<UINode, { type: "Tabs" }> }) {
  const { onAction } = useContext(ActionsContext);
  const selected = node.options.find((o) => o.selected)?.label ?? node.options[0]?.label ?? "";
  if (node.variant === "tiles") {
    return (
      <View role="tablist" aria-label={node.label} style={styles.rowGrow}>
        {node.options.map((o) => {
          const on = o.label === selected;
          return (
            <Pressable
              key={o.label}
              role="tab"
              aria-selected={on}
              accessibilityRole="tab"
              accessibilityLabel={o.count === undefined ? o.label : `${o.label}, ${o.count}`}
              accessibilityState={{ selected: on }}
              onPressIn={tapFeedback}
              onPress={() => onAction(o.action)}
              style={({ pressed }) => [styles.tile, on ? styles.tileOn : styles.tileOff, pressed && styles.pressed]}
            >
              {o.count === undefined ? null : (
                <Text variant="headingM" color={on ? "surface" : "text"}>
                  {o.count}
                </Text>
              )}
              <Text variant="smallStrong" color={on ? "surface" : "text"}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }
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
            <Text variant="smallStrong">{i > 0 && item.at ? `${item.title} · ${item.at}` : item.title}</Text>
            {i === 0 && item.at ? (
              <Text variant="small" color="textSecondary">
                {item.at}
              </Text>
            ) : null}
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

/**
 * Shares a link to a place in the app through the system share sheet: a square icon button ("Udostępnij" beside a
 * vote), or a full-width button with the label (`button`, "Udostępnij sąsiadom").
 */
function ShareButton({ node }: { node: Extract<UINode, { type: "Share" }> }) {
  if (node.variant === "button") {
    return (
      <Button
        label={node.label}
        leftIcon={<Icon icon={Share2} size={sizes.iconS} color="onPrimary" strokeWidth={2} />}
        onPress={() => shareLink(node.path)}
      />
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={node.label}
      onPressIn={tapFeedback}
      onPress={() => shareLink(node.path)}
      style={({ pressed }) => [styles.squareButton, styles.squareOutline, pressed && styles.pressed]}
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
      style={({ pressed }) => [styles.fab, { bottom: insets.bottom + spacing[12] }, pressed && styles.pressed]}
    >
      {node.icon ? <Icon icon={UI_ICON[node.icon]} size={sizes.iconM} color="onPrimary" strokeWidth={2} /> : null}
      <Text variant="button" color="onPrimary">
        {node.label}
      </Text>
    </Pressable>
  );
}

/** The widget header's link ("Wszystkie", "12 aktywnych" with the count in bold) and a chevron; the tile opens it too. */
function WidgetLinkButton({ link }: { link: WidgetLink }) {
  const { onAction } = useContext(ActionsContext);
  const name = link.count === undefined ? link.label : `${link.count} ${link.label}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={name}
      hitSlop={spacing[5]}
      onPress={() => onAction(link.action)}
      style={({ pressed }) => [styles.widgetLink, pressed && styles.pressed]}
    >
      <Text variant="buttonS" color="text">
        {link.count === undefined ? null : <Text variant="buttonS" style={styles.strong}>{`${link.count} `}</Text>}
        {link.label}
      </Text>
      <Icon icon={ChevronRight} size={sizes.iconXs} color="iconMuted" strokeWidth={2.2} />
    </Pressable>
  );
}

/**
 * @deprecated node (see packages/sdk/src/ui.ts): the widget's highlighted item: a thumbnail, an eyebrow, the title and
 * the votes with an up arrow. Tapping opens it.
 */
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
      style={({ pressed }) => (pressed ? styles.pressed : undefined)}
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
        <View style={[styles.activityText, !inWidget && styles.commentBubble]}>
          <View style={[styles.activityLine, styles.activityHead]}>
            <Text
              variant={inWidget ? "cardTitle" : "smallStrong"}
              numberOfLines={inWidget ? 1 : undefined}
              style={styles.activityGrow}
            >
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
                variant="caption"
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
  const content = body;
  const onPress = node.onPress;
  if (!onPress) return content;
  const label = [node.title, node.unread ? t.plugin_activity_new : null, node.text, time].filter(Boolean).join(", ");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => onAction(onPress)}
      onLongPress={onLongPress}
      style={({ pressed }) => (pressed ? styles.pressed : undefined)}
    >
      {content}
    </Pressable>
  );
}

/** Children share the row's width equally (`grow`), e.g. two buttons or two stats side by side. */
function GrowRow({ nodes }: { nodes: UINode[] }) {
  return (
    <View style={styles.rowGrow}>
      {nodes.map((n, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: as in Children, the order is the identity.
        <View key={`${n.type}-${i}`} style={n.type === "Share" && n.variant !== "button" ? undefined : styles.growCell}>
          <PluginNode node={n} />
        </View>
      ))}
    </View>
  );
}

function PluginForm({ node }: { node: Extract<UINode, { type: "Form" }> }) {
  const { onAction, busy } = useContext(ActionsContext);
  const confirmed = initialValues(node.children);
  const [state, setState] = useState(() => ({ confirmed, values: confirmed }));
  if (JSON.stringify(state.confirmed) !== JSON.stringify(confirmed)) {
    setState({ confirmed, values: syncFormValues(state.values, state.confirmed, confirmed) });
  }
  const submit: ToolAction = { ...node.submit, args: { ...node.submit.args, ...state.values } };
  const send = () => onAction(submit, { onSuccess: () => setState((s) => ({ ...s, values: s.confirmed })) });
  return (
    <FormContext.Provider
      value={{
        values: state.values,
        set: (k, v) =>
          setState((s) => {
            const { [k]: _, ...rest } = s.values;
            return { ...s, values: v === undefined ? rest : { ...rest, [k]: v } };
          }),
      }}
    >
      {node.inline ? (
        <View style={styles.composer}>
          <View style={styles.composerField}>
            <InlineFormContext.Provider value={true}>
              <Children nodes={node.children} />
            </InlineFormContext.Provider>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={node.submitLabel}
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPressIn={tapFeedback}
            onPress={send}
            style={({ pressed }) => [
              styles.sendButton,
              styles.squarePrimary,
              pressed && styles.pressed,
              busy && styles.disabled,
            ]}
          >
            <Icon icon={Send} size={sizes.iconS} color="onPrimary" strokeWidth={2} />
          </Pressable>
        </View>
      ) : (
        <View style={styles.stack}>
          <Children nodes={node.children} />
          <Button
            label={node.submitLabel}
            leftIcon={
              node.submitIcon ? (
                <Icon icon={UI_ICON[node.submitIcon]} size={sizes.iconM} color="onPrimary" />
              ) : undefined
            }
            disabled={busy}
            onPress={send}
          />
        </View>
      )}
    </FormContext.Provider>
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

/** The confirmation at the top of a view: a check mark, a title and an optional text (design: sent report). */
function Hero({ node }: { node: Extract<UINode, { type: "Hero" }> }) {
  return (
    <View style={styles.hero}>
      <SuccessMark large />
      <Heading level={2} variant="heading" style={styles.heroTitle}>
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

const styles = StyleSheet.create({
  pressed: { opacity: opacity.pressed },
  disabled: { opacity: opacity.disabled },
  shrink: { flexShrink: 1 },
  center: { textAlign: "center" },
  strong: { fontFamily: fontFamily.bold },
  stack: { gap: spacing[9] },
  screen: { flexGrow: 1, gap: spacing[9] },
  confirmation: { gap: spacing[5] },
  stackTight: { gap: spacing[2] },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing[4] },
  hero: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing[8], paddingVertical: spacing[12] },
  heroTitle: { textAlign: "center", maxWidth: sizes.heroTitleWidth, marginTop: spacing[6] },
  heroText: { textAlign: "center", maxWidth: sizes.heroTextWidth },
  /** Fills the dashboard tile (fixed size from the plugin); content beyond it is clipped. */
  widget: { flex: 1, overflow: "hidden", paddingHorizontal: spacing[8], paddingVertical: spacing[7], ...shadows.card },
  widgetBody: { flex: 1, minHeight: 0, gap: spacing[3] },
  widgetHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[4],
    flexShrink: 0,
  },
  widgetHeadText: { flex: 1, minWidth: 0, gap: spacing[1] },
  widgetList: { flexShrink: 1, minHeight: 0, overflow: "hidden" },
  widgetButton: { paddingHorizontal: spacing[4], height: sizes.widgetButton, flexShrink: 0, marginTop: "auto" },
  widgetLink: { flexDirection: "row", alignItems: "center", gap: spacing[1] },
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
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing[5],
    padding: spacing[8],
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  plainNotice: { flexDirection: "row", alignItems: "flex-start", gap: spacing[4] },
  stat: {
    gap: spacing[1],
    paddingVertical: spacing[6],
    paddingHorizontal: spacing[7],
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing[6],
    paddingVertical: spacing[9],
    paddingHorizontal: spacing[6],
  },
  emptyWidget: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing[1] },
  emptyBox: {
    width: sizes.emptyBox,
    height: sizes.emptyBox,
    borderRadius: radii["3xl"],
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.card,
  },
  tile: {
    flex: 1,
    height: sizes.tabTile,
    justifyContent: "center",
    paddingHorizontal: spacing[7],
    borderRadius: radii.xl,
  },
  tileOn: { backgroundColor: colors.text },
  tileOff: { backgroundColor: colors.surface, ...shadows.card },
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
    ...shadows.redGlow,
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
  sendButton: {
    width: sizes.iconButton,
    height: sizes.iconButton,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
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
    width: sizes.commentAvatar,
    height: sizes.commentAvatar,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarNew: { backgroundColor: colors.primaryTint },
  activityText: { flex: 1, minWidth: 0, gap: spacing[1] },
  commentBubble: { padding: spacing[6], borderRadius: radii.xl, backgroundColor: colors.surface, ...shadows.card },
  activityLine: { flexDirection: "row", alignItems: "center", gap: spacing[4] },
  activityHead: { alignItems: "flex-start" },
  activityGrow: { flex: 1, minWidth: 0 },
  newDot: { width: spacing[4], height: spacing[4], borderRadius: radii.pill, backgroundColor: colors.primary },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[4],
  },
  list: { gap: spacing[5] },
  group: { borderRadius: radii["2xl"], backgroundColor: colors.surface, ...shadows.card },
  divider: { borderTopWidth: borders.hairline, borderTopColor: colors.divider },
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
});
