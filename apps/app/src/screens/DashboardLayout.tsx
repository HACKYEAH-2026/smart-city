import { type DashboardWidgetSize, sameSize } from "@app/plugin-sdk";
import type { DashboardLayout as Layout, LayoutWidget } from "@app/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import Head from "expo-router/head";
import { ChevronDown, ChevronUp, Plus, Puzzle, X } from "lucide-react-native";
import { type ReactNode, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomSheet, Button, Icon, IconButton, NoticeScreen, Screen, Text, TitleHeader } from "../components";
import { useCommunity, useDashboardLayout, useSaveDashboardLayout } from "../data/communities";
import { gridRects } from "../lib/grid";
import { tapFeedback } from "../lib/haptics";
import {
  addWidget,
  byPlugin,
  type LayoutDraft,
  layoutInput,
  moveWidget,
  reconcileDraft,
  removeWidget,
  resizeWidget,
  sizeLabel,
} from "../lib/layoutDraft";
import { goBack } from "../lib/navigation";
import { t } from "../texts";
import { borders, colors, layout, opacity, radii, shadows, sizes, spacing } from "../theme";

/**
 * The dashboard layout editor (design E-UkladPulpitu; Zarządzaj miejscem → Układ pulpitu → "Edytuj układ pulpitu"), for
 * a place's admins: the dashboard's grid with every widget on it. Tapping a widget selects it and opens a panel to
 * pick one of the sizes its plugin allows, move it earlier or later, or remove it; "Dodaj widżet" puts a removed one
 * back. Every change stays a draft until "Zapisz" saves it for everyone; leaving without saving drops it.
 */
export default function DashboardLayout() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const place = useCommunity(slug);
  const back = () => goBack(router, `/app/c/${slug}/manage`);
  const header = <TitleHeader eyebrow={place.data?.name ?? ""} title={t.manage_layout_title} onBack={back} />;

  if (place.isPending) return <NoticeScreen header={header} text={t.loading} />;
  if (!place.data) return <NoticeScreen header={header} text={t.manage_load_error} alert />;
  if (place.data.role !== "admin") return <NoticeScreen header={header} text={t.manage_admins_only} />;
  return <LoadLayout slug={slug} header={header} onSaved={back} />;
}

type EditorProps = { slug: string; header: ReactNode; onSaved: () => void };

/** The editor starts only from the layout fetched after it opened: a cached copy may be out of date. */
function LoadLayout(props: EditorProps) {
  const query = useDashboardLayout(props.slug);
  const [openedAt] = useState(Date.now);
  // Once fresh, always fresh (dataUpdatedAt only grows): a failed refetch later never takes the draft away.
  const fresh = query.data && query.dataUpdatedAt >= openedAt ? query.data : null;
  if (fresh) return <Editor {...props} latest={fresh} />;
  if (query.isError) return <NoticeScreen header={props.header} text={t.manage_load_error} alert />;
  return <NoticeScreen header={props.header} text={t.loading} />;
}

function Editor({ slug, header, onSaved, latest }: EditorProps & { latest: Layout }) {
  const save = useSaveDashboardLayout(slug);
  const locked = save.isPending;
  // The admin's draft starts from the layout once. Later refetches (e.g. a plugin switched on through "Więcej
  // widżetów") only add the widgets the draft does not know and drop the ones gone (reconcileDraft), never undo edits.
  const [edited, setEdited] = useState<LayoutDraft>({ widgets: latest.widgets, available: latest.available });
  const draft = reconcileDraft(edited, latest);
  const change = (edit: (draft: LayoutDraft) => LayoutDraft) => setEdited(edit(draft));
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  // The panel covers the bottom of the screen: the content gets as much room below it to scroll out from under it.
  const [panelHeight, setPanelHeight] = useState(0);
  const index = draft.widgets.findIndex((w) => w.key === selected);
  const current = draft.widgets[index];
  const add = (key: string) => {
    change((d) => addWidget(d, key));
    setAdding(false);
    setSelected(key);
  };
  const openAdd = () => {
    setSelected(null);
    setAdding(true);
  };

  const panel = current ? (
    <WidgetPanel
      widget={current}
      first={index === 0}
      last={index === draft.widgets.length - 1}
      locked={locked}
      onSize={(size) => change((d) => resizeWidget(d, current.key, size))}
      onMove={(by) => change((d) => moveWidget(d, current.key, by))}
      onRemove={() => {
        change((d) => removeWidget(d, current.key));
        setSelected(null);
      }}
      onClose={() => setSelected(null)}
      onHeight={setPanelHeight}
    />
  ) : null;
  const sheet = (
    <AddSheet visible={adding} slug={slug} available={draft.available} onAdd={add} onClose={() => setAdding(false)} />
  );

  return (
    <Screen
      chrome={false}
      overlay={
        <>
          {panel}
          {sheet}
        </>
      }
    >
      <Head>
        <title>{t.manage_layout_title}</title>
      </Head>
      <View style={styles.body}>
        <View style={styles.top}>
          <View style={styles.headerRow}>
            <View style={styles.headerTitle}>{header}</View>
            <Button
              label={t.manage_layout_save}
              variant="dark"
              size="xs"
              fullWidth={false}
              style={styles.save}
              disabled={locked}
              onPress={() => save.mutate(layoutInput(draft), { onSuccess: onSaved })}
            />
          </View>
          <Text variant="small" color="textSecondary">
            {t.manage_layout_hint}
          </Text>
          {save.isError ? (
            <Text variant="bodyL" color="primaryPressed" role="alert">
              {t.manage_layout_save_error}
            </Text>
          ) : null}
        </View>
        <EditorGrid
          widgets={draft.widgets}
          columns={latest.columns}
          selected={selected}
          locked={locked}
          onPick={(key) => setSelected(key === selected ? null : key)}
          onAdd={openAdd}
        />
        {/* Room to scroll the last tiles and "Dodaj widżet" out from under the panel while it is open. */}
        {current ? <View style={{ height: panelHeight }} /> : null}
      </View>
    </Screen>
  );
}

type GridProps = {
  widgets: LayoutWidget[];
  columns: number;
  selected: string | null;
  /** While the layout is being saved: nothing can change. */
  locked: boolean;
  onPick: (key: string) => void;
  onAdd: () => void;
};

/** The dashboard's grid as it will look (the same placement as the dashboard), then the "Dodaj widżet" tile. */
function EditorGrid({ widgets, columns, selected, locked, onPick, onAdd }: GridProps) {
  const [width, setWidth] = useState(0);
  const grid = gridRects(widgets, { width, columns, rowHeight: sizes.layoutRow, gap: spacing[5] });
  return (
    <View style={styles.grid}>
      {widgets.length ? (
        <View
          role="list"
          aria-label={t.manage_layout_title}
          style={{ height: grid.height }}
          onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        >
          {width
            ? grid.tiles.map(({ item, rect }) => (
                <View key={item.key} role="listitem" style={[styles.slot, rect]}>
                  <Tile
                    widget={item}
                    selected={item.key === selected}
                    disabled={locked}
                    onPress={() => onPick(item.key)}
                  />
                </View>
              ))
            : null}
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.manage_layout_add}
        accessibilityState={{ disabled: locked }}
        disabled={locked}
        onPressIn={tapFeedback}
        onPress={onAdd}
        style={({ pressed }) => [styles.addTile, pressed && styles.pressed, locked && styles.disabled]}
      >
        <Icon icon={Plus} size={sizes.iconS} color="primary" strokeWidth={2.4} />
        <Text variant="buttonS" color="primary">
          {t.manage_layout_add}
        </Text>
      </Pressable>
    </View>
  );
}

/** A widget on the grid: its plugin's icon and its name, its size at the bottom. Selected: red frame and badge. */
type TileProps = { widget: LayoutWidget; selected: boolean; disabled: boolean; onPress: () => void };

function Tile({ widget, selected, disabled, onPress }: TileProps) {
  return (
    <Pressable
      accessibilityRole="button"
      aria-pressed={selected}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPressIn={tapFeedback}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        selected ? styles.tileSelected : styles.tileIdle,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.tileHead}>
        <Text variant="tileTitle" aria-hidden>
          {widget.pluginIcon}
        </Text>
        <Text variant="tileTitle" color="textSecondary" numberOfLines={2} style={styles.tileName}>
          {widget.title}
        </Text>
      </View>
      <View style={[styles.badge, selected && styles.badgeSelected]}>
        <Text variant="label" color={selected ? "onPrimary" : "textBody"}>
          {sizeLabel(widget.size)}
        </Text>
      </View>
    </Pressable>
  );
}

type PanelProps = {
  widget: LayoutWidget;
  first: boolean;
  last: boolean;
  locked: boolean;
  onSize: (size: DashboardWidgetSize) => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
  onClose: () => void;
  onHeight: (height: number) => void;
};

/** The selected widget's panel at the bottom of the screen (not modal: the grid above stays usable). */
function WidgetPanel({ widget, first, last, locked, onSize, onMove, onRemove, onClose, onHeight }: PanelProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[styles.panel, { paddingBottom: insets.bottom + spacing[12] }]}
      onLayout={(e) => onHeight(e.nativeEvent.layout.height)}
    >
      <View style={styles.panelContent}>
        <View style={styles.panelHead}>
          <View style={styles.panelTitle}>
            <Text variant="cardTitle">{widget.title}</Text>
            <Text variant="small" color="textSecondary">
              {widget.pluginName}
            </Text>
          </View>
          <IconButton icon={X} label={t.close} variant="roundSunken" onPress={onClose} />
        </View>
        <View style={styles.sizesBlock}>
          <Text variant="label" color="textSecondary">
            {t.manage_layout_size}
          </Text>
          <View role="radiogroup" aria-label={t.manage_layout_size_group} style={styles.sizes}>
            {widget.sizes.map((size) => (
              <SizeOption
                key={sizeLabel(size)}
                size={size}
                checked={sameSize(size, widget.size)}
                disabled={locked}
                onPress={() => onSize(size)}
              />
            ))}
          </View>
          <Text variant="small" color="textSecondary">
            {t.manage_layout_size_hint}
          </Text>
        </View>
        <View style={styles.actions}>
          <View style={styles.action}>
            <Button
              label={t.manage_layout_up}
              variant="secondary"
              size="sm"
              leftIcon={<Icon icon={ChevronUp} size={sizes.iconS} strokeWidth={2.4} />}
              disabled={first || locked}
              onPress={() => onMove(-1)}
            />
          </View>
          <View style={styles.action}>
            <Button
              label={t.manage_layout_down}
              variant="secondary"
              size="sm"
              leftIcon={<Icon icon={ChevronDown} size={sizes.iconS} strokeWidth={2.4} />}
              disabled={last || locked}
              onPress={() => onMove(1)}
            />
          </View>
          <View style={styles.action}>
            <Button label={t.manage_layout_remove} variant="accent" size="sm" disabled={locked} onPress={onRemove} />
          </View>
        </View>
      </View>
    </View>
  );
}

/** One size a widget may take: its outline (a cell is `layoutSizeUnit` square) and "3 × 2". */
type SizeOptionProps = { size: DashboardWidgetSize; checked: boolean; disabled: boolean; onPress: () => void };

function SizeOption({ size, checked, disabled, onPress }: SizeOptionProps) {
  const label = sizeLabel(size);
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      aria-checked={checked}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPressIn={tapFeedback}
      onPress={onPress}
      style={({ pressed }) => [
        styles.size,
        checked ? styles.sizeChecked : styles.sizeIdle,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <View
        style={[
          styles.sizeIcon,
          { width: size.w * sizes.layoutSizeUnit, height: size.h * sizes.layoutSizeUnit },
          { borderColor: checked ? colors.onPrimary : colors.text },
        ]}
      />
      <Text variant="buttonM" color={checked ? "onPrimary" : "text"}>
        {label}
      </Text>
    </Pressable>
  );
}

/** The 38 dp "Dodaj" pill reaches the 44 dp touch target above and below. */
const PILL_HIT_SLOP = {
  top: (layout.minTouchTarget - sizes.pillButton) / 2,
  bottom: (layout.minTouchTarget - sizes.pillButton) / 2,
};

type AddSheetProps = {
  visible: boolean;
  slug: string;
  available: LayoutWidget[];
  onAdd: (key: string) => void;
  onClose: () => void;
};

/** "Dodaj widżet": the widgets of the place's plugins that are off the dashboard, by plugin; more come with plugins. */
function AddSheet({ visible, slug, available, onAdd, onClose }: AddSheetProps) {
  const groups = byPlugin(available);
  return (
    <BottomSheet visible={visible} title={t.manage_layout_add} onClose={onClose}>
      {groups.length ? (
        groups.map((group) => (
          <View key={group.pluginId} style={styles.group}>
            <View style={styles.groupHead}>
              <Text variant="smallStrong" aria-hidden>
                {group.pluginIcon}
              </Text>
              <Text variant="smallStrong" color="textSecondary">
                {group.pluginName}
              </Text>
            </View>
            <View role="list" aria-label={group.pluginName} style={styles.groupCard}>
              {group.widgets.map((widget, i) => (
                <View
                  key={widget.key}
                  role="listitem"
                  style={[styles.addRow, i < group.widgets.length - 1 && styles.addRowDivider]}
                >
                  <View style={styles.addRowText}>
                    <Text variant="rowTitle">{widget.title}</Text>
                    <Text variant="small" color="textSecondary">
                      {`${t.manage_layout_sizes} ${widget.sizes.map((size) => sizeLabel(size, true)).join(", ")}`}
                    </Text>
                  </View>
                  <Button
                    label={t.manage_layout_add_one}
                    accessibilityLabel={`${t.manage_layout_add_one}: ${widget.title}`}
                    size="xs"
                    fullWidth={false}
                    style={styles.addPill}
                    hitSlop={PILL_HIT_SLOP}
                    onPress={() => onAdd(widget.key)}
                  />
                </View>
              ))}
            </View>
          </View>
        ))
      ) : (
        <Text variant="bodyL" color="textSecondary">
          {t.manage_layout_add_none}
        </Text>
      )}
      <Button
        label={t.manage_layout_more}
        variant="ghost"
        size="sm"
        leftIcon={<Icon icon={Puzzle} size={sizes.iconS} />}
        href={`/app/c/${slug}/add-plugin`}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing[8] },
  top: { gap: spacing[5] },
  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing[7] },
  headerTitle: { flex: 1 },
  save: { height: sizes.iconButton, borderRadius: radii.pill, paddingHorizontal: spacing[8] },
  pressed: { opacity: opacity.pressed },
  disabled: { opacity: opacity.disabled },
  grid: {
    gap: spacing[5],
    padding: spacing[5],
    borderRadius: radii["4xl"],
    backgroundColor: colors.surfaceSunken,
  },
  slot: { position: "absolute" },
  tile: {
    flex: 1,
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: spacing[5],
    paddingHorizontal: spacing[6],
    borderRadius: radii.xl,
    borderWidth: borders.selected,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  tileIdle: { borderColor: "transparent", ...shadows.card },
  tileSelected: { borderColor: colors.primary, ...shadows.selected },
  tileHead: { flexDirection: "row", alignItems: "flex-start", gap: spacing[3], alignSelf: "stretch" },
  tileName: { flex: 1 },
  badge: {
    paddingVertical: spacing[0],
    paddingHorizontal: spacing[3],
    borderRadius: radii.xs,
    backgroundColor: colors.surfaceMuted,
  },
  badgeSelected: { backgroundColor: colors.primary },
  addTile: {
    height: sizes.layoutRow,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[3],
    borderRadius: radii.xl,
    borderWidth: borders.row,
    borderStyle: "dashed",
    borderColor: colors.dashedStrong,
  },
  panel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: spacing[8],
    paddingHorizontal: layout.screenPaddingX,
    borderTopLeftRadius: radii.panel,
    borderTopRightRadius: radii.panel,
    backgroundColor: colors.surface,
    ...shadows.panel,
  },
  panelContent: { width: "100%", maxWidth: layout.contentMaxWidth, alignSelf: "center", gap: spacing[7] },
  panelHead: { flexDirection: "row", alignItems: "center", gap: spacing[6] },
  panelTitle: { flex: 1, gap: spacing[1] },
  sizesBlock: { gap: spacing[4] },
  sizes: { flexDirection: "row", flexWrap: "wrap", gap: spacing[4] },
  size: {
    height: sizes.layoutSizeOption,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[5],
    paddingHorizontal: spacing[8],
    borderRadius: radii.md,
    borderWidth: borders.hairline,
  },
  sizeIdle: { backgroundColor: colors.surface, borderColor: colors.border },
  sizeChecked: { backgroundColor: colors.text, borderColor: colors.text },
  sizeIcon: { borderWidth: borders.row, borderRadius: radii.outline },
  actions: { flexDirection: "row", gap: spacing[4] },
  action: { flex: 1 },
  group: { gap: spacing[5] },
  groupHead: { flexDirection: "row", alignItems: "center", gap: spacing[4] },
  groupCard: { borderRadius: radii["2xl"], backgroundColor: colors.surface, ...shadows.card },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[6],
    paddingVertical: spacing[6],
    paddingHorizontal: spacing[7],
  },
  addRowDivider: { borderBottomWidth: borders.hairline, borderBottomColor: colors.divider },
  addRowText: { flex: 1, gap: spacing[1] },
  addPill: { height: sizes.pillButton, borderRadius: radii.pill, paddingHorizontal: spacing[7] },
});
