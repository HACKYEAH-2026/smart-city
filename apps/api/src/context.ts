import type { Db } from "@app/db";
import type { Auth, SessionUser } from "./auth";
import type { PluginHost } from "./plugins/host";

/** Typ kontekstu Hono współdzielony przez wszystkie routery. */
export type AppEnv = {
  Variables: {
    db: Db;
    auth: Auth;
    user: SessionUser;
    plugins: PluginHost;
  };
};
