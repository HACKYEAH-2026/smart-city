import { z } from "zod";
import { SchemaError, validateTables } from "./engine/schema";
import { definePlugin, type PluginDefinition, type PluginManifest, pluginManifestSchema } from "./plugin";
import { t } from "./services/db";
import { fileRef } from "./services/files";
import { ui } from "./ui";

/** Plugin error (bad manifest, exception, invalid result). The message is safe to show the author/admin. */
export class PluginError extends Error {}

/** SDK passed to the plugin module — the only thing a plugin uses at runtime. */
export const sdk = { definePlugin, ui, z, fileRef, t };

export type LoadedDefinition = { manifest: PluginManifest; definition: PluginDefinition };

/**
 * Calls the plugin module with the SDK and checks the manifest and consistency (nav → existing views,
 * tools have a schema and handler). Used by the API host and by the test harness.
 */
export function loadPlugin(mod: unknown): LoadedDefinition {
  const definition = callFactory(mod);
  const manifest = parseManifest(definition);
  assertViews(definition, manifest);
  assertTables(definition);
  assertTools(definition);
  assertStreams(definition);
  return { manifest, definition };
}

function callFactory(mod: unknown): PluginDefinition {
  if (typeof mod !== "function") throw new PluginError("Plugin module must export a default function (sdk) => plugin");
  const definition = invokeFactory(mod as (s: typeof sdk) => PluginDefinition);
  if (!definition || typeof definition !== "object") {
    throw new PluginError("Plugin factory must return definePlugin({...})");
  }
  return definition;
}

function invokeFactory(factory: (s: typeof sdk) => PluginDefinition): PluginDefinition {
  try {
    return factory(sdk);
  } catch (err) {
    throw new PluginError(`Plugin factory threw: ${(err as Error).message}`);
  }
}

function parseManifest(definition: PluginDefinition): PluginManifest {
  const parsed = pluginManifestSchema.safeParse(definition);
  if (!parsed.success) throw new PluginError(`Invalid manifest: ${z.prettifyError(parsed.error)}`);
  return parsed.data;
}

function assertViews(definition: PluginDefinition, manifest: PluginManifest): void {
  if (!definition.views || typeof definition.views !== "object") throw new PluginError("Plugin must define views");
  const missing = manifest.nav.find((entry) => typeof definition.views[entry.view] !== "function");
  if (missing) throw new PluginError(`Nav entry "${missing.label}" points to missing view "${missing.view}"`);
}

function assertTables(definition: PluginDefinition): void {
  try {
    validateTables(definition.tables ?? {});
  } catch (err) {
    if (err instanceof SchemaError) throw new PluginError(`Invalid tables: ${err.message}`);
    throw err;
  }
}

function assertTools(definition: PluginDefinition): void {
  const invalid = Object.entries(definition.tools ?? {}).find(
    ([, tool]) => typeof tool?.handler !== "function" || !(tool.input instanceof z.ZodType),
  );
  if (invalid) throw new PluginError(`Tool "${invalid[0]}" must have an input schema (z.object) and a handler`);
}

function assertStreams(definition: PluginDefinition): void {
  const invalid = Object.entries(definition.streams ?? {}).find(
    ([, stream]) => typeof stream?.handler !== "function" || !(stream.input instanceof z.ZodType),
  );
  if (invalid) throw new PluginError(`Stream "${invalid[0]}" must have an input schema (z.object) and a handler`);
}
