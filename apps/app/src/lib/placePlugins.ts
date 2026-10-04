import type { PlacePlugin } from "@app/shared";
import { t } from "../texts";
import { widgetsCount } from "./plural";

/** The plugins that are on in the place. Drafts of AI plugins never are: they go on by being published. */
export const enabledPlugins = (plugins: PlacePlugin[]): PlacePlugin[] =>
  plugins.filter((plugin) => plugin.enabled && !plugin.draft);

/**
 * The catalog of a place: the plugins that can be added (not on yet; drafts are handled in the plugin builder) whose
 * name or description contains the search, case-insensitive.
 */
export function catalogPlugins(plugins: PlacePlugin[], search: string): PlacePlugin[] {
  const query = search.trim().toLocaleLowerCase("pl");
  return plugins.filter(
    (plugin) =>
      !plugin.enabled &&
      !plugin.draft &&
      `${plugin.name}\n${plugin.description}`.toLocaleLowerCase("pl").includes(query),
  );
}

/**
 * The line under a plugin's name: "Z AI · 3 widżety · <description>" (the AI mark, the widget count and the description
 * only when there are any).
 */
export const pluginSubtitle = (plugin: PlacePlugin): string =>
  [plugin.madeByAi ? t.build_made_by_ai : "", plugin.widgets ? widgetsCount(plugin.widgets) : "", plugin.description]
    .filter(Boolean)
    .join(" · ");
