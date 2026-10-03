import { z } from "zod";

const csv = z
  .string()
  .default("")
  .transform((s) =>
    s
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
  );

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().default(3000),
  DATABASE_URL: z.string().min(1),
  /** Public API URL (Better Auth baseURL), e.g. https://api.example.com */
  API_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  /** Frontend (web) origins. Native apps send no Origin — they authenticate with a bearer token. */
  TRUSTED_ORIGINS: csv,
  /** Plugin admin token (Authorization: Bearer ...). Unset = admin API disabled (404). */
  PLUGIN_ADMIN_TOKEN: z.string().min(24, "PLUGIN_ADMIN_TOKEN must be at least 24 characters").optional(),
  /** Directory for compiled plugins uploaded via the API (cache; the database is the source of truth). */
  PLUGINS_DIR: z.string().optional(),
  /** Directory for plugin files (photos). Defaults to a temp directory. */
  FILES_DIR: z.string().optional(),
  /** Language model for ctx.ai (Strands, OpenAI-compatible API). Without a key: ctx.ai.call is unavailable. */
  AI_API_KEY: z.string().min(1).optional(),
  AI_MODEL: z.string().min(1).optional(),
  /** Custom OpenAI-compatible endpoint (e.g. another provider). Unset = api.openai.com. */
  AI_BASE_URL: z.url().optional(),
  /** Embedding model for ctx.ai.embed (same key and endpoint). Unset = ctx.ai.embed is unavailable. */
  AI_EMBEDDING_MODEL: z.string().min(1).optional(),
  /**
   * Google sign-in: client ID of the "Web application" OAuth client in the Google Cloud project. The phones ask Google
   * for ID tokens issued to it (webClientId), the API checks they are. Unset = no Google sign-in. No client secret:
   * the API only verifies ID tokens, it never exchanges codes with Google.
   */
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  /** Client ID of the "iOS" OAuth client (same project); iOS tokens may carry it as the audience. */
  GOOGLE_IOS_CLIENT_ID: z.string().min(1).optional(),
  /** Expo access token, only if the Expo project enables enhanced push security. Unset = plain Expo push. */
  EXPO_ACCESS_TOKEN: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}
