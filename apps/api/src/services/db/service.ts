import type { Database } from "@app/plugin-sdk";
import { createDatabase, syncSchema } from "@app/plugin-sdk/engine";
import type { Db } from "../../db";
import type { LoadedPlugin } from "../../plugins/host";

/**
 * `ctx.db`: the plugin's declared tables in the app database (`src/db`), via the engine from
 * `@app/plugin-sdk/engine` (same code as the test harness). Tables are named `p_<plugin>__<table>`,
 * every row is scoped to one installation, and references point to platform tables (user, plugin_file).
 */
export function createPluginDb(db: Db, plugin: LoadedPlugin, installationId: string, userId: string | null): Database {
  return createDatabase({
    surreal: db,
    pluginId: plugin.manifest.id,
    tables: plugin.definition.tables ?? {},
    installationId,
    userId,
  });
}

/** Creates the plugin's tables and applies additive changes; breaking changes throw SchemaError (no DB change). */
export function syncPluginTables(db: Db, plugin: Pick<LoadedPlugin, "manifest" | "definition">): Promise<void> {
  return syncSchema(db, plugin.manifest.id, plugin.definition.tables ?? {});
}
