import type { AppAction, ViewParams } from "@app/plugin-sdk";
import type { Href } from "expo-router";

/**
 * A plugin view as a typed route for the router (navigation). Its params go in the query; the route's own segments
 * come last, so a view param named like one of them cannot redirect it.
 */
export function pluginRoute(slug: string, pluginId: string, view: string, params: ViewParams = {}): Href {
  return { pathname: "/app/c/[slug]/[plugin]/[view]", params: { ...params, slug, plugin: pluginId, view } };
}

/** Plugin view screen path: /app/c/<slug>/<plugin>/<view>?<params> (a screen's identity: flash messages, back). */
export function pluginHref(slug: string, pluginId: string, view: string, params: ViewParams = {}): string {
  const path = [slug, pluginId, view].map(encodeURIComponent).join("/");
  const query = new URLSearchParams(params).toString();
  return `/app/c/${path}${query ? `?${query}` : ""}`;
}

/** App actions always target this installation's host page, never a plugin's embedded admin view. */
export function appHref(slug: string, pluginId: string, screen: AppAction["screen"]): string {
  return screen === "dashboard" ? "/app" : `/app/c/${encodeURIComponent(slug)}/manage/${encodeURIComponent(pluginId)}`;
}

export function appRoute(slug: string, pluginId: string, screen: AppAction["screen"]): Href {
  return screen === "dashboard" ? "/app" : { pathname: "/app/c/[slug]/manage/[pluginId]", params: { slug, pluginId } };
}

/** View params from Expo Router route params (no path segments, single strings only). */
export function viewParamsFrom(all: Record<string, string | string[] | undefined>): ViewParams {
  const { slug: _s, plugin: _p, view: _v, ...rest } = all;
  return Object.fromEntries(Object.entries(rest).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])));
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const isParams = (v: unknown): v is ViewParams =>
  v === undefined || (isRecord(v) && Object.values(v).every((x) => typeof x === "string"));

/**
 * Where a tapped push leads (its `data` is PushData from the API): the plugin view it points to, or the
 * community when it points nowhere. null = not one of our pushes. Checked by hand: the app does not load the
 * Zod contracts at runtime.
 */
export function notificationHref(data: unknown): { notificationId: string; href: string } | null {
  if (!isRecord(data)) return null;
  const { notificationId, community, pluginId, open } = data;
  if (typeof notificationId !== "string" || typeof community !== "string" || typeof pluginId !== "string") return null;
  if (open === null || open === undefined) return { notificationId, href: `/app/c/${encodeURIComponent(community)}` };
  if (!isRecord(open) || typeof open.view !== "string" || !isParams(open.params)) return null;
  return { notificationId, href: pluginHref(community, pluginId, open.view, open.params) };
}
