import type { Context, Permission, PluginCommunity, PluginUser } from "@app/plugin-sdk";
import type { AIService } from "../ai/service";
import type { Db } from "../db";
import type { FileService } from "../files/service";
import type { LoadedPlugin } from "./host";
import { createStorage } from "./storage";

/** Usługa bez uprawnienia w manifeście: każde użycie kończy się czytelnym błędem. */
function denied<T extends object>(permission: Permission): T {
  return new Proxy({} as T, {
    get: () => () => Promise.reject(new Error(`Plugin did not declare the "${permission}" permission`)),
  });
}

export type PluginServices = { db: Db; files: FileService; ai: AIService };

/** Użytkownik systemowy dla onInstall (dane startowe): admin, bez konta w bazie. */
export const SYSTEM_USER: PluginUser = { id: "system", name: "System", role: "admin" };

/** Buduje kontekst wywołania wtyczki: tylko to, na co pozwala jej manifest. */
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
