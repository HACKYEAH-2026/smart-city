import { z } from "zod";
import { definePlugin, fileRef, type PluginDefinition, type PluginManifest, pluginManifestSchema } from "./plugin";
import { ui } from "./ui";

/** Plugin error (bad manifest, exception, invalid result). The message is safe to show the author/admin. */
export class PluginError extends Error {}

/** SDK passed to the plugin module — the only thing a plugin uses at runtime. */
export const sdk = { definePlugin, ui, z, fileRef };

export type LoadedDefinition = { manifest: PluginManifest; definition: PluginDefinition };

/**
 * Calls the plugin module with the SDK and checks the manifest and consistency (nav → existing views,
 * tools have a schema and handler). Used by the API host and by the test harness.
 */
export function loadPlugin(mod: unknown): LoadedDefinition {
  if (typeof mod !== "function") throw new PluginError("Plugin module must export a default function (sdk) => plugin");
  let definition: PluginDefinition;
  try {
    definition = (mod as (s: typeof sdk) => PluginDefinition)(sdk);
  } catch (err) {
    throw new PluginError(`Plugin factory threw: ${(err as Error).message}`);
  }
  if (!definition || typeof definition !== "object") {
    throw new PluginError("Plugin factory must return definePlugin({...})");
  }
  const parsed = pluginManifestSchema.safeParse(definition);
  if (!parsed.success) throw new PluginError(`Invalid manifest: ${z.prettifyError(parsed.error)}`);
  const manifest = parsed.data;
  if (!definition.views || typeof definition.views !== "object") throw new PluginError("Plugin must define views");
  for (const entry of manifest.nav) {
    if (typeof definition.views[entry.view] !== "function") {
      throw new PluginError(`Nav entry "${entry.label}" points to missing view "${entry.view}"`);
    }
  }
  for (const [name, tool] of Object.entries(definition.tools ?? {})) {
    if (typeof tool?.handler !== "function" || !(tool.input instanceof z.ZodType)) {
      throw new PluginError(`Tool "${name}" must have an input schema (z.object) and a handler`);
    }
  }
  return { manifest, definition };
}
