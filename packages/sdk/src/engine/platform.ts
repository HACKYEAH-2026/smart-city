import { HOST } from "./schema";

/**
 * Platform tables the plugin engine relies on (only the fields it reads/writes). The host schema includes
 * these definitions; the test harness uses them as is. Plugin tables reference `user` and `plugin_file`
 * and cascade on `plugin_installation`.
 */
export const PLATFORM_SCHEMA = `
  DEFINE TABLE IF NOT EXISTS ${HOST.user} SCHEMALESS;
  DEFINE FIELD IF NOT EXISTS name ON ${HOST.user} TYPE string;
  DEFINE TABLE IF NOT EXISTS ${HOST.installation} SCHEMALESS;
  DEFINE TABLE IF NOT EXISTS ${HOST.file} SCHEMAFULL;
  DEFINE FIELD IF NOT EXISTS installation ON ${HOST.file} TYPE record<${HOST.installation}> REFERENCE ON DELETE CASCADE;
  DEFINE FIELD IF NOT EXISTS uploaded_by ON ${HOST.file} TYPE option<record<${HOST.user}>> REFERENCE ON DELETE UNSET;
  DEFINE FIELD IF NOT EXISTS status ON ${HOST.file} TYPE "pending" | "kept" DEFAULT "pending";
  DEFINE FIELD IF NOT EXISTS mime ON ${HOST.file} TYPE string;
  DEFINE FIELD IF NOT EXISTS size ON ${HOST.file} TYPE int;
  DEFINE FIELD IF NOT EXISTS created_at ON ${HOST.file} TYPE datetime DEFAULT time::now();
  DEFINE TABLE IF NOT EXISTS ${HOST.schema} SCHEMALESS;
`;
