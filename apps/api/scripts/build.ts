/**
 * Build produkcyjny API: bundle serwera i migratora. Kończy się błędem, jeśli do bundla
 * trafił kod testowy (/__test).
 */
import { readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const outdir = join(import.meta.dir, "..", "dist");
rmSync(outdir, { recursive: true, force: true });

const result = await Bun.build({
  entrypoints: [join(import.meta.dir, "../src/server.ts"), join(import.meta.dir, "../src/db/migrate-cli.ts")],
  outdir,
  target: "bun",
  minify: true,
  naming: "[name].js",
});
if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

for (const file of readdirSync(outdir)) {
  const text = readFileSync(join(outdir, file), "utf8");
  for (const needle of ["__test"]) {
    if (text.includes(needle)) {
      console.error(`BŁĄD: ${file} zawiera kod testowy (${needle})`);
      process.exit(1);
    }
  }
}
console.log(`api build: OK -> ${readdirSync(outdir).join(", ")} (bez /__test)`);
