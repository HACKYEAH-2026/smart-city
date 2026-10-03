import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  // DRIZZLE_OUT pozwala scripts/check.ts wykryć dryf schematu bez ruszania ./migrations.
  out: process.env.DRIZZLE_OUT ?? "./migrations",
});
