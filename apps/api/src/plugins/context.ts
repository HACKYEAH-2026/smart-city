import { type Context, deniedService, type Permission, type PluginCommunity, type PluginUser } from "@app/plugin-sdk";
import type { Db } from "../db";
import type { AIService } from "../services/ai/service";
import { createPluginDb } from "../services/db/service";
import type { FileService } from "../services/files/service";
import type { LoadedPlugin } from "./host";

export type PluginServices = { db: Db; files: FileService; ai: AIService };

/** System user for onInstall (seed data): admin, with no account in the database. */
export const SYSTEM_USER: PluginUser = { id: "system", name: "System", role: "admin" };

/** Builds a plugin call context: only what its manifest allows. */
export function createPluginContext(
  services: PluginServices,
  args: {
    plugin: LoadedPlugin;
    installationId: string;
    community: PluginCommunity;
    user: PluginUser;
    lastVisit?: Date | null;
  },
): Context {
  const { plugin, installationId, community, user } = args;
  const can = (p: Permission) => plugin.manifest.permissions.includes(p);
  const userId = user === SYSTEM_USER ? null : user.id;
  return {
    user,
    community,
    now: () => new Date(),
    lastVisit: args.lastVisit ?? null,
    db: can("db") ? createPluginDb(services.db, plugin, installationId, userId) : deniedService("db"),
    files: can("files") ? services.files.forPlugin(installationId) : deniedService("files"),
    ai: can("ai") ? services.ai.forPlugin(installationId) : deniedService("ai"),
  };
}
