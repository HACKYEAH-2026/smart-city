import type { Auth, SessionUser } from "./auth";
import type { Db } from "./db";
import type { PluginBuilder } from "./plugins/builder";
import type { PluginHost } from "./plugins/host";
import type { FileService } from "./services/files/service";
import type { Geocoder } from "./services/geo/types";
import type { NotificationService } from "./services/notifications/service";

/** Hono context type shared by all routers. */
export type AppEnv = {
  Variables: {
    db: Db;
    auth: Auth;
    user: SessionUser;
    plugins: PluginHost;
    builder: PluginBuilder;
    files: FileService;
    notifications: NotificationService;
    geocoder: Geocoder;
  };
};
