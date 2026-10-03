/** Host-side runtime of the plugin database (also used by the test harness). Plugins never import this. */
export { createDatabase, DbError } from "./client";
export { PLATFORM_SCHEMA } from "./platform";
export { HOST, planSchema, SchemaError, syncSchema, tableName, validateTables } from "./schema";
