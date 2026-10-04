import type { GeoPoint, PluginCommunity, Role } from "@app/plugin-sdk";
import { type BoundQuery, GeometryPoint, RecordId, surql } from "surrealdb";
import type { Db } from "./client";
import { TABLES } from "./schema";

/** Rows returned by the last statement of a SurrealQL query (always written with the `surql` tag). */
export async function rows<T>(db: Db, query: BoundQuery): Promise<T[]> {
  return ((await db.query(query)) as unknown[]).at(-1) as T[];
}

/** First row of the last statement, or undefined. */
export const first = async <T>(db: Db, query: BoundQuery): Promise<T | undefined> => (await rows<T>(db, query))[0];

/** Record id of a platform table from its key (the string ids the API and plugins use). */
export const ref = (table: keyof typeof TABLES, key: string) => new RecordId(TABLES[table], key);

/** The string key of a record id (`community:abc` → `abc`). */
export const keyOf = (id: RecordId) => String(id.id);

/** A point for SurrealDB (GeoJSON order: longitude, latitude). */
export const geoPoint = ({ lat, lng }: GeoPoint) => new GeometryPoint([lng, lat]);

/** A point read from SurrealDB, as the app and plugins use it. */
export const fromGeoPoint = ({ coordinates: [lng, lat] }: GeometryPoint): GeoPoint => ({ lat, lng });

/**
 * Compares names in Polish alphabetical order (L before Ł before M). Rows sorted by a field of a linked record are
 * sorted with it in code: SurrealDB 3 ignores `ORDER BY` on such a field (`community.name AS name … ORDER BY name`).
 */
export const polishOrder = new Intl.Collator("pl").compare;

/** SurrealDB returns its own DateTime type; the app and plugins get a plain Date. */
export const toDate = (at: Date | { toDate(): Date }) => (at instanceof Date ? at : at.toDate());

/** Membership record id: one per (community, user), so joining and granting roles are single UPSERTs. */
export const membershipRef = (communityId: string, userId: string) =>
  new RecordId(TABLES.membership, [ref("community", communityId), ref("user", userId)]);

/** Visit record id: one per (installation, user), updated on every view render. */
export const visitRef = (installationId: string, userId: string) =>
  new RecordId(TABLES.visit, [ref("installation", installationId), ref("user", userId)]);

/** The user's role in a community, or null when the user is not a member. Never creates a membership. */
export async function memberRole(db: Db, communityId: string, userId: string): Promise<Role | null> {
  const row = await first<{ role: Role }>(db, surql`SELECT role FROM ${membershipRef(communityId, userId)};`);
  return row?.role ?? null;
}

/** `location` only where the query selects it (communityBySlug does). */
export type CommunityRow = { id: RecordId; slug: string; name: string; location?: GeometryPoint };

export const toCommunity = (row: CommunityRow) => ({ id: keyOf(row.id), slug: row.slug, name: row.name });

/** The community as a plugin sees it (`ctx.community`): with its pin, for plugin maps. */
export const toPluginCommunity = (row: CommunityRow): PluginCommunity => ({
  ...toCommunity(row),
  location: row.location ? fromGeoPoint(row.location) : null,
});

export const communityBySlug = (db: Db, slug: string) =>
  first<CommunityRow>(db, surql`SELECT id, slug, name, location FROM community WHERE slug = ${slug};`);
