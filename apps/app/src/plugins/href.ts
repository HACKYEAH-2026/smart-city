import type { ViewParams } from "@app/plugin-sdk";

/** Ścieżka ekranu widoku wtyczki: /app/c/<slug>/<plugin>/<view>?<params>. */
export function pluginHref(slug: string, pluginId: string, view: string, params: ViewParams = {}): string {
  const path = [slug, pluginId, view].map(encodeURIComponent).join("/");
  const query = new URLSearchParams(params).toString();
  return `/app/c/${path}${query ? `?${query}` : ""}`;
}

/** Parametry widoku z parametrów trasy Expo Router (bez segmentów ścieżki, tylko pojedyncze stringi). */
export function viewParamsFrom(all: Record<string, string | string[] | undefined>): ViewParams {
  const { slug: _s, plugin: _p, view: _v, ...rest } = all;
  return Object.fromEntries(Object.entries(rest).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])));
}
