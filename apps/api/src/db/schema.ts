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
  visit: "plugin_visit",
  dashboard: "dashboard",
  notification: "notification",
  place: "place",
  location: "user_location",
  pushToken: "push_token",
} as const;

export const SCHEMA = `
${PLATFORM_SCHEMA}
DEFINE INDEX IF NOT EXISTS user_email ON user FIELDS email UNIQUE;

DEFINE TABLE IF NOT EXISTS community SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS slug ON community TYPE string;
DEFINE FIELD IF NOT EXISTS name ON community TYPE string;
DEFINE FIELD IF NOT EXISTS created_at ON community TYPE datetime DEFAULT time::now();
DEFINE INDEX IF NOT EXISTS community_slug ON community FIELDS slug UNIQUE;
-- Answers of the "new place" wizard (@app/shared newPlaceSchema). Places created before have none: read with defaults.
DEFINE FIELD IF NOT EXISTS kind ON community TYPE "estate" | "building" | "company" | "school" | "district" | "other" DEFAULT "other";
DEFINE FIELD IF NOT EXISTS address ON community TYPE string DEFAULT "";
DEFINE FIELD IF NOT EXISTS description ON community TYPE string DEFAULT "";
DEFINE FIELD IF NOT EXISTS join_rule ON community TYPE "open" | "approval" | "invite" DEFAULT "approval";
-- Invite code for joining by code, link or QR (@app/shared INVITE_CODE_ALPHABET); the API keeps it unique.
DEFINE FIELD IF NOT EXISTS invite_code ON community TYPE option<string>;
DEFINE INDEX IF NOT EXISTS community_invite_code ON community FIELDS invite_code;

-- Membership with a role: "admin" moderates plugin content, "user" is a member.
DEFINE TABLE IF NOT EXISTS membership SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS community ON membership TYPE record<community> REFERENCE ON DELETE CASCADE;
DEFINE FIELD IF NOT EXISTS user ON membership TYPE record<user> REFERENCE ON DELETE CASCADE;
DEFINE FIELD IF NOT EXISTS role ON membership TYPE "admin" | "user" DEFAULT "user";
DEFINE INDEX IF NOT EXISTS membership_community_user ON membership FIELDS community, user UNIQUE;
-- Per-user place state: when the user last opened the place, and whether it is the user's default place.
DEFINE FIELD IF NOT EXISTS last_visit ON membership TYPE option<datetime>;
DEFINE FIELD IF NOT EXISTS is_default ON membership TYPE bool DEFAULT false;

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

-- When a user last opened a view of an installed plugin (ctx.lastVisit). id = [installation, user].
DEFINE TABLE IF NOT EXISTS plugin_visit SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS installation ON plugin_visit TYPE record<plugin_installation> REFERENCE ON DELETE CASCADE;
DEFINE FIELD IF NOT EXISTS user ON plugin_visit TYPE record<user> REFERENCE ON DELETE CASCADE;
DEFINE FIELD IF NOT EXISTS at ON plugin_visit TYPE datetime;

-- Dashboard widget order of a community, set by its admins. id = community key; entries are
-- "<plugin>/<widget>" (widgets missing from it follow in the default order).
DEFINE TABLE IF NOT EXISTS dashboard SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS order ON dashboard TYPE array<string>;
DEFINE FIELD IF NOT EXISTS updated_at ON dashboard TYPE datetime DEFAULT time::now();

-- A notification in a resident's inbox (ctx.notify), one row per recipient. \`open\` = view of the plugin to open.
DEFINE TABLE IF NOT EXISTS notification SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS user ON notification TYPE record<user> REFERENCE ON DELETE CASCADE;
DEFINE FIELD IF NOT EXISTS community ON notification TYPE record<community> REFERENCE ON DELETE CASCADE;
DEFINE FIELD IF NOT EXISTS installation ON notification TYPE record<plugin_installation> REFERENCE ON DELETE CASCADE;
DEFINE FIELD IF NOT EXISTS plugin ON notification TYPE string;
DEFINE FIELD IF NOT EXISTS title ON notification TYPE string;
DEFINE FIELD IF NOT EXISTS body ON notification TYPE string DEFAULT "";
DEFINE FIELD IF NOT EXISTS tone ON notification TYPE "info" | "success" | "warning" | "danger" DEFAULT "info";
DEFINE FIELD IF NOT EXISTS open ON notification TYPE option<object> FLEXIBLE;
DEFINE FIELD IF NOT EXISTS created_at ON notification TYPE datetime DEFAULT time::now();
DEFINE FIELD IF NOT EXISTS read_at ON notification TYPE option<datetime>;
DEFINE INDEX IF NOT EXISTS notification_user_created ON notification FIELDS user, created_at;

-- A resident's saved place ("Moje miejsca": home, work, a child's school), private to them. Plugins never read
-- it: ctx.notify({ to: { near } }) is matched against it by the host.
DEFINE TABLE IF NOT EXISTS place SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS user ON place TYPE record<user> REFERENCE ON DELETE CASCADE;
DEFINE FIELD IF NOT EXISTS label ON place TYPE string;
DEFINE FIELD IF NOT EXISTS point ON place TYPE geometry<point>;
DEFINE FIELD IF NOT EXISTS created_at ON place TYPE datetime DEFAULT time::now();
DEFINE INDEX IF NOT EXISTS place_user ON place FIELDS user;

-- The position a resident shares while the app is open (one per user, id = user key); "near" ignores stale ones.
DEFINE TABLE IF NOT EXISTS user_location SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS user ON user_location TYPE record<user> REFERENCE ON DELETE CASCADE;
DEFINE FIELD IF NOT EXISTS point ON user_location TYPE geometry<point>;
DEFINE FIELD IF NOT EXISTS at ON user_location TYPE datetime;

-- A phone that receives pushes (Expo push token, id = the token). Belongs to whoever registered it last.
DEFINE TABLE IF NOT EXISTS push_token SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS user ON push_token TYPE record<user> REFERENCE ON DELETE CASCADE;
DEFINE FIELD IF NOT EXISTS updated_at ON push_token TYPE datetime DEFAULT time::now();
DEFINE INDEX IF NOT EXISTS push_token_user ON push_token FIELDS user;
`;
