/**
 * Production API build: bundles the server and the migrator, and records the types plugin checks use
 * (plugin-types.json, read next to server.js: the image has no repo). Fails if test code (/__test)
 * ended up in the bundle. The embedded engine (@surrealdb/node, a native addon) stays external and is
 * not in the image: production connects to a SurrealDB server (ws://), see src/db/client.ts.
 */
import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { recordTypeFs } from "../src/plugins/typecheck";

const outdir = join(import.meta.dir, "..", "dist");
rmSync(outdir, { recursive: true, force: true });

const result = await Bun.build({
  entrypoints: [join(import.meta.dir, "../src/server.ts"), join(import.meta.dir, "../src/db/migrate-cli.ts")],
  outdir,
  target: "bun",
  minify: true,
  naming: "[name].js",
  external: ["@surrealdb/node"],
});
if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

const types = JSON.stringify(await recordTypeFs());
writeFileSync(join(outdir, "plugin-types.json"), types);

for (const file of readdirSync(outdir).filter((name) => name.endsWith(".js"))) {
  const text = readFileSync(join(outdir, file), "utf8");
  for (const needle of ["__test"]) {
    if (text.includes(needle)) {
      console.error(`ERROR: ${file} contains test code (${needle})`);
      process.exit(1);
    }
  }
}
console.log(`api build: OK -> ${readdirSync(outdir).join(", ")} (no /__test)`);
