/**
 * Lokalny podgląd dist/ zachowujący się jak Cloudflare Workers Static Assets
 * (html_handling: auto-trailing-slash, not_found_handling: 404-page). Używany przez E2E.
 */
import { join, normalize } from "node:path";

const root = join(import.meta.dir, "..", "dist");
const port = Number(process.env.PORT ?? 4173);

Bun.serve({
  port,
  async fetch(req) {
    const path = normalize(decodeURIComponent(new URL(req.url).pathname)).replace(/\/+$/, "") || "/";
    const candidates = path === "/" ? ["/index.html"] : [path, `${path}.html`, `${path}/index.html`];
    for (const c of candidates) {
      const file = Bun.file(join(root, c));
      if ((await file.exists()) && !c.endsWith("/")) return new Response(file);
    }
    return new Response(Bun.file(join(root, "404.html")), { status: 404, headers: { "content-type": "text/html" } });
  },
});
console.log(`preview: http://localhost:${port}`);
