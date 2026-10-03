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
  /** Publiczny URL API (baseURL Better Auth), np. https://api.example.com */
  API_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET musi mieć min. 32 znaki"),
  /** Originy frontu (web). Aplikacje natywne nie wysyłają Origin — uwierzytelniają się tokenem bearer. */
  TRUSTED_ORIGINS: csv,
  /** Token administratora wtyczek (Authorization: Bearer ...). Brak = API administracyjne wyłączone (404). */
  PLUGIN_ADMIN_TOKEN: z.string().min(24, "PLUGIN_ADMIN_TOKEN musi mieć min. 24 znaki").optional(),
  /** Katalog na skompilowane wtyczki wgrane przez API (cache; źródłem prawdy jest baza). */
  PLUGINS_DIR: z.string().optional(),
  /** Katalog na pliki wtyczek (zdjęcia). Domyślnie katalog tymczasowy. */
  FILES_DIR: z.string().optional(),
  /** Model językowy dla ctx.ai (Strands, API zgodne z OpenAI). Bez klucza: ctx.ai.call niedostępne. */
  AI_API_KEY: z.string().min(1).optional(),
  AI_MODEL: z.string().min(1).optional(),
  /** Własny endpoint zgodny z OpenAI (np. inny dostawca). Brak = api.openai.com. */
  AI_BASE_URL: z.url().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Błędna konfiguracja środowiska:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}
