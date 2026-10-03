import { z } from "zod";
import { definePlugin, type PluginDefinition, type PluginManifest, pluginManifestSchema } from "./plugin";
import { ui } from "./ui";

/** Błąd wtyczki (zły manifest, wyjątek, niepoprawny wynik). Komunikat jest bezpieczny dla autora/admina. */
export class PluginError extends Error {}

/** SDK przekazywane modułowi wtyczki — jedyne, czego wtyczka używa w runtime. */
export const sdk = { definePlugin, ui, z };

export type LoadedDefinition = { manifest: PluginManifest; definition: PluginDefinition };

/**
 * Wywołuje moduł wtyczki z SDK i sprawdza manifest oraz spójność (nav → istniejące widoki,
 * narzędzia mają schemat i handler). Używane przez hosta w API i przez test harness.
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
