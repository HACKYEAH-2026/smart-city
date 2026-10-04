import type { DashboardWidgetSize } from "@app/plugin-sdk";
import type { DashboardLayoutInput, LayoutWidget } from "@app/shared";
import { moveTo } from "./order";

/**
 * The dashboard layout being edited ("Układ pulpitu"), before it is saved: the widgets on the dashboard in order and
 * the ones off it. Every change returns a new draft; a key that is not where the change expects leaves it as it was.
 */
export type LayoutDraft = { widgets: LayoutWidget[]; available: LayoutWidget[] };

export const resizeWidget = (draft: LayoutDraft, key: string, size: DashboardWidgetSize): LayoutDraft => ({
  ...draft,
  widgets: draft.widgets.map((widget) => (widget.key === key ? { ...widget, size } : widget)),
});

/** One place earlier (-1) or later (1); the first and the last widget stay where they are. */
export const moveWidget = (draft: LayoutDraft, key: string, by: -1 | 1): LayoutDraft => {
  const index = draft.widgets.findIndex((widget) => widget.key === key);
  const widget = draft.widgets[index];
  const to = index + by;
  if (!widget || to < 0 || to >= draft.widgets.length) return draft;
  return { ...draft, widgets: moveTo(draft.widgets, widget, to) };
};

/** Off the dashboard: the widget can be added back from `available`. */
export const removeWidget = (draft: LayoutDraft, key: string): LayoutDraft => {
  const widget = draft.widgets.find((w) => w.key === key);
  if (!widget) return draft;
  return { widgets: draft.widgets.filter((w) => w !== widget), available: [...draft.available, widget] };
};

/** Back on the dashboard, last, in its plugin's default size. */
export const addWidget = (draft: LayoutDraft, key: string): LayoutDraft => {
  const widget = draft.available.find((w) => w.key === key);
  if (!widget) return draft;
  const added = { ...widget, size: widget.sizes[0] ?? widget.size };
  return { widgets: [...draft.widgets, added], available: draft.available.filter((w) => w !== widget) };
};

/**
 * The draft against the layout as the API has it now (refetched while editing, e.g. after a plugin was switched on):
 * declared widgets the draft does not know yet join it, where the API has them (on the dashboard: last; else
 * available); widgets no longer declared (their plugin was switched off) leave it. The admin's order, sizes and
 * removals stay: a widget the admin removed is in the draft's `available`, so it is known and stays off.
 */
export const reconcileDraft = (draft: LayoutDraft, latest: LayoutDraft): LayoutDraft => {
  const declared = new Set([...latest.widgets, ...latest.available].map((w) => w.key));
  const known = new Set([...draft.widgets, ...draft.available].map((w) => w.key));
  const stays = (widget: LayoutWidget) => declared.has(widget.key);
  const isNew = (widget: LayoutWidget) => !known.has(widget.key);
  return {
    widgets: [...draft.widgets.filter(stays), ...latest.widgets.filter(isNew)],
    available: [...draft.available.filter(stays), ...latest.available.filter(isNew)],
  };
};

/** What PUT /dashboard/layout takes. */
export const layoutInput = (draft: LayoutDraft): DashboardLayoutInput => ({
  widgets: draft.widgets.map(({ key, size }) => ({ key, size })),
});

/** "3 × 2" on tiles and size choices; "3×2" in the list of a widget's sizes (`compact`). */
export const sizeLabel = ({ w, h }: DashboardWidgetSize, compact = false) => (compact ? `${w}×${h}` : `${w} × ${h}`);

export type PluginWidgets = { pluginId: string; pluginName: string; pluginIcon: string; widgets: LayoutWidget[] };

/** Widgets grouped by their plugin, plugins in the order their first widget comes. */
export const byPlugin = (widgets: LayoutWidget[]): PluginWidgets[] =>
  [...new Set(widgets.map((w) => w.pluginId))].flatMap((pluginId) => {
    const own = widgets.filter((w) => w.pluginId === pluginId);
    const first = own[0];
    return first ? [{ pluginId, pluginName: first.pluginName, pluginIcon: first.pluginIcon, widgets: own }] : [];
  });
