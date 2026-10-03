import type { Auth, SessionUser } from "./auth";
import type { Db } from "./db";
import type { FileService } from "./files/service";
import type { PluginHost } from "./plugins/host";

/** Hono context type shared by all routers. */
export type AppEnv = {
  Variables: {
    db: Db;
    auth: Auth;
    user: SessionUser;
    plugins: PluginHost;
    files: FileService;
  };
};
