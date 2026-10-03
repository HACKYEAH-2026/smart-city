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
 * Public places all over Kraków for the map of places in local dev, so it is not a single pin. No members and no
 * plugins: a pin with a card. The pins are a hexagonal grid 3.1 km apart inside Kraków's OpenStreetMap boundary
 * (Nominatim), anchored at the demo place (its grid point is the demo place itself: 40 pins in all). Each is named
 * after its OpenStreetMap district or neighbourhood, with the nearest address (Photon).
 */
export const DEMO_MAP_PLACES = [
  mapPlace("sidzina", "Sidzina", "estate", "Chlebiczna 3a, 30-399 Kraków", 49.98718, 19.873),
  mapPlace("opatkowice", "Opatkowice", "estate", "Poronińska 13, 30-498 Kraków", 49.98718, 19.91617),
  mapPlace("swoszowice", "Swoszowice", "district", "Dróżka 38, 30-327 Kraków", 49.98718, 19.95933),
  mapPlace("barycz", "Barycz", "estate", "Romana Żelazowskiego 57, 30-694 Kraków", 49.98718, 20.0025),
  mapPlace("tyniec", "Tyniec", "estate", "Walgierza Wdałego 7, 30-398 Kraków", 50.01135, 19.80825),
  mapPlace("skotniki", "Skotniki", "estate", "Kozienicka, 30-050 Kraków", 50.01135, 19.85142),
  mapPlace("kobierzyn", "Kobierzyn", "estate", "Zamiejska 21b, 30-382 Kraków", 50.01135, 19.89458),
  mapPlace("lagiewniki", "Łagiewniki-Borek Fałęcki", "district", "Totus Tuus, 30-608 Kraków", 50.01135, 19.93775),
  mapPlace("podgorze-duchackie", "Podgórze Duchackie", "district", "Mokra 7, 30-690 Kraków", 50.01135, 19.98092),
  mapPlace("nowy-biezanow", "Nowy Bieżanów", "estate", "Mała Góra 57, 30-864 Kraków", 50.01135, 20.02408),
  mapPlace(
    "biezanow-prokocim",
    "Bieżanów-Prokocim",
    "district",
    "Czarnochowicka 133, 30-789 Kraków",
    50.01135,
    20.06725,
  ),
  mapPlace("kostrze", "Kostrze", "estate", "Kolna, Kraków", 50.03551, 19.82983),
  mapPlace("bodzow", "Bodzów", "estate", "Tyniecka, 30-376 Kraków", 50.03551, 19.873),
  mapPlace("zakrzowek", "Zakrzówek", "other", "Świętego Jacka 61, 30-364 Kraków", 50.03551, 19.91617),
  mapPlace("podgorze", "Podgórze", "district", "Wapienna, 30-544 Kraków", 50.03551, 19.95933),
  mapPlace(
    "mierzeja-wislana-6b",
    "Mierzeja Wiślana 6B",
    "building",
    "Mierzeja Wiślana 6B, 30-752 Kraków",
    50.03551,
    20.0025,
  ),
  mapPlace("rybitwy", "Rybitwy", "company", "Półłanki, 30-742 Kraków", 50.03551, 20.04567),
  mapPlace("las-wolski", "Las Wolski", "other", "Wolski Dół, 30-232 Kraków", 50.05967, 19.85142),
  mapPlace("zwierzyniec", "Zwierzyniec", "district", "Królowej Jadwigi, 30-212 Kraków", 50.05967, 19.89458),
  mapPlace("grzegorzki", "Grzegórzki", "district", "Widok 19, 31-564 Kraków", 50.05967, 19.98092),
  mapPlace("czyzyny", "Czyżyny", "district", "Longinusa Podbipięty, 31-589 Kraków", 50.05967, 20.02408),
  mapPlace("mogila", "Mogiła", "estate", "Stanisława Samostrzelnika, 31-979 Kraków", 50.05967, 20.06725),
  mapPlace("pleszow", "Pleszów", "estate", "Suchy Jar 12, 31-983 Kraków", 50.05967, 20.11042),
  mapPlace("przylasek-rusiecki", "Przylasek Rusiecki", "other", "Rzepakowa, 31-989 Kraków", 50.05967, 20.15359),
  mapPlace("wolica", "Wolica", "estate", "Brzeska 12c, 31-998 Kraków", 50.05967, 20.19675),
  mapPlace("olszanica", "Olszanica", "estate", "Pięciu Stawów, Kraków", 50.08383, 19.82983),
  mapPlace("bronowice", "Bronowice", "district", "Pod Strzechą, 31-398 Kraków", 50.08383, 19.873),
  mapPlace("azory", "Osiedle Azory", "estate", "Piotra Stachiewicza 12, 31-303 Kraków", 50.08383, 19.91617),
  mapPlace("pradnik-czerwony", "Prądnik Czerwony", "district", "Gdańska 35, 31-411 Kraków", 50.08383, 19.95933),
  mapPlace("dywizjonu-303", "Osiedle Dywizjonu 303", "estate", "os. Dywizjonu 303, 31-872 Kraków", 50.08383, 20.0025),
  mapPlace("bienczyce", "Bieńczyce", "district", "Odmogile, 31-965 Kraków", 50.08383, 20.04567),
  mapPlace("kombinat", "Kombinat", "company", "Ujastek, 31-752 Kraków", 50.08383, 20.08884),
  mapPlace("nowa-huta", "Nowa Huta", "district", "Michała Badeniego, 31-987 Kraków", 50.08383, 20.132),
  mapPlace("koscielniki", "Kościelniki", "estate", "Andrzeja Waligórskiego, 31-999 Kraków", 50.08383, 20.17517),
  mapPlace("tonie", "Tonie", "estate", "Maciejkowa 48, 31-336 Kraków", 50.10799, 19.89458),
  mapPlace("witkowice", "Witkowice", "estate", "Zielone Wzgórze, 31-222 Kraków", 50.10799, 19.93775),
  mapPlace("kantorowice", "Kantorowice", "estate", "Stary Gościniec, 31-764 Kraków", 50.10799, 20.06725),
  mapPlace(
    "wzgorza-krzeslawickie",
    "Wzgórza Krzesławickie",
    "district",
    "Cypriana Godebskiego, 31-990 Kraków",
    50.10799,
    20.11042,
  ),
  mapPlace("wegrzynowice", "Węgrzynowice", "estate", "Węgrzynowicka, 31-992 Kraków", 50.10799, 20.15359),
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
 * Local dev only (idempotent): the public places of DEMO_MAP_PLACES. Not part of seedDemo, so /__test/reset (E2E)
 * and t.seed() keep the demo place alone on the map.
 */
export async function seedDemoMap(db: Db) {
  const places = DEMO_MAP_PLACES.map(({ lat, lng, ...place }) => ({
    ...place,
    location: geoPoint({ lat, lng }),
    on_map: true,
  }));
  // The seed owns the public places nobody belongs to: it replaces them, so a changed list moves or drops old pins.
  // Places with members are never touched (and keep their slug if the list has it too).
  await db.query(
    surql`DELETE community WHERE on_map AND id NOT IN (SELECT VALUE community FROM membership);
          INSERT IGNORE INTO community ${places};`,
  );
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
