import type { PluginCatalogItem } from "@app/shared";
import { Hono } from "hono";
import type { AppEnv } from "../context";
import { requireUser } from "../middleware";

/**
 * Plugins a signed-in user can enable in their own place: the built-in ones, in the order of builtinPlugins.
 * Uploaded plugins are not offered; the platform admin enables them (admin API).
 */
export const pluginsRoutes = new Hono<AppEnv>().use(requireUser).get("/", (c) => {
  const catalog: PluginCatalogItem[] = c.var.plugins
    .list()
    .filter((plugin) => plugin.origin === "builtin")
    .map(({ manifest: { id, name, icon, description } }) => ({ id, name, icon, description }));
  return c.json(catalog, 200);
});
