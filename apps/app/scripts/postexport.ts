/**
 * After `expo export`:
 *  - +not-found.html -> 404.html (served by scripts/serve.ts for unknown paths),
 *  - remove _sitemap.html (Expo Router dev helper).
 */
import { existsSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";

const dist = join(import.meta.dir, "..", "dist");
if (!existsSync(join(dist, "index.html")))
  throw new Error("missing dist/index.html — expo export did not generate static HTML");
renameSync(join(dist, "+not-found.html"), join(dist, "404.html"));
rmSync(join(dist, "_sitemap.html"), { force: true });

console.log("postexport: 404.html ready, _sitemap removed");
