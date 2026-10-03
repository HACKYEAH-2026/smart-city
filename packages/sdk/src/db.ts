/** A document in the plugin database. `data` is arbitrary plugin JSON. */
export type Doc<T = Record<string, unknown>> = {
  id: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  data: T;
};

export type Query<T> = {
  /** Equality on top-level `data` fields (string, number, boolean). */
  where?: Partial<T>;
  order?: "newest" | "oldest";
  limit?: number;
};

/**
 * Document store. Always scoped to ONE installation (plugin × community):
 * a plugin has no way to read data of another community or another plugin.
 */
export interface Database {
  get<T = Record<string, unknown>>(collection: string, id: string): Promise<Doc<T> | null>;
  list<T = Record<string, unknown>>(collection: string, query?: Query<T>): Promise<Doc<T>[]>;
  /** New document with a generated id. */
  create<T extends Record<string, unknown>>(collection: string, data: T): Promise<Doc<T>>;
  /** Write under a key (id = key): creates or overwrites. The database guarantees uniqueness (e.g. one vote per person). */
  upsert<T extends Record<string, unknown>>(collection: string, key: string, data: T): Promise<Doc<T>>;
  /** Shallow merge of `patch` fields into the existing `data`. */
  update<T = Record<string, unknown>>(collection: string, id: string, patch: Partial<T>): Promise<Doc<T> | null>;
  remove(collection: string, id: string): Promise<boolean>;
}
