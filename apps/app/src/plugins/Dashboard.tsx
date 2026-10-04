import {
  type Action,
  DASHBOARD_COLUMNS,
  type DashboardWidgetSize,
  type NavigateAction,
  type UINode,
} from "@app/plugin-sdk";
import { useRouter } from "expo-router";
import { ChevronLeft, ChevronRight, GripVertical } from "lucide-react-native";
import { useMemo, useRef, useState } from "react";
import { type AccessibilityActionEvent, PanResponder, Pressable, StyleSheet, View } from "react-native";
import { Button, Icon, IconButton, Text } from "../components";
import { useDashboard, useSaveDashboardOrder } from "../data/communities";
import { type GridRect, gridRects } from "../lib/grid";
import { longPressFeedback } from "../lib/haptics";
import { moveTo } from "../lib/order";
import { t } from "../texts";
import { borders, colors, opacity, radii, shadows, sizes, spacing } from "../theme";
import { pluginRoute } from "./href";
import { PluginRenderer } from "./Renderer";

/**
 * Community dashboard: plugin widgets in a grid DASHBOARD_COLUMNS wide (design "Układ pulpitu"; placed by
 * `src/lib/grid.ts`), each tile as big as the admins set it (its plugin's default otherwise). Tapping a tile
 * opens the plugin view its widget names (`onPress`, e.g. the full list); what is inside the tile (a card, a button)
 * keeps its own action. Community admins long-press a tile to enter edit mode (screen readers: the "Edytuj pulpit"
 * action), then drag a tile by its handle or use the earlier/later buttons. Every change is saved for the whole
 * community.
 */
type Widget = { key: string; pluginId: string; size: DashboardWidgetSize; node: UINode };

const GAP = spacing[6];

/** The edit controls in a row (handle and two arrows, with their gaps and padding) and their inset from the tile's edge. */
const CONTROLS_WIDTH = 3 * sizes.iconButton + 4 * spacing[2];
const CONTROLS_INSET = spacing[6];

/** `order` first, keys missing from it after, in their given order (the same rule as the API). */
const arrange = (keys: string[], order: string[]) => {
  const rank = (key: string) => (order.includes(key) ? order.indexOf(key) : order.length);
  // Copy then sort: `toSorted` is missing in Hermes (the phone runtime), so no ES2023 array methods in the app.
  return [...keys].sort((a, b) => rank(a) - rank(b));
};

const contains = (r: GridRect, x: number, y: number) =>
  x >= r.left && x <= r.left + r.width && y >= r.top && y <= r.top + r.height;

/** The tile (other than `key`) under the point, in grid coordinates. */
const tileAt = (rects: Map<string, GridRect>, key: string, x: number, y: number) =>
  [...rects.entries()].find(([k, r]) => k !== key && contains(r, x, y))?.[0] ?? null;

const titleOf = (node: UINode) => ("title" in node ? node.title : "");

/** Where tapping the tile leads (the widget's `onPress`), if anywhere. */
const pressOf = (node: UINode): NavigateAction | undefined => (node.type === "Widget" ? node.onPress : undefined);

/** Screen-reader actions of a tile: open it (instead of a tap in its middle, which may hit a button) and edit. */
const tileActions = (opens: boolean, canEdit: boolean) => [
  ...(opens ? [{ name: "activate" }] : []),
  ...(canEdit ? [{ name: "longpress", label: t.dashboard_edit }] : []),
];

/** Widgets are read-only (no forms), so they never upload files. */
const noUpload = () => Promise.reject(new Error("Widgets cannot upload files"));

export function Dashboard({ slug }: { slug: string }) {
  const router = useRouter();
  const dashboard = useDashboard(slug);
  const save = useSaveDashboardOrder(slug);
  const [width, setWidth] = useState(0);
  const [editing, setEditing] = useState(false);
  // The order being dragged or saved; dropped once the save settles (the refetched dashboard then has it, or, after
  // an error, the saved order comes back), so a layout saved elsewhere (the layout editor) shows too.
  const [order, setOrder] = useState<string[]>([]);
  const widgets = (dashboard.data?.widgets ?? []) as Widget[];
  const keys = arrange(
    widgets.map((w) => w.key),
    order,
  );
  const byKey = new Map(widgets.map((w) => [w.key, w]));
  const grid = gridRects(
    keys.flatMap((key) => byKey.get(key) ?? []),
    { width, columns: DASHBOARD_COLUMNS, rowHeight: sizes.widgetRow, gap: GAP },
  );

  const reorder = (next: string[]) => {
    setOrder(next);
    save.mutate(next, { onSettled: () => setOrder([]) });
  };
  const drag = useDrag(keys, setOrder, reorder);
  drag.rects.current = new Map(grid.tiles.map(({ item, rect }) => [item.key, rect]));

  if (!widgets.length) return null;
  const canEdit = dashboard.data?.canEdit ?? false;
  const open = (pluginId: string) => (action: Action) => {
    if (action.type === "navigate") router.push(pluginRoute(slug, pluginId, action.view, action.params));
  };
  const startEditing = () => {
    longPressFeedback();
    setEditing(true);
  };

  return (
    <View style={styles.section}>
      {editing ? (
        <View style={styles.toolbar}>
          <Text variant="caption" color="textSecondary" style={styles.hint}>
            {t.dashboard_edit_hint}
          </Text>
          <Button label={t.dashboard_done} size="xs" fullWidth={false} onPress={() => setEditing(false)} />
        </View>
      ) : null}
      {save.isError ? (
        <Text variant="bodyL" color="primaryPressed" role="alert">
          {t.dashboard_save_error}
        </Text>
      ) : null}
      <View
        ref={drag.grid}
        role="list"
        aria-label={t.community_dashboard_label}
        // The height needs no width, so the grid takes its space before it is measured (no jump after the first frame).
        style={{ height: grid.height }}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      >
        {width
          ? grid.tiles.map(({ item: w, rect }, index) => {
              const key = w.key;
              const title = titleOf(w.node);
              const press = pressOf(w.node);
              const go = press ? () => open(w.pluginId)(press) : undefined;
              return (
                <View
                  key={key}
                  role="listitem"
                  style={[styles.tile, rect, editing && styles.editable, drag.active === key && styles.dragged]}
                >
                  <Pressable
                    style={({ pressed }) => [styles.fill, editing ? styles.dimmed : pressed && styles.pressed]}
                    pointerEvents={editing ? "none" : "auto"}
                    onPress={go}
                    onLongPress={canEdit ? startEditing : undefined}
                    accessible={Boolean(go)}
                    focusable={Boolean(go)}
                    accessibilityRole={go ? "link" : undefined}
                    accessibilityLabel={go ? `${t.dashboard_open}: ${title}` : undefined}
                    accessibilityActions={tileActions(Boolean(go), canEdit)}
                    onAccessibilityAction={(e: AccessibilityActionEvent) =>
                      e.nativeEvent.actionName === "longpress" ? startEditing() : go?.()
                    }
                  >
                    <PluginRenderer
                      node={w.node}
                      onAction={open(w.pluginId)}
                      busy={false}
                      upload={noUpload}
                      onLongPress={canEdit ? startEditing : undefined}
                    />
                  </Pressable>
                  {editing ? (
                    // A tile narrower than the row of controls (one column of three) gets them wrapped over it.
                    <View
                      pointerEvents="box-none"
                      style={
                        rect.width < CONTROLS_WIDTH + 2 * CONTROLS_INSET ? styles.controlsWrapped : styles.controls
                      }
                    >
                      <DragHandle label={`${t.dashboard_drag}: ${title}`} onDrag={drag.handlers(key)} />
                      {index > 0 ? (
                        <IconButton
                          icon={ChevronLeft}
                          label={`${t.dashboard_move_earlier}: ${title}`}
                          onPress={() => reorder(moveTo(keys, key, index - 1))}
                        />
                      ) : null}
                      {index < grid.tiles.length - 1 ? (
                        <IconButton
                          icon={ChevronRight}
                          label={`${t.dashboard_move_later}: ${title}`}
                          onPress={() => reorder(moveTo(keys, key, index + 1))}
                        />
                      ) : null}
                    </View>
                  ) : null}
                </View>
              );
            })
          : null}
      </View>
    </View>
  );
}

type DragHandlers = ReturnType<typeof PanResponder.create>["panHandlers"];

function DragHandle({ label, onDrag }: { label: string; onDrag: DragHandlers }) {
  return (
    <View aria-label={label} style={styles.handle} {...onDrag}>
      <Icon icon={GripVertical} size={spacing[9]} />
    </View>
  );
}

/**
 * Drag to reorder: while a tile is dragged, it takes the place of the tile under the pointer (the grid reflows
 * live); on release the order is saved. Tile rectangles (relative to the grid) are the ones the grid is drawn with.
 */
function useDrag(keys: string[], preview: (keys: string[]) => void, commit: (keys: string[]) => void) {
  const grid = useRef<View>(null);
  const rects = useRef(new Map<string, GridRect>());
  const [active, setActive] = useState<string | null>(null);
  // Latest values for the responder callbacks, which are created once per tile.
  const state = useRef({
    keys,
    preview,
    commit,
    origin: { x: 0, y: 0 },
    swappedWith: null as string | null,
    moved: false,
  });
  Object.assign(state.current, { keys, preview, commit });

  const handlers = useMemo(() => {
    const cache = new Map<string, DragHandlers>();
    const finish = () => {
      setActive(null);
      if (state.current.moved) state.current.commit(state.current.keys);
    };
    return (key: string) => {
      const existing = cache.get(key);
      if (existing) return existing;
      const created = PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          state.current.swappedWith = null;
          state.current.moved = false;
          grid.current?.measure((_x, _y, _w, _h, pageX, pageY) => {
            state.current.origin = { x: pageX, y: pageY };
          });
          setActive(key);
        },
        onPanResponderMove: (_e, g) => {
          const s = state.current;
          const target = tileAt(rects.current, key, g.moveX - s.origin.x, g.moveY - s.origin.y);
          // After a swap the pointer can still be over the tile just passed; wait until it leaves it.
          if (!target || target === s.swappedWith) {
            if (!target) s.swappedWith = null;
            return;
          }
          s.swappedWith = target;
          s.moved = true;
          const next = moveTo(s.keys, key, s.keys.indexOf(target));
          s.keys = next;
          s.preview(next);
        },
        onPanResponderRelease: finish,
        // Taken over by the system mid-drag: the order shown so far is kept (and saved), never left unsaved.
        onPanResponderTerminate: finish,
      }).panHandlers;
      cache.set(key, created);
      return created;
    };
  }, []);

  return { grid, rects, active, handlers };
}

const styles = StyleSheet.create({
  section: { gap: spacing[6] },
  toolbar: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: spacing[6] },
  hint: { flex: 1 },
  tile: { position: "absolute" },
  fill: { flex: 1 },
  pressed: { opacity: opacity.pressed },
  dragged: { opacity: opacity.pressed, ...shadows.selected },
  /** Edit mode: dashed frame like the empty slots of the dashboard design. */
  editable: {
    borderRadius: radii["3xl"],
    borderWidth: borders.row,
    borderStyle: "dashed",
    borderColor: colors.dashed,
  },
  dimmed: { opacity: opacity.disabled },
  controls: {
    position: "absolute",
    bottom: CONTROLS_INSET,
    right: CONTROLS_INSET,
    flexDirection: "row",
    gap: spacing[2],
    padding: spacing[2],
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    ...shadows.floating,
  },
  controlsWrapped: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    flexDirection: "row",
    flexWrap: "wrap",
    alignContent: "center",
    justifyContent: "center",
    gap: spacing[2],
  },
  handle: {
    width: sizes.iconButton,
    height: sizes.iconButton,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceMuted,
  },
});
