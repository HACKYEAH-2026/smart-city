import { createRemoteEngines, Surreal } from "surrealdb";

/** Client type as seen by the app. */
export type Db = Surreal;
export type DbHandle = { db: Db; close: () => Promise<void> };

export const NAMESPACE = "app";
export const DATABASE = "main";

/**
 * The only database client factory (SurrealDB). Chosen by DATABASE_URL:
 *   mem://                  -> embedded, in-memory (tests, E2E, dev)
 *   surrealkv:///abs/path   -> embedded, on disk (dev with persistence)
 *   ws://host:8000          -> SurrealDB server (production: separate container); credentials in the URL
 *                              as ws://user:pass@host:8000
 * The embedded engine (@surrealdb/node, a native addon) is loaded only for embedded URLs; the production
 * image does not ship it.
 */
export async function createDb(url: string): Promise<DbHandle> {
  const parsed = /^wss?:\/\//.test(url) ? new URL(url) : null;
  const embedded = parsed ? {} : (await import("@surrealdb/node")).createNodeEngines();
  const db = new Surreal({ engines: { ...createRemoteEngines(), ...embedded } });
  if (parsed) {
    await db.connect(`${parsed.protocol}//${parsed.host}/rpc`, {
      authentication: { username: decodeURIComponent(parsed.username), password: decodeURIComponent(parsed.password) },
    });
  } else {
    await db.connect(url);
  }
  await db.use({ namespace: NAMESPACE, database: DATABASE });
  return {
    db,
    close: async () => {
      await db.close();
    },
  };
}
