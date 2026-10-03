import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { AIService } from "./ai/service";
import { StrandsLanguageModel } from "./ai/strands";
import type { AIProviders } from "./ai/types";
import { createAuth } from "./auth";
import type { AppEnv } from "./context";
import type { Db } from "./db";
import type { Env } from "./env";
import { FileService } from "./files/service";
import { DiskFileStore, defaultFilesDir } from "./files/store";
import { builtinPlugins } from "./plugins/builtin";
import { defaultPluginsDir, PluginHost } from "./plugins/host";
import { createAdminRoutes } from "./routes/admin";
import { communitiesRoutes } from "./routes/communities";
import { filesRoutes } from "./routes/files";

/** Dostawcy AI z env (Strands + model zgodny z OpenAI); bez AI_API_KEY i AI_MODEL — brak modelu. */
function aiFromEnv(env: Env): AIProviders {
  if (!env.AI_API_KEY || !env.AI_MODEL) return {};
  return {
    language: new StrandsLanguageModel({ apiKey: env.AI_API_KEY, model: env.AI_MODEL, baseUrl: env.AI_BASE_URL }),
  };
}

/**
 * Składa aplikację. Dostaje gotowego klienta Drizzle (nie wie, jaka baza jest pod spodem).
 * Jedyne miejsce montowania routerów; typ AppType eksportowany dla klienta RPC we froncie.
 */
export function createApp({ db, env, ai }: { db: Db; env: Env; ai?: AIProviders }) {
  const auth = createAuth(db, env);
  const files = new FileService(
    db,
    new DiskFileStore(env.FILES_DIR ?? defaultFilesDir()),
    env.BETTER_AUTH_SECRET,
    env.API_URL,
  );
  const plugins = new PluginHost(
    { db, files, ai: new AIService(ai ?? aiFromEnv(env), files) },
    env.PLUGINS_DIR ?? defaultPluginsDir(),
    builtinPlugins,
  );

  const app = new Hono<AppEnv>();
  if (env.NODE_ENV !== "test") app.use(logger());
  app.use(
    "/api/*",
    cors({
      origin: env.TRUSTED_ORIGINS,
      credentials: true,
      allowHeaders: ["Content-Type", "Authorization"],
      allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      exposeHeaders: ["set-auth-token"],
    }),
  );
  app.use(async (c, next) => {
    c.set("db", db);
    c.set("auth", auth);
    c.set("plugins", plugins);
    c.set("files", files);
    await next();
  });
  app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));
  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: "internal_error" }, 500);
  });

  const routes = app
    .get("/health", (c) => c.json({ ok: true }))
    .route("/api/communities", communitiesRoutes)
    .route("/api/files", filesRoutes)
    .route("/api/admin", createAdminRoutes(env.PLUGIN_ADMIN_TOKEN));

  return { app: routes, auth, plugins };
}

export type AppType = ReturnType<typeof createApp>["app"];
