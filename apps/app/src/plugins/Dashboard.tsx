import type { Action, DashboardWidgetSize, UINode } from "@app/plugin-sdk";
import { useRouter } from "expo-router";
import { ChevronLeft, ChevronRight, GripVertical } from "lucide-react-native";
import { useMemo, useRef, useState } from "react";
import { type LayoutRectangle, PanResponder, StyleSheet, View } from "react-native";
import { Button, Icon, IconButton, Text } from "../components";
import { useDashboard, useSaveDashboardOrder } from "../data/communities";
import { t } from "../texts";
import { borders, colors, opacity, radii, shadows, sizes, spacing } from "../theme";
import { pluginHref } from "./href";
import { PluginRenderer } from "./Renderer";

/**
 * Community dashboard: plugin widgets in a 2-column grid, each tile as big as its plugin declares.
 * Community admins reorder it in edit mode: drag a tile by its handle, or use the earlier/later buttons
 * (keyboard and screen readers). Every change is saved for the whole community.
 */
type Widget = { key: string; pluginId: string; size: DashboardWidgetSize; node: UINode };

const GAP = spacing[6];

/** Pixel size of a tile in a 2-column grid of `width`; rows are `sizes.widgetRow` high. */
const tileSize = (size: DashboardWidgetSize, width: number) => ({
  width: size.w === 2 ? width : (width - GAP) / 2,
  height: size.h * sizes.widgetRow + (size.h - 1) * GAP,
});

/** `order` first, keys missing from it after, in their given order (the same rule as the API). */
const arrange = (keys: string[], order: string[]) => {
  const rank = (key: string) => (order.includes(key) ? order.indexOf(key) : order.length);
  // Copy then sort: `toSorted` is missing in Hermes (the phone runtime), so no ES2023 array methods in the app.
  return [...keys].sort((a, b) => rank(a) - rank(b));
};

/** `keys` with `key` moved to `index`. */
const moveTo = (keys: string[], key: string, index: number) => {
  const rest = keys.filter((k) => k !== key);
  return [...rest.slice(0, index), key, ...rest.slice(index)];
};

const contains = (r: LayoutRectangle, x: number, y: number) =>
  x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height;

/** The tile (other than `key`) under the point, in grid coordinates. */
const tileAt = (rects: Map<string, LayoutRectangle>, key: string, x: number, y: number) =>
  [...rects.entries()].find(([k, r]) => k !== key && contains(r, x, y))?.[0] ?? null;

const titleOf = (node: UINode) => ("title" in node ? node.title : "");

/** Widgets are read-only (no forms), so they never upload files. */
const noUpload = () => Promise.reject(new Error("Widgets cannot upload files"));

export function Dashboard({ slug }: { slug: string }) {
  const router = useRouter();
  const dashboard = useDashboard(slug);
  const save = useSaveDashboardOrder(slug);
  const [width, setWidth] = useState(0);
  const [editing, setEditing] = useState(false);
  // Order chosen in this session; kept after saving so the grid never jumps back while the API refetches.
  const [order, setOrder] = useState<string[]>([]);
  const widgets = (dashboard.data?.widgets ?? []) as Widget[];
  const keys = arrange(
    widgets.map((w) => w.key),
    order,
  );
  const byKey = new Map(widgets.map((w) => [w.key, w]));

  const reorder = (next: string[]) => {
    setOrder(next);
    save.mutate(next);
  };
  const drag = useDrag(keys, setOrder, reorder);

  if (!widgets.length) return null;
  const open = (pluginId: string) => (action: Action) => {
    if (action.type === "navigate") router.push(pluginHref(slug, pluginId, action.view, action.params) as never);
  };

  return (
    <View style={styles.section}>
      {dashboard.data?.canEdit ? (
        <View style={styles.toolbar}>
          {editing ? (
            <Text variant="caption" color="textSecondary" style={styles.hint}>
              {t.dashboard_edit_hint}
            </Text>
          ) : null}
          <Button
            label={editing ? t.dashboard_done : t.dashboard_edit}
            variant={editing ? "primary" : "secondary"}
            size="xs"
            fullWidth={false}
            onPress={() => setEditing(!editing)}
          />
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
        style={styles.grid}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      >
        {width
          ? keys.map((key, index) => {
              const w = byKey.get(key);
              if (!w) return null;
              const title = titleOf(w.node);
              return (
                <View
                  key={key}
                  role="listitem"
                  style={[tileSize(w.size, width), editing && styles.editable, drag.active === key && styles.dragged]}
                  onLayout={(e) => drag.rects.current.set(key, e.nativeEvent.layout)}
                >
                  <View style={[styles.fill, editing && styles.dimmed]} pointerEvents={editing ? "none" : "auto"}>
                    <PluginRenderer node={w.node} onAction={open(w.pluginId)} busy={false} upload={noUpload} />
                  </View>
                  {editing ? (
                    <View style={styles.controls}>
                      <DragHandle label={`${t.dashboard_drag}: ${title}`} onDrag={drag.handlers(key)} />
                      {index > 0 ? (
                        <IconButton
                          icon={ChevronLeft}
                          label={`${t.dashboard_move_earlier}: ${title}`}
                          onPress={() => reorder(moveTo(keys, key, index - 1))}
                        />
                      ) : null}
                      {index < keys.length - 1 ? (
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
 * live); on release the order is saved. Tile rectangles come from onLayout, relative to the grid.
 */
function useDrag(keys: string[], preview: (keys: string[]) => void, commit: (keys: string[]) => void) {
  const grid = useRef<View>(null);
  const rects = useRef(new Map<string, LayoutRectangle>());
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
        onPanResponderRelease: () => {
          setActive(null);
          if (state.current.moved) state.current.commit(state.current.keys);
        },
        onPanResponderTerminate: () => setActive(null),
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
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GAP },
  fill: { flex: 1 },
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
    bottom: spacing[6],
    right: spacing[6],
    flexDirection: "row",
    gap: spacing[2],
    padding: spacing[2],
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    ...shadows.floating,
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
