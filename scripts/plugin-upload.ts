/**
 * Uploads a plugin to a running API and installs it in a community (dev / live demo).
 *   bun run plugin:upload plugins/benches [community=krakow]     (directory or .ts file)
 * API_URL (default http://localhost:4000), PLUGIN_ADMIN_TOKEN (default: the local dev server token).
 */
import { statSync } from "node:fs";
import { join } from "node:path";
import { TEST_ADMIN_TOKEN } from "../apps/api/src/test-env";

const [target, community = "krakow"] = process.argv.slice(2);
if (!target) {
  console.error("usage: bun run plugin:upload <plugin-dir|file.ts> [community]");
  process.exit(1);
}
const file = statSync(target).isDirectory() ? join(target, "index.ts") : target;
const api = process.env.API_URL ?? "http://localhost:4000";
const headers = {
  authorization: `Bearer ${process.env.PLUGIN_ADMIN_TOKEN ?? TEST_ADMIN_TOKEN}`,
  "content-type": "application/json",
};

const up = await fetch(`${api}/api/admin/plugins`, {
  method: "POST",
  headers,
  body: JSON.stringify({ source: await Bun.file(file).text() }),
});
const manifest = (await up.json()) as { id?: string; version?: string; message?: string; error?: string };
if (up.status !== 201 || !manifest.id) {
  console.error(`upload: ERROR ${up.status}: ${manifest.message ?? manifest.error ?? "unknown"}`);
  process.exit(1);
}
const inst = await fetch(`${api}/api/admin/communities/${community}/plugins`, {
  method: "POST",
  headers,
  body: JSON.stringify({ pluginId: manifest.id }),
});
if (inst.status !== 201) {
  console.error(`install: ERROR ${inst.status}: ${await inst.text()}`);
  process.exit(1);
}
console.log(`plugin ${manifest.id}@${manifest.version}: uploaded and enabled in "${community}"`);
