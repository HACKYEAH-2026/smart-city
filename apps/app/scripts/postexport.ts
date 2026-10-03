/**
 * Po `expo export`:
 *  - +not-found.html -> 404.html (serwowany przez scripts/serve.ts dla nieznanych ścieżek),
 *  - usunięcie _sitemap.html (pomocnik deweloperski Expo Router).
 */
import { existsSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";

const dist = join(import.meta.dir, "..", "dist");
if (!existsSync(join(dist, "index.html")))
  throw new Error("brak dist/index.html — expo export nie wygenerował statycznego HTML");
renameSync(join(dist, "+not-found.html"), join(dist, "404.html"));
rmSync(join(dist, "_sitemap.html"), { force: true });

console.log("postexport: 404.html gotowy, _sitemap usunięty");
