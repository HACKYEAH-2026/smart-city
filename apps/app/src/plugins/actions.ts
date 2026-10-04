import type { Action, NavigateAction, ToolResult, ViewParams } from "@app/plugin-sdk";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useToolCall } from "../data/communities";
import { useFlash } from "../lib/flash";
import type { ActionOptions } from "./context";
import { appRoute, pluginHref, pluginRoute } from "./href";

/** A plugin view shown as a bottom sheet over a screen (`navigate` with `present: "sheet"`). */
export type SheetTarget = { view: string; params: ViewParams };

/** Where a plugin's actions run: a screen (a plugin view, the plugin's page) or a sheet over one. */
export type ActionSurface = {
  /** The screen's address: a tool's toast for the screen it stays on is flashed there. */
  here: string;
  /** The screen's own view: a `replace` to it only changes its params (a tab, a filter). */
  view?: string;
  /** Opens a view as a sheet over the screen (from a sheet: shows that view in it instead). */
  openSheet: (target: SheetTarget) => void;
  /** Set when the surface is a sheet: closes it (before leaving the screen, or as its `close`). */
  closeSheet?: () => void;
  /** A tool succeeded: a sheet can close; screens retain their tree and form drafts. */
  onStay?: () => void;
};

const sheetOf = (action: NavigateAction): SheetTarget => ({ view: action.view, params: action.params ?? {} });

/**
 * The one handler of a plugin's actions, for every surface that renders its views. `navigate` opens a view (as a sheet
 * with `present: "sheet"`), `app` goes to the dashboard or installation's host page, `tool` follows its result: an
 * error is shown, `navigate` opens the next view, `close` leaves, otherwise the surface stays (with the toast).
 */
export function usePluginActions(slug: string, plugin: string, surface: ActionSurface) {
  const router = useRouter();
  const flash = useFlash();
  const call = useToolCall(slug, plugin);
  // Error message from the tool result (e.g. "This issue no longer exists") — content from the plugin.
  const [toolError, setToolError] = useState<string | null>(null);

  const navigate = (action: NavigateAction) => {
    if (action.present === "sheet") {
      surface.openSheet(sheetOf(action));
      return;
    }
    surface.closeSheet?.();
    flash.show(null);
    // A tab or filter of the same view only changes its params: no screen transition (a slide), and going back
    // leaves the list rather than each tab press.
    if (action.replace && action.view === surface.view) {
      router.setParams(action.params ?? {});
      return;
    }
    const route = pluginRoute(slug, plugin, action.view, action.params);
    if (action.replace) router.replace(route);
    else router.push(route);
  };

  const leave = () => {
    flash.show(null);
    if (surface.closeSheet) surface.closeSheet();
    else router.back();
  };

  const settle = (result: ToolResult) => {
    if (result.error) {
      setToolError(result.error);
      return;
    }
    if (result.navigate?.present === "sheet") {
      surface.openSheet(sheetOf(result.navigate));
      return;
    }
    if (result.close && !result.navigate) {
      leave();
      return;
    }
    const target = result.navigate;
    const next = target ? pluginHref(slug, plugin, target.view, target.params) : surface.here;
    flash.show(result.toast ? { text: result.toast, href: next } : null);
    surface.onStay?.();
    if (!target || next === surface.here) return;
    const route = pluginRoute(slug, plugin, target.view, target.params);
    // A form that finished (a report) is replaced, so back never returns to the filled-in form.
    if (target.replace) router.replace(route);
    else router.push(route);
  };

  const onAction = (action: Action, options: ActionOptions = {}) => {
    setToolError(null);
    // The failure of an earlier call is not this action's: its message goes (as the plugin's own error does).
    if (call.isError) call.reset();
    if (action.type === "navigate") navigate(action);
    else if (action.type === "app") {
      surface.closeSheet?.();
      flash.show(null);
      router.dismissTo(appRoute(slug, plugin, action.screen));
    } else {
      call.mutate(
        { tool: action.tool, args: action.args ?? {} },
        {
          onSuccess: (result) => {
            settle(result);
            if (!result.error) options.onSuccess?.();
          },
          onSettled: options.onSettled,
        },
      );
    }
  };

  return { onAction, busy: call.isPending, failed: call.isError, toolError };
}
