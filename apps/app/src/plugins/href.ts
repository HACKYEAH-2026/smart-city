import type { ViewParams } from "@app/plugin-sdk";

/** Plugin view screen path: /app/c/<slug>/<plugin>/<view>?<params>. */
export function pluginHref(slug: string, pluginId: string, view: string, params: ViewParams = {}): string {
  const path = [slug, pluginId, view].map(encodeURIComponent).join("/");
  const query = new URLSearchParams(params).toString();
  return `/app/c/${path}${query ? `?${query}` : ""}`;
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
