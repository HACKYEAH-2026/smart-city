import type { Db } from "@app/db";
import type { Community, PluginContext } from "@app/shared";
import type { SessionUser } from "../auth";
import type { LoadedPlugin } from "./host";
import { createStorage, deniedStorage } from "./storage";

/** Buduje kontekst wywołania wtyczki: tylko to, na co pozwala jej manifest. */
export function createPluginContext(args: {
  db: Db;
  plugin: LoadedPlugin;
  installationId: string;
  community: Community;
  user: SessionUser;
}): PluginContext {
  const { db, plugin, installationId, community, user } = args;
  return {
    user: { id: user.id, name: user.name },
    community,
    storage: plugin.manifest.permissions.includes("storage")
      ? createStorage(db, installationId, user.id)
      : deniedStorage,
  };
}
