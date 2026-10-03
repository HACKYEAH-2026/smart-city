import type { PluginModule } from "@app/plugin-sdk";
import announcements from "@plugins/announcements";
import issues from "@plugins/issues";

/** Plugins built into the API image (code in plugins/). New built-in plugin = package in plugins/ + entry here. */
export const builtinPlugins: PluginModule[] = [issues, announcements];
