import type { Context, Permission, PluginCommunity, PluginUser } from "@app/plugin-sdk";
import type { AIService } from "../ai/service";
import type { Db } from "../db";
import type { FileService } from "../files/service";
import type { LoadedPlugin } from "./host";
import { createStorage } from "./storage";

/** Service without a manifest permission: every use fails with a clear error. */
function denied<T extends object>(permission: Permission): T {
  return new Proxy({} as T, {
    get: () => () => Promise.reject(new Error(`Plugin did not declare the "${permission}" permission`)),
  });
}

export type PluginServices = { db: Db; files: FileService; ai: AIService };

/** System user for onInstall (seed data): admin, with no account in the database. */
export const SYSTEM_USER: PluginUser = { id: "system", name: "System", role: "admin" };

/** Builds a plugin call context: only what its manifest allows. */
export function createPluginContext(
  services: PluginServices,
  args: { plugin: LoadedPlugin; installationId: string; community: PluginCommunity; user: PluginUser },
): Context {
  const { plugin, installationId, community, user } = args;
  const can = (p: Permission) => plugin.manifest.permissions.includes(p);
  const userId = user === SYSTEM_USER ? null : user.id;
  return {
    user,
    community,
    now: () => new Date(),
    storage: can("storage") ? createStorage(services.db, installationId, userId) : denied("storage"),
    files: can("files") ? services.files.forPlugin(installationId, userId) : denied("files"),
    ai: can("ai") ? services.ai.forPlugin(installationId) : denied("ai"),
  };
}
