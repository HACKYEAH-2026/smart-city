/**
 * Wgrywa wtyczkę do działającego API i instaluje ją w społeczności (dev / demo na żywo).
 *   bun run plugin:upload <plik.ts> [społeczność=krakow]
 * API_URL (domyślnie http://localhost:4000), PLUGIN_ADMIN_TOKEN (domyślnie token lokalnego dev-serwera).
 */
import { TEST_ADMIN_TOKEN } from "@app/testing/constants";

const [file, community = "krakow"] = process.argv.slice(2);
if (!file) {
  console.error("użycie: bun run plugin:upload <plik.ts> [społeczność]");
  process.exit(1);
}
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
  console.error(`wgrywanie: BŁĄD ${up.status}: ${manifest.message ?? manifest.error ?? "nieznany"}`);
  process.exit(1);
}
const inst = await fetch(`${api}/api/admin/communities/${community}/plugins`, {
  method: "POST",
  headers,
  body: JSON.stringify({ pluginId: manifest.id }),
});
if (inst.status !== 201) {
  console.error(`instalacja: BŁĄD ${inst.status}: ${await inst.text()}`);
  process.exit(1);
}
console.log(`wtyczka ${manifest.id}@${manifest.version}: wgrana i włączona w "${community}"`);
