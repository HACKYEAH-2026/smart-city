import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { authProviders, createAuth, type GoogleIdTokenVerifier } from "./auth";
import type { AppEnv } from "./context";
import type { Db } from "./db";
import type { Env } from "./env";
import { builtinPlugins } from "./plugins/builtin";
import { DraftService } from "./plugins/drafts";
import { defaultPluginsDir, PluginHost } from "./plugins/host";
import { createAdminRoutes } from "./routes/admin";
import { communitiesRoutes } from "./routes/communities";
import { draftsRoutes } from "./routes/drafts";
import { filesRoutes } from "./routes/files";
import { geoRoutes } from "./routes/geo";
import { invitationsRoutes } from "./routes/invitations";
import { meRoutes } from "./routes/me";
import { placeAdminRoutes } from "./routes/placeAdmin";
import { pluginsRoutes } from "./routes/plugins";
import type { PluginAuthor } from "./services/ai/author";
import { AIService } from "./services/ai/service";
import { StrandsLanguageModel, StrandsPluginAuthor } from "./services/ai/strands";
import type { AIProviders } from "./services/ai/types";
import { FileService } from "./services/files/service";
import { DiskFileStore, defaultFilesDir } from "./services/files/store";
import { OpenGeocoder } from "./services/geo/open";
import type { Geocoder } from "./services/geo/types";
import { NotificationService } from "./services/notifications/service";
import { ExpoPushSender } from "./services/push/expo";
import type { PushSender } from "./services/push/types";

/** The model from env (Strands + OpenAI-compatible API); without AI_API_KEY and AI_MODEL — none. */
const modelFromEnv = (env: Env) =>
  env.AI_API_KEY && env.AI_MODEL ? { apiKey: env.AI_API_KEY, model: env.AI_MODEL, baseUrl: env.AI_BASE_URL } : null;

/** AI providers for ctx.ai; without a model, none. */
function aiFromEnv(env: Env): AIProviders {
  const model = modelFromEnv(env);
  return model ? { language: new StrandsLanguageModel(model) } : {};
}

/** The plugin builder's author (Strands agent); without a model, none (the builder answers ai_unavailable). */
function authorFromEnv(env: Env): PluginAuthor | undefined {
  const model = modelFromEnv(env);
  return model ? new StrandsPluginAuthor(model) : undefined;
}

/**
 * Assembles the app. Receives a connected SurrealDB client (embedded or server — the app does not care).
 * The only place routers are mounted; AppType is exported for the frontend RPC client.
 * `push` defaults to the Expo Push Service, `geocoder` to the open-data geocoder and `author` (the plugin builder's
 * AI) to a Strands agent on the env's model (tests pass fakes; `null` = none); `verifyGoogleIdToken` is for tests only
 * (Google's own check by default).
 */
export function createApp({
  db,
  env,
  ai,
  push,
  geocoder = new OpenGeocoder(),
  author,
  verifyGoogleIdToken,
}: {
  db: Db;
  env: Env;
  ai?: AIProviders;
  push?: PushSender;
  author?: PluginAuthor | null;
  geocoder?: Geocoder;
  verifyGoogleIdToken?: GoogleIdTokenVerifier;
}) {
  const auth = createAuth(db, env, { verifyGoogleIdToken });
  const files = new FileService(
    db,
    new DiskFileStore(env.FILES_DIR ?? defaultFilesDir()),
    env.BETTER_AUTH_SECRET,
    env.API_URL,
  );
  const notifications = new NotificationService(db, push ?? new ExpoPushSender({ accessToken: env.EXPO_ACCESS_TOKEN }));
  const plugins = new PluginHost(
    { db, files, ai: new AIService(ai ?? aiFromEnv(env), files), notifications },
    env.PLUGINS_DIR ?? defaultPluginsDir(),
    builtinPlugins,
  );
  const drafts = new DraftService(db, plugins, author === undefined ? authorFromEnv(env) : (author ?? undefined));

  const app = new Hono<AppEnv>();
  if (env.NODE_ENV !== "test") app.use(logger());
  app.use(
    "/api/*",
    cors({
      origin: env.TRUSTED_ORIGINS,
      credentials: true,
      allowHeaders: ["Content-Type", "Authorization"],
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      exposeHeaders: ["set-auth-token"],
    }),
  );
  app.use(async (c, next) => {
    c.set("db", db);
    c.set("auth", auth);
    c.set("plugins", plugins);
    c.set("drafts", drafts);
    c.set("files", files);
    c.set("notifications", notifications);
    c.set("geocoder", geocoder);
    await next();
  });
  app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));
  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: "internal_error" }, 500);
  });

  const routes = app
    .get("/health", (c) => c.json({ ok: true }))
    /** Public: which sign-in methods the login screen shows (outside /api/auth/*, which belongs to Better Auth). */
    .get("/api/auth-providers", (c) => c.json(authProviders(env), 200))
    .route("/api/communities", communitiesRoutes)
    .route("/api/communities", placeAdminRoutes)
    .route("/api/communities", draftsRoutes)
    .route("/api/invitations", invitationsRoutes)
    .route("/api/files", filesRoutes)
    .route("/api/geo", geoRoutes)
    .route("/api/me", meRoutes)
    .route("/api/plugins", pluginsRoutes)
    .route("/api/admin", createAdminRoutes(env.PLUGIN_ADMIN_TOKEN));

  return { app: routes, auth, plugins, notifications, drafts };
}

export type AppType = ReturnType<typeof createApp>["app"];
