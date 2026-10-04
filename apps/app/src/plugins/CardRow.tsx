import type { CardCounter, CardImage, UINode } from "@app/plugin-sdk";
import { ArrowUp, Camera, ChevronRight } from "lucide-react-native";
import { type ReactNode, useContext } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { Badge, Card, Heading, Icon, IconBox, Text } from "../components";
import { toggleA11y } from "../lib/a11y";
import { tapFeedback } from "../lib/haptics";
import { t } from "../texts";
import { borders, type ColorToken, colors, opacity, radii, shadows, sizes, spacing } from "../theme";
import { ActionsContext, InGroupContext, InWidgetContext } from "./context";
import { UI_ICON } from "./icons";
import { MetaLine, metaText } from "./MetaLine";
import { TagList } from "./Tags";
import { toBadgeTone } from "./tone";

type CardNode = Extract<UINode, { type: "Card" }>;

/**
 * A plugin's Card, laid out by where it is: in a dashboard widget one compact row; in a grouped list a row of the
 * group (unread dot, a small thumbnail or an icon box, a count badge or a plain count, a chevron); on a screen a card
 * with a thumbnail, the title, the meta line and the counter pill (design Z-Lista) — or, with none of those, the plain
 * card of text. `children` are the card's own nodes, rendered by the caller.
 */
export function CardRow({
  node,
  children,
  headerContent,
}: {
  node: CardNode;
  children: ReactNode;
  headerContent?: ReactNode;
}) {
  const inWidget = useContext(InWidgetContext);
  const inGroup = useContext(InGroupContext);
  const style = inWidget ? "short" : "long";
  const label = [node.unread ? t.plugin_activity_new : null, node.title, node.subtitle]
    .concat((node.meta ?? []).map((item) => metaText(item, new Date(), style)))
    .filter(Boolean)
    .join(", ");
  const body = inWidget ? (
    <WidgetRow node={node}>{children}</WidgetRow>
  ) : inGroup ? (
    <GroupRow node={node}>{children}</GroupRow>
  ) : isRich(node) ? (
    <ListCard node={node} headerContent={headerContent}>
      {children}
    </ListCard>
  ) : (
    <PlainCard node={node}>{children}</PlainCard>
  );
  return (
    <Pressed node={node} label={label}>
      {body}
    </Pressed>
  );
}

/** A card with a photo, an icon, a meta line, a counter, a count, tags or an unread mark (else the plain card). */
const isRich = (node: CardNode) =>
  Boolean(node.image || node.icon || node.meta || node.counter || node.count !== undefined || node.tags || node.unread);

/** The whole card runs its `onPress`; its name is the title with the meta line (and "Nowe" when unread). */
function Pressed({ node, label, children }: { node: CardNode; label: string; children: ReactNode }) {
  const { onAction, onLongPress } = useContext(ActionsContext);
  const onPress = node.onPress;
  if (!onPress) return children;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => onAction(onPress)}
      onLongPress={onLongPress}
      style={({ pressed }) => (pressed ? styles.pressed : undefined)}
    >
      {children}
    </Pressable>
  );
}

/** The plain card of text (an announcement, a note): the title, a badge, the subtitle and its nodes. */
function PlainCard({ node, children }: { node: CardNode; children: ReactNode }) {
  return (
    <Card>
      <View style={styles.cardHead}>
        <Heading level={3} style={styles.shrink}>
          {node.title}
        </Heading>
        {node.badge ? <Badge text={node.badge.text} tone={toBadgeTone(node.badge.tone)} /> : null}
      </View>
      {node.subtitle ? (
        <Text variant="caption" color="textSecondary">
          {node.subtitle}
        </Text>
      ) : null}
      {children}
    </Card>
  );
}

/** A card in a list (design Z-Lista): the thumbnail at the left, the title over the meta line and the counter. */
function ListCard({
  node,
  children,
  headerContent,
}: {
  node: CardNode;
  children: ReactNode;
  headerContent?: ReactNode;
}) {
  return (
    <View style={styles.listCard}>
      <View style={styles.listRow}>
        <Leading node={node} small={false} />
        <View style={styles.listBody}>
          {node.tags?.length || node.badge ? (
            <View style={styles.tagsRow}>
              {node.badge ? <Badge text={node.badge.text} tone={toBadgeTone(node.badge.tone)} /> : null}
              {node.tags?.length ? <TagList items={node.tags} /> : null}
            </View>
          ) : null}
          <View style={styles.titleRow}>
            {node.unread ? <View style={styles.unreadDot} /> : null}
            <Text
              variant={node.variant === "featured" ? "cardTitleL" : "rowTitle"}
              numberOfLines={2}
              style={styles.shrink}
            >
              {node.title}
            </Text>
          </View>
          {node.subtitle ? (
            <Text variant="small" color="textSecondary">
              {node.subtitle}
            </Text>
          ) : null}
          <View style={styles.listFoot}>
            <View style={styles.shrink}>{node.meta ? <MetaLine items={node.meta} /> : null}</View>
            {node.counter ? <Counter counter={node.counter} color="primary" stacked={false} /> : null}
            {node.count !== undefined && node.count > 0 ? <CountBadge count={node.count} /> : null}
          </View>
          {headerContent}
        </View>
        {node.variant === "compact" && node.onPress ? (
          <Icon icon={ChevronRight} size={sizes.iconS} color="iconMuted" />
        ) : null}
      </View>
      {children}
    </View>
  );
}

/**
 * A row of a grouped list (designs Z-AdminPanel, Z-StronaPluginu): an unread dot column (when the plugin says read or
 * unread), a small thumbnail or an icon box, the title over the subtitle and meta, then a plain count, a count badge
 * and a chevron when it opens a view.
 */
function GroupRow({ node, children }: { node: CardNode; children: ReactNode }) {
  const opens = node.onPress?.type === "navigate";
  return (
    <View style={styles.groupRow}>
      {node.unread !== undefined ? (
        <View style={styles.dotColumn}>{node.unread ? <View style={styles.unreadDot} /> : null}</View>
      ) : null}
      <Leading node={node} small />
      <View style={styles.groupBody}>
        {node.tags?.length ? <TagList items={node.tags} /> : null}
        <Text variant="rowTitle" numberOfLines={2}>
          {node.title}
        </Text>
        {node.subtitle ? (
          <Text variant="small" color="textSecondary">
            {node.subtitle}
          </Text>
        ) : null}
        {node.meta ? <MetaLine items={node.meta} /> : null}
        {children}
      </View>
      {node.badge ? <Badge text={node.badge.text} tone={toBadgeTone(node.badge.tone)} /> : null}
      {node.counter ? <Counter counter={node.counter} color="text" stacked /> : null}
      {node.count !== undefined && node.count > 0 ? <CountBadge count={node.count} /> : null}
      {opens && !node.counter ? (
        <Icon icon={ChevronRight} size={sizes.iconS} color="iconMuted" strokeWidth={2} />
      ) : null}
    </View>
  );
}

/** A card inside a widget: one row (title on one line, subtitle, meta), the badge or the plain count at the right. */
function WidgetRow({ node, children }: { node: CardNode; children: ReactNode }) {
  return (
    <View style={styles.widgetRow}>
      <View style={styles.widgetText}>
        <Text variant="link" numberOfLines={1}>
          {node.title}
        </Text>
        {node.subtitle ? (
          <Text variant="caption" color="textSecondary" numberOfLines={1}>
            {node.subtitle}
          </Text>
        ) : null}
        {node.meta ? <MetaLine items={node.meta} /> : null}
        {children}
      </View>
      {node.badge ? <Badge text={node.badge.text} tone={toBadgeTone(node.badge.tone)} /> : null}
      {node.counter ? <Counter counter={node.counter} color="primary" stacked={false} /> : null}
      {node.count !== undefined && node.count > 0 ? <CountBadge count={node.count} /> : null}
    </View>
  );
}

/** A card's thumbnail, else its icon in a box (dark when the row has a count to look at), else nothing. */
function Leading({ node, small }: { node: CardNode; small: boolean }) {
  if (node.image) return <Thumbnail image={node.image} small={small} variant={node.variant} />;
  if (!node.icon) return null;
  const attention = (node.count ?? 0) > 0;
  return <IconBox icon={UI_ICON[node.icon]} size="sm" neutral={!attention} dark={attention} />;
}

/** A photo with "+N" in its corner when the card has more photos. Without a signed URL, the placeholder colour. */
function Thumbnail({ image, small, variant }: { image: CardImage; small: boolean; variant?: CardNode["variant"] }) {
  const more = image.more ?? 0;
  return (
    <View
      role="img"
      aria-label={image.alt}
      style={[
        styles.thumb,
        small
          ? styles.thumbSmall
          : variant === "featured"
            ? styles.thumbFeatured
            : variant === "compact"
              ? styles.thumbCompact
              : styles.thumbLarge,
      ]}
    >
      {image.url ? <Image source={{ uri: image.url }} style={styles.fill} resizeMode="cover" /> : null}
      {more > 0 ? (
        <View accessible accessibilityLabel={`${t.plugin_photos_more}: ${more}`} style={styles.more}>
          <Icon icon={Camera} size={sizes.iconXs} color="onPrimary" strokeWidth={2.4} />
          <Text variant="tag" color="onPrimary">{`+${more}`}</Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * A card's counter (votes). With an action: a toggle pill (pressed = filled red), announced as pressed or not. With
 * `pressed` but no action: the same pill, shown as it is. Without either: a plain count, an arrow and the number
 * (`stacked`: the arrow over the number, in a grouped row).
 */
function Counter({ counter, color, stacked }: { counter: CardCounter; color: ColorToken; stacked: boolean }) {
  const { onAction, busy } = useContext(ActionsContext);
  const action = counter.action;
  if (counter.pressed === undefined && !action) {
    return (
      <View accessible accessibilityLabel={counter.label} style={stacked ? styles.countStacked : styles.countInline}>
        <Icon icon={ArrowUp} size={sizes.iconXs} color="primary" strokeWidth={2.6} />
        <Text variant="buttonS" color={color}>
          {counter.value}
        </Text>
      </View>
    );
  }
  const pressed = counter.pressed ?? false;
  const ink = pressed ? "onPrimary" : "primary";
  const content = (
    <>
      <Icon icon={ArrowUp} size={sizes.iconXs} color={ink} strokeWidth={2.6} />
      <Text variant="buttonS" color={ink}>
        {counter.value}
      </Text>
    </>
  );
  if (!action) {
    return (
      <View
        accessible
        accessibilityLabel={counter.label}
        style={[styles.pill, pressed ? styles.pillOn : styles.pillOff]}
      >
        {content}
      </View>
    );
  }
  return (
    <Pressable
      {...toggleA11y(pressed, { disabled: busy })}
      accessibilityLabel={counter.label}
      disabled={busy}
      hitSlop={spacing[3]}
      onPressIn={tapFeedback}
      onPress={() => onAction(action)}
      style={({ pressed: down }) => [styles.pill, pressed ? styles.pillOn : styles.pillOff, down && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

/** A red number at the right of a row (unread, pending). Read as part of the row's own texts, so hidden here. */
function CountBadge({ count }: { count: number }) {
  return (
    <View aria-hidden style={styles.countBadge}>
      <Text variant="tag" color="onPrimary">
        {count}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: opacity.pressed },
  shrink: { flexShrink: 1, minWidth: 0 },
  fill: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  cardHead: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[4],
  },
  listCard: {
    gap: spacing[6],
    padding: spacing[6],
    borderRadius: radii["2xl"],
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  listRow: { flexDirection: "row", gap: spacing[6] },
  listBody: { flex: 1, minWidth: 0, gap: spacing[3] },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing[2] },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing[3] },
  listFoot: {
    marginTop: "auto",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[4],
  },
  groupRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[5],
    paddingVertical: spacing[7],
    paddingLeft: spacing[6],
    paddingRight: spacing[8],
  },
  groupBody: { flex: 1, minWidth: 0, gap: spacing[2] },
  dotColumn: { width: sizes.unreadDot, alignItems: "center" },
  unreadDot: {
    width: sizes.unreadDot,
    height: sizes.unreadDot,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  widgetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[5],
    minHeight: sizes.widgetRowLine,
    paddingVertical: spacing[3],
  },
  widgetText: { flex: 1, minWidth: 0, gap: spacing[1] },
  thumb: { borderRadius: radii.md, overflow: "hidden", backgroundColor: colors.mapBase, flexShrink: 0 },
  thumbLarge: { width: sizes.cardThumb, height: sizes.cardThumb },
  thumbSmall: { width: sizes.cardThumbSm, height: sizes.cardThumbSm },
  thumbFeatured: { width: sizes.cardThumbFeatured, height: sizes.cardThumbFeatured },
  thumbCompact: { width: sizes.cardThumbCompact, height: sizes.cardThumbCompact },
  more: {
    position: "absolute",
    right: spacing[2],
    bottom: spacing[2],
    height: sizes.photoMore,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[1],
    paddingHorizontal: spacing[3],
    borderRadius: radii.pill,
    backgroundColor: colors.photoOverlay,
  },
  countInline: { flexDirection: "row", alignItems: "center", gap: spacing[1], flexShrink: 0 },
  countStacked: { alignItems: "center", flexShrink: 0 },
  pill: {
    height: sizes.votePill,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[1],
    paddingLeft: spacing[4],
    paddingRight: spacing[5],
    borderRadius: radii.pill,
    flexShrink: 0,
  },
  pillOn: { backgroundColor: colors.primary },
  pillOff: { backgroundColor: colors.surface, borderWidth: borders.hairline, borderColor: colors.border },
  countBadge: {
    minWidth: sizes.countBadge,
    height: sizes.countBadge,
    paddingHorizontal: spacing[3],
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    flexShrink: 0,
  },
});
