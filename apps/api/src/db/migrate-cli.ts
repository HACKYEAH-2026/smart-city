import { createDb } from "./client";
import { migrate } from "./migrate";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}
const handle = await createDb(url);
await migrate(handle.db);
await handle.close();
console.log("schema: OK");
// The embedded SurrealDB engine keeps the event loop alive after close().
process.exit(0);
