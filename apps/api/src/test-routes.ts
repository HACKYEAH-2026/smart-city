import type { PlaceKind } from "@app/shared";
import { Hono } from "hono";
import { type RecordId, surql } from "surrealdb";
import type { Auth } from "./auth";
import {
  communityBySlug,
  DATABASE,
  type Db,
  first,
  geoPoint,
  keyOf,
  membershipRef,
  migrate,
  NAMESPACE,
  ref,
  toCommunity,
} from "./db";
import type { PluginHost } from "./plugins/host";
import { syncPluginTables } from "./services/db/service";

/**
 * Endpoints for tests and local dev only. Mounted only by test-server.ts with NODE_ENV=test.
 * Never import this file from production code.
 */
export const DEMO_COMMUNITY = { slug: "krakow", name: "Kraków" } as const;
/** The demo place's invite code (shown as "KRK-MST"); anyone with it may join (join rule "open"). */
export const DEMO_INVITE_CODE = "KRKMST";
export const DEMO_ADMIN = { email: "admin@krakow.test", password: "password", name: "Urząd Miasta" } as const;
/** The demo place on the map of places: Kraków's city hall. */
export const DEMO_ADDRESS = "pl. Wszystkich Świętych 3-4, 31-004 Kraków";
export const DEMO_LOCATION = { lat: 50.05967, lng: 19.93775 } as const;
const mapPlace = (slug: string, name: string, kind: PlaceKind, address: string, lat: number, lng: number) => ({
  slug,
  name,
  kind,
  address,
  lat,
  lng,
});
/**
 * More public places around Kraków for the map of places in local dev, so it is not a single pin. No members and no
 * plugins: a pin with a card. Points from OpenStreetMap (looked up with Photon).
 */
export const DEMO_MAP_PLACES = [
  mapPlace("nowa-huta", "Nowa Huta", "district", "pl. Centralny, Kraków", 50.07146, 20.03781),
  mapPlace("podgorze", "Podgórze", "district", "Rynek Podgórski, Kraków", 50.04422, 19.94921),
  mapPlace("kazimierz", "Kazimierz", "district", "pl. Nowy, Kraków", 50.05174, 19.94462),
  mapPlace("czyzyny", "Czyżyny", "district", "Czyżyny, Kraków", 50.06652, 20.00884),
  mapPlace("pradnik-bialy", "Prądnik Biały", "district", "Prądnik Biały, Kraków", 50.10357, 19.9536),
  mapPlace("bronowice", "Bronowice", "district", "Bronowice, Kraków", 50.08332, 19.86978),
  mapPlace("podwawelskie", "Osiedle Podwawelskie", "estate", "os. Podwawelskie, Kraków", 50.0438, 19.93043),
  mapPlace("ruczaj", "Osiedle Ruczaj", "estate", "ul. Ruczaj, Kraków", 50.02497, 19.90617),
  mapPlace("kamienica-dluga", "Kamienica przy Długiej", "building", "ul. Długa, Kraków", 50.06692, 19.93888),
  mapPlace("biurowiec-zablocie", "Biurowiec na Zabłociu", "company", "ul. Lipowa, Kraków", 50.04788, 19.96137),
  mapPlace("szkola-krowodrza", "Szkoła na Krowodrzy", "school", "Krowodrza, Kraków", 50.07088, 19.91656),
];

type Deps = { db: Db; auth: Auth; plugins: PluginHost };

const userIdByEmail = async (db: Db, email: string) =>
  (await first<{ id: RecordId }>(db, surql`SELECT id FROM user WHERE email = ${email};`))?.id;

/**
 * Dev/E2E seed data (idempotent): a demo community with built-in plugins (with onInstall)
 * and a community admin account.
 */
export async function seedDemo({ db, auth, plugins }: Deps) {
  const data = { ...DEMO_COMMUNITY, kind: "district", join_rule: "open", invite_code: DEMO_INVITE_CODE };
  await db.query(surql`INSERT IGNORE INTO community ${data};`);
  // Also for a dev database seeded before places had a location.
  await db.query(
    surql`UPDATE community SET address = ${DEMO_ADDRESS}, location = ${geoPoint(DEMO_LOCATION)}, on_map = true
           WHERE slug = ${DEMO_COMMUNITY.slug} AND location IS NONE;`,
  );
  const row = await communityBySlug(db, DEMO_COMMUNITY.slug);
  if (!row) throw new Error("seed: community missing");
  const community = toCommunity(row);
  await plugins.ready();
  for (const plugin of plugins.list().filter((p) => p.origin === "builtin")) await plugins.enable(plugin, community);

  const existing = await userIdByEmail(db, DEMO_ADMIN.email);
  const adminId = existing ? keyOf(existing) : (await auth.api.signUpEmail({ body: { ...DEMO_ADMIN } })).user.id;
  await db.query(
    surql`UPSERT ${membershipRef(community.id, adminId)}
          MERGE { community: ${ref("community", community.id)}, user: ${ref("user", adminId)}, role: "admin" };`,
  );
}

/**
 * Local dev only (idempotent): the public places of DEMO_MAP_PLACES. Not part of seedDemo, so /__test/reset and the
 * integration tests keep the demo place alone on the map.
 */
export async function seedDemoMap(db: Db) {
  const places = DEMO_MAP_PLACES.map(({ lat, lng, ...place }) => ({
    ...place,
    location: geoPoint({ lat, lng }),
    on_map: true,
  }));
  await db.query(surql`INSERT IGNORE INTO community ${places};`);
}

/**
 * Empties the database by switching the client to a new one (schema applied, tables of loaded plugins synced).
 * The old one is left in memory: `REMOVE DATABASE` makes Bun 1.4 crash on exit with @surrealdb/node 3.0.3.
 */
async function resetDb({ db, plugins }: Deps) {
  await db.use({ namespace: NAMESPACE, database: `${DATABASE}_${crypto.randomUUID().replaceAll("-", "")}` });
  await migrate(db);
  for (const plugin of plugins.list()) await syncPluginTables(db, plugin);
}

export function createTestRoutes(deps: Deps) {
  return (
    new Hono()
      .post("/__test/reset", async (c) => {
        await resetDb(deps);
        await seedDemo(deps);
        return c.json({ ok: true });
      })
      /** Invites an existing user to Kraków from its admin (the invitations screen shows it). */
      .post("/__test/invitation", async (c) => {
        const { email, slug } = await c.req.json<{ email: string; slug: string }>();
        const invitee = await first<{ id: RecordId }>(deps.db, surql`SELECT id FROM user WHERE email = ${email};`);
        const community = await communityBySlug(deps.db, slug);
        const admin = await userIdByEmail(deps.db, DEMO_ADMIN.email);
        if (!invitee || !community || !admin) return c.json({ error: "not_found" }, 404);
        await first(
          deps.db,
          surql`CREATE invitation CONTENT {
                  community: ${community.id}, user: ${invitee.id}, invited_by: ${admin}
                };`,
        );
        return c.json({ ok: true });
      })
      /** Adds an existing user to a place as a plain member (joining is a separate screen, not in the API yet). */
      .post("/__test/membership", async (c) => {
        const { email, slug } = await c.req.json<{ email: string; slug: string }>();
        const user = await first<{ id: RecordId }>(deps.db, surql`SELECT id FROM user WHERE email = ${email};`);
        const community = await communityBySlug(deps.db, slug);
        if (!user || !community) return c.json({ error: "not_found" }, 404);
        await first(
          deps.db,
          surql`UPSERT ${membershipRef(keyOf(community.id), keyOf(user.id))}
                MERGE { community: ${community.id}, user: ${user.id} };`,
        );
        return c.json({ ok: true });
      })
  );
}
