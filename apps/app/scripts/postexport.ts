/**
 * Po `expo export`: dopasowanie wyniku do Cloudflare Workers Static Assets i SEO.
 *  - +not-found.html -> 404.html (not_found_handling: "404-page"),
 *  - usunięcie _sitemap.html (pomocnik deweloperski Expo Router),
 *  - <html lang> dla stron w językach innych niż bazowy (app/+html.tsx jest wspólny dla wszystkich tras).
 */
import { existsSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import settings from "../project.inlang/settings.json" with { type: "json" };

const dist = join(import.meta.dir, "..", "dist");
if (!existsSync(join(dist, "index.html")))
  throw new Error("brak dist/index.html — expo export nie wygenerował statycznego HTML");
renameSync(join(dist, "+not-found.html"), join(dist, "404.html"));
rmSync(join(dist, "_sitemap.html"), { force: true });

const htmlFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? htmlFiles(join(dir, e.name)) : e.name.endsWith(".html") ? [join(dir, e.name)] : [],
  );

for (const locale of settings.locales.filter((l) => l !== settings.baseLocale)) {
  const files = [
    join(dist, `${locale}.html`),
    ...(existsSync(join(dist, locale)) ? htmlFiles(join(dist, locale)) : []),
  ];
  // Expo generuje "<html  lang=...>" (podwójna spacja) — dopasowanie regexem, nie dosłownym tekstem.
  const baseLang = new RegExp(`<html\\s+lang="${settings.baseLocale}"`);
  for (const file of files.filter(existsSync)) {
    const html = readFileSync(file, "utf8");
    if (!baseLang.test(html)) throw new Error(`${file}: brak <html lang="${settings.baseLocale}">`);
    writeFileSync(file, html.replace(baseLang, `<html lang="${locale}"`));
  }
  console.log(`postexport: <html lang="${locale}"> w ${files.filter(existsSync).length} plikach`);
}
console.log("postexport: 404.html gotowy, _sitemap usunięty");
