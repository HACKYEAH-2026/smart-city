import { surql } from "surrealdb";
import { HOST, ident } from "./schema";

const [user, installation, file, schema] = [HOST.user, HOST.installation, HOST.file, HOST.schema].map(ident);

/**
 * Platform tables the plugin engine relies on (only the fields it reads/writes). The host schema includes
 * these definitions; the test harness uses them as is. Plugin tables reference `user` and `plugin_file`
 * and cascade on `plugin_installation`.
 */
export const PLATFORM_SCHEMA = surql`
  DEFINE TABLE IF NOT EXISTS ${user} SCHEMALESS;
  DEFINE FIELD IF NOT EXISTS name ON ${user} TYPE string;
  DEFINE TABLE IF NOT EXISTS ${installation} SCHEMALESS;
  DEFINE TABLE IF NOT EXISTS ${file} SCHEMAFULL;
  DEFINE FIELD IF NOT EXISTS installation ON ${file} TYPE record<${installation}> REFERENCE ON DELETE CASCADE;
  DEFINE FIELD IF NOT EXISTS uploaded_by ON ${file} TYPE option<record<${user}>> REFERENCE ON DELETE UNSET;
  DEFINE FIELD IF NOT EXISTS status ON ${file} TYPE "pending" | "kept" DEFAULT "pending";
  DEFINE FIELD IF NOT EXISTS mime ON ${file} TYPE string;
  DEFINE FIELD IF NOT EXISTS size ON ${file} TYPE int;
  DEFINE FIELD IF NOT EXISTS created_at ON ${file} TYPE datetime DEFAULT time::now();
  DEFINE TABLE IF NOT EXISTS ${schema} SCHEMALESS;
`;
