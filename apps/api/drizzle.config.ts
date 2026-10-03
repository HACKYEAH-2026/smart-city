import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  // DRIZZLE_OUT lets scripts/check.ts detect schema drift without touching ./migrations.
  out: process.env.DRIZZLE_OUT ?? "./migrations",
});
