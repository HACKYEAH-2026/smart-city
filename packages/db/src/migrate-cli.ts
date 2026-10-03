import { createDb } from "./client";
import { migrate } from "./migrate";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL jest wymagany");
  process.exit(1);
}
const handle = await createDb(url);
await migrate(handle);
await handle.close();
console.log("migracje: OK");
