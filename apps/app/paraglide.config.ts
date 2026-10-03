import type { CompilerOptions } from "@inlang/paraglide-js";

/**
 * Jedyna konfiguracja Paraglide (kompilacja: scripts/i18n.ts, przed dev/build/typecheck/E2E).
 * Strategia "baseLocale": runtime nie zgaduje języka — język podaje nasz I18nProvider
 * (src/lib/i18n.tsx) jawnie do każdego komunikatu. Działa tak samo na web, iOS i Androidzie.
 */
export const paraglide = {
  project: "./project.inlang",
  outdir: "./src/paraglide",
  strategy: ["baseLocale"],
  emitTsDeclarations: true,
} satisfies CompilerOptions;
