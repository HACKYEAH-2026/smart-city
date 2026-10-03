import { PLATFORM_SCHEMA } from "@app/plugin-sdk/engine";

/**
 * The only database schema (SurrealQL). Idempotent (`IF NOT EXISTS`): applied on every start and in tests,
 * no migration files. Better Auth tables (user, session, account, verification) are schemaless and managed
 * by its SurrealDB adapter; plugin tables (`p_<plugin>__<table>`) are defined by the plugin engine.
 * PLATFORM_SCHEMA holds the tables the plugin engine references (user, plugin_installation, plugin_file).
 */
export const TABLES = {
  user: "user",
  community: "community",
  membership: "membership",
  installation: "plugin_installation",
  file: "plugin_file",
  source: "plugin_source",
} as const;

export const SCHEMA = `
${PLATFORM_SCHEMA}
DEFINE INDEX IF NOT EXISTS user_email ON user FIELDS email UNIQUE;

DEFINE TABLE IF NOT EXISTS community SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS slug ON community TYPE string;
DEFINE FIELD IF NOT EXISTS name ON community TYPE string;
DEFINE FIELD IF NOT EXISTS created_at ON community TYPE datetime DEFAULT time::now();
DEFINE INDEX IF NOT EXISTS community_slug ON community FIELDS slug UNIQUE;

-- Membership with a role: "admin" moderates plugin content, "user" is a member.
DEFINE TABLE IF NOT EXISTS membership SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS community ON membership TYPE record<community> REFERENCE ON DELETE CASCADE;
DEFINE FIELD IF NOT EXISTS user ON membership TYPE record<user> REFERENCE ON DELETE CASCADE;
DEFINE FIELD IF NOT EXISTS role ON membership TYPE "admin" | "user" DEFAULT "user";
DEFINE INDEX IF NOT EXISTS membership_community_user ON membership FIELDS community, user UNIQUE;

-- A plugin enabled in a community; plugin tables and files cascade on it.
DEFINE FIELD IF NOT EXISTS community ON plugin_installation TYPE record<community> REFERENCE ON DELETE CASCADE;
DEFINE FIELD IF NOT EXISTS plugin ON plugin_installation TYPE string;
DEFINE FIELD IF NOT EXISTS enabled ON plugin_installation TYPE bool DEFAULT true;
DEFINE FIELD IF NOT EXISTS created_at ON plugin_installation TYPE datetime DEFAULT time::now();
DEFINE INDEX IF NOT EXISTS plugin_installation_community_plugin ON plugin_installation FIELDS community, plugin UNIQUE;

-- Source of plugins uploaded at runtime (POST /api/admin/plugins); reloaded after a restart. id = plugin id.
DEFINE TABLE IF NOT EXISTS plugin_source SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS version ON plugin_source TYPE string;
DEFINE FIELD IF NOT EXISTS source ON plugin_source TYPE string;
DEFINE FIELD IF NOT EXISTS updated_at ON plugin_source TYPE datetime DEFAULT time::now();
`;
