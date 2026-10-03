import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * Jedyny schemat bazy (SQLite). Tabele user/session/account/verification to rdzeń Better Auth
 * (nazwy pól muszą zgadzać się z Better Auth). Zasoby domenowe poniżej.
 * Daty: integer w milisekundach (mode "timestamp_ms"), w kodzie zawsze obiekty Date.
 */
const timestamp = (name: string) => integer(name, { mode: "timestamp_ms" });

const timestamps = {
  createdAt: timestamp("created_at")
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at")
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
};

const uuid = (name: string) =>
  text(name)
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  ...timestamps,
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    ...timestamps,
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    ...timestamps,
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

// --- Społeczności i wtyczki ---

export const communities = sqliteTable("communities", {
  id: uuid("id"),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  ...timestamps,
});

/** Członkostwo w społeczności: rola "admin" (zarządza treściami wtyczek) albo "user". */
export const memberships = sqliteTable(
  "memberships",
  {
    id: uuid("id"),
    communityId: text("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["admin", "user"] })
      .notNull()
      .default("user"),
    ...timestamps,
  },
  (t) => [uniqueIndex("memberships_community_user_idx").on(t.communityId, t.userId)],
);

/** Wtyczka włączona w społeczności. Każda instalacja ma własny, odizolowany magazyn danych. */
export const pluginInstallations = sqliteTable(
  "plugin_installations",
  {
    id: uuid("id"),
    communityId: text("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    pluginId: text("plugin_id").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    ...timestamps,
  },
  (t) => [uniqueIndex("plugin_installations_community_plugin_idx").on(t.communityId, t.pluginId)],
);

/**
 * Magazyn dokumentów wtyczek (ctx.storage). Zawsze filtrowany po installation_id.
 * Klucz główny (instalacja, kolekcja, id): id generuje host (create) albo podaje wtyczka (upsert).
 */
export const pluginDocs = sqliteTable(
  "plugin_docs",
  {
    id: text("id").notNull(),
    installationId: text("installation_id")
      .notNull()
      .references(() => pluginInstallations.id, { onDelete: "cascade" }),
    collection: text("collection").notNull(),
    data: text("data", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    primaryKey({ columns: [t.installationId, t.collection, t.id] }),
    index("plugin_docs_installation_collection_idx").on(t.installationId, t.collection, t.createdAt),
  ],
);

/**
 * Pliki wtyczek (ctx.files). Upload tworzy plik "pending" przypisany do użytkownika i instalacji;
 * wtyczka zatwierdza go przez ctx.files.keep(). Niezatwierdzone są usuwane po 24 h.
 */
export const pluginFiles = sqliteTable(
  "plugin_files",
  {
    id: text("id").primaryKey(),
    installationId: text("installation_id")
      .notNull()
      .references(() => pluginInstallations.id, { onDelete: "cascade" }),
    uploadedBy: text("uploaded_by").references(() => user.id, { onDelete: "set null" }),
    status: text("status", { enum: ["pending", "kept"] })
      .notNull()
      .default("pending"),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    ...timestamps,
  },
  (t) => [index("plugin_files_status_created_idx").on(t.status, t.createdAt)],
);

/** Kod wtyczek wgranych w locie (POST /api/admin/plugins); ładowane ponownie po restarcie. */
export const pluginSources = sqliteTable("plugin_sources", {
  pluginId: text("plugin_id").primaryKey(),
  version: text("version").notNull(),
  source: text("source").notNull(),
  ...timestamps,
});

/** Wszystkie tabele (reset testowy: DELETE FROM każdej). Nową tabelę dopisz tutaj. */
export const allTables = {
  user,
  session,
  account,
  verification,
  communities,
  memberships,
  pluginInstallations,
  pluginDocs,
  pluginFiles,
  pluginSources,
};
