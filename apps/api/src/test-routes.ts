import type { NavigateAction } from "@app/plugin-sdk";
import type { JoinRule, PlaceKind } from "@app/shared";
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
 * Public places of Kraków for the map of places in local dev, so it is not a single pin: universities, offices,
 * libraries, culture, parks, hospitals… (40 pins with the demo place at the city hall). No members and no plugins: a
 * pin with a card. Names, addresses and points from OpenStreetMap (looked up once with Photon and Nominatim).
 */
export const DEMO_MAP_PLACES = [
  mapPlace("uj", "Uniwersytet Jagielloński", "school", "Gołębia 24, 31-007 Kraków", 50.06086, 19.93324),
  mapPlace("agh", "Akademia Górniczo-Hutnicza", "school", "al. Adama Mickiewicza 30, 30-059 Kraków", 50.06603, 19.9222),
  mapPlace("politechnika", "Politechnika Krakowska", "school", "Warszawska 24, 31-155 Kraków", 50.07187, 19.94212),
  mapPlace("urzad-wojewodzki", "Małopolski Urząd Wojewódzki", "other", "Basztowa 22, 31-156 Kraków", 50.06552, 19.9431),
  mapPlace(
    "urzad-marszalkowski",
    "Urząd Marszałkowski Województwa Małopolskiego",
    "other",
    "Racławicka 56, 30-017 Kraków",
    50.08016,
    19.92101,
  ),
  mapPlace(
    "umk-nowa-huta",
    "Urząd Miasta Krakowa, os. Zgody",
    "other",
    "os. Zgody 2, 31-949 Kraków",
    50.07691,
    20.03189,
  ),
  mapPlace("umk-wielicka", "Urząd Miasta Krakowa, ul. Wielicka", "other", "Wielicka 28a, Kraków", 50.03879, 19.96637),
  mapPlace("sad-okregowy", "Sąd Okręgowy w Krakowie", "other", "Przy Rondzie 7, 31-547 Kraków", 50.06374, 19.96228),
  mapPlace(
    "biblioteka-jagiellonska",
    "Biblioteka Jagiellońska",
    "other",
    "al. Adama Mickiewicza 22, 30-059 Kraków",
    50.06144,
    19.9225,
  ),
  mapPlace("wbp", "Wojewódzka Biblioteka Publiczna", "other", "Rajska 1, 31-124 Kraków", 50.06495, 19.92944),
  mapPlace(
    "biblioteka-piaski-nowe",
    "Biblioteka Kraków, Piaski Nowe",
    "other",
    "Łużycka 55, 30-658 Kraków",
    50.01288,
    19.97236,
  ),
  mapPlace("biblioteka-olsza", "Biblioteka Kraków, Olsza", "other", "Bosaków 11, 31-476 Kraków", 50.08435, 19.96327),
  mapPlace("wawel", "Zamek Królewski na Wawelu", "other", "Wawel 5, 31-001 Kraków", 50.05441, 19.93602),
  mapPlace("muzeum-narodowe", "Muzeum Narodowe w Krakowie", "other", "al. 3 Maja 1, 30-062 Kraków", 50.06044, 19.92361),
  mapPlace(
    "teatr-slowackiego",
    "Teatr im. Juliusza Słowackiego",
    "other",
    "pl. Świętego Ducha 1, 31-023 Kraków",
    50.06395,
    19.94307,
  ),
  mapPlace("opera", "Opera Krakowska", "other", "Lubicz 48, 31-512 Kraków", 50.06593, 19.95619),
  mapPlace("ice", "Centrum Kongresowe ICE Kraków", "other", "Marii Konopnickiej 17, 30-302 Kraków", 50.04795, 19.93146),
  mapPlace("nck", "Nowohuckie Centrum Kultury", "other", "al. Jana Pawła II 232, Kraków", 50.07077, 20.03484),
  mapPlace(
    "fabryka-schindlera",
    "Fabryka Emalia Oskara Schindlera",
    "other",
    "Lipowa 4, 30-702 Kraków",
    50.04746,
    19.96171,
  ),
  mapPlace(
    "muzeum-lotnictwa",
    "Muzeum Lotnictwa Polskiego",
    "other",
    "al. Jana Pawła II 39, 31-864 Kraków",
    50.07709,
    19.98984,
  ),
  mapPlace("rynek-glowny", "Rynek Główny", "other", "Rynek Główny, Kraków", 50.0615, 19.93711),
  mapPlace("blonia", "Błonia", "other", "al. 3 Maja, Kraków", 50.05967, 19.91144),
  mapPlace(
    "kopiec-kosciuszki",
    "Kopiec Kościuszki",
    "other",
    "al. Jerzego Waszyngtona 1, 30-204 Kraków",
    50.05492,
    19.89335,
  ),
  mapPlace(
    "zoo",
    "Ogród Zoologiczny w Krakowie",
    "other",
    "al. Kasy Oszczędności Miasta Krakowa 14, 30-232 Kraków",
    50.05351,
    19.84951,
  ),
  mapPlace(
    "ogrod-botaniczny",
    "Ogród Botaniczny UJ",
    "other",
    "Mikołaja Kopernika 27, 31-501 Kraków",
    50.06237,
    19.95805,
  ),
  mapPlace("plac-centralny", "Plac Centralny", "other", "pl. Centralny, Kraków", 50.07146, 20.03781),
  mapPlace("zalew-nowohucki", "Zalew Nowohucki", "other", "Bulwarowa, Kraków", 50.07901, 20.05268),
  mapPlace("kopiec-krakusa", "Kopiec Krakusa", "other", "Stare Podgórze, Kraków", 50.03808, 19.95844),
  mapPlace("zakrzowek", "Park Zakrzówek", "other", "Wyłom, 30-373 Kraków", 50.03698, 19.91105),
  mapPlace(
    "szpital-uniwersytecki",
    "Szpital Uniwersytecki",
    "other",
    "Macieja Jakubowskiego 2, 30-688 Kraków",
    50.00822,
    20.00038,
  ),
  mapPlace(
    "szpital-zeromskiego",
    "Szpital im. Stefana Żeromskiego",
    "other",
    "os. Na Skarpie 66, 31-913 Kraków",
    50.06515,
    20.04631,
  ),
  mapPlace(
    "szpital-jana-pawla",
    "Szpital im. Jana Pawła II",
    "other",
    "Prądnicka 80, 31-202 Kraków",
    50.09009,
    19.93568,
  ),
  mapPlace(
    "szpital-rydygiera",
    "Szpital im. Ludwika Rydygiera",
    "other",
    "os. Złotej Jesieni 1, 31-826 Kraków",
    50.09308,
    20.01848,
  ),
  mapPlace(
    "dworzec-glowny",
    "Dworzec Kraków Główny",
    "other",
    "św. Rafała Kalinowskiego, 31-154 Kraków",
    50.06842,
    19.94789,
  ),
  mapPlace("tauron-arena", "Tauron Arena Kraków", "other", "Stanisława Lema 7, 31-571 Kraków", 50.06772, 19.99155),
  mapPlace("stary-kleparz", "Stary Kleparz", "other", "Rynek Kleparski 20, 31-150 Kraków", 50.06738, 19.94109),
  mapPlace("park-wodny", "Park Wodny", "other", "Dobrego Pasterza 126, 31-478 Kraków", 50.08889, 19.98279),
  mapPlace(
    "lagiewniki",
    "Sanktuarium Bożego Miłosierdzia",
    "other",
    "Siostry Faustyny 3, 30-420 Kraków",
    50.01997,
    19.9376,
  ),
  mapPlace("tyniec", "Opactwo Benedyktynów w Tyńcu", "other", "Benedyktyńska 37, 30-398 Kraków", 50.01845, 19.8029),
];

/** A resident of Kraków in local dev: a plain member of the city (the default place), a campus and a cooperative. */
export const DEMO_RESIDENT = { email: "anna@krakow.test", password: "password", name: "Anna Nowak" } as const;

type ResidentPlace = {
  slug: string;
  name: string;
  kind: PlaceKind;
  address: string;
  description: string;
  join_rule: JoinRule;
  invite_code: string;
  on_map: boolean;
  lat: number;
  lng: number;
  /** Built-in plugins enabled in the place, in this order (its navigation). */
  pluginIds: string[];
};
/**
 * DEMO_RESIDENT's places besides Kraków: the campus and the housing cooperative of the demo video's ads, each with
 * only the plugins it needs. Made-up places on real addresses (points from Nominatim). The campus is on the map of
 * places for everyone; the cooperative only for its members.
 */
export const DEMO_RESIDENT_PLACES: ResidentPlace[] = [
  {
    slug: "kampus-glowny",
    name: "Kampus Główny",
    kind: "school",
    address: "prof. Stanisława Łojasiewicza 11, 30-348 Kraków",
    description: "Ogłoszenia uczelni i dyskusje studentów.",
    join_rule: "open",
    invite_code: "KMPGLW",
    on_map: true,
    lat: 50.02907,
    lng: 19.90491,
    pluginIds: ["announcements", "discussions"],
  },
  {
    slug: "spoldzielnia-sloneczna",
    name: "Spółdzielnia Słoneczna",
    kind: "estate",
    address: "os. Słoneczne 1, 31-956 Kraków",
    description: "Zgłoszenia usterek w budynkach i ogłoszenia administracji osiedla.",
    join_rule: "open",
    invite_code: "SLNCZN",
    on_map: false,
    lat: 50.07679,
    lng: 20.03974,
    pluginIds: ["issues", "announcements"],
  },
];

type Deps = { db: Db; auth: Auth; plugins: PluginHost };

const userIdByEmail = async (db: Db, email: string) =>
  (await first<{ id: RecordId }>(db, surql`SELECT id FROM user WHERE email = ${email};`))?.id;

/** The id of a seeded account: signed up on the first run, found by its email after that. */
async function seedAccount({ db, auth }: Deps, account: { email: string; password: string; name: string }) {
  const existing = await userIdByEmail(db, account.email);
  return existing ? keyOf(existing) : (await auth.api.signUpEmail({ body: { ...account } })).user.id;
}

async function seededCommunity(db: Db, slug: string) {
  const row = await communityBySlug(db, slug);
  if (!row) throw new Error(`seed: community ${slug} missing`);
  return toCommunity(row);
}

function builtinPlugin(plugins: PluginHost, id: string) {
  const plugin = plugins.get(id);
  if (plugin?.origin !== "builtin") throw new Error(`seed: no built-in plugin ${id}`);
  return plugin;
}

/**
 * Dev/E2E seed data (idempotent): a demo community with built-in plugins (with onInstall)
 * and a community admin account.
 */
export async function seedDemo(deps: Deps) {
  const { db, plugins } = deps;
  const data = { ...DEMO_COMMUNITY, kind: "district", join_rule: "open", invite_code: DEMO_INVITE_CODE };
  await db.query(surql`INSERT IGNORE INTO community ${data};`);
  // Also for a dev database seeded before places had a location.
  await db.query(
    surql`UPDATE community SET address = ${DEMO_ADDRESS}, location = ${geoPoint(DEMO_LOCATION)}, on_map = true
           WHERE slug = ${DEMO_COMMUNITY.slug} AND location IS NONE;`,
  );
  const community = await seededCommunity(db, DEMO_COMMUNITY.slug);
  await plugins.ready();
  for (const plugin of plugins.list().filter((p) => p.origin === "builtin")) await plugins.enable(plugin, community);

  const adminId = await seedAccount(deps, DEMO_ADMIN);
  await db.query(
    surql`UPSERT ${membershipRef(community.id, adminId)}
          MERGE { community: ${ref("community", community.id)}, user: ${ref("user", adminId)}, role: "admin" };`,
  );
}

/**
 * Local dev only (idempotent, after seedDemo): DEMO_RESIDENT, a plain member of Kraków (the default place) and of the
 * DEMO_RESIDENT_PLACES, with their plugins. Not part of seedDemo, so /__test/reset (E2E) keeps Kraków the only
 * place. Memberships are only created, never reset: the resident's later role or default place survives a restart.
 */
export async function seedDemoResident(deps: Deps) {
  const { db, plugins } = deps;
  const places = DEMO_RESIDENT_PLACES.map(({ lat, lng, pluginIds: _, ...place }) => ({
    ...place,
    location: geoPoint({ lat, lng }),
  }));
  await db.query(surql`INSERT IGNORE INTO community ${places};`);
  await plugins.ready();
  for (const place of DEMO_RESIDENT_PLACES) {
    const community = await seededCommunity(db, place.slug);
    // One after another: the place's navigation lists plugins in the order they were enabled.
    for (const id of place.pluginIds) await plugins.enable(builtinPlugin(plugins, id), community);
  }

  const residentId = await seedAccount(deps, DEMO_RESIDENT);
  const slugs = [DEMO_COMMUNITY.slug, ...DEMO_RESIDENT_PLACES.map((p) => p.slug)];
  const communities = await Promise.all(slugs.map((slug) => seededCommunity(db, slug)));
  const memberships = communities.map((community) => ({
    id: membershipRef(community.id, residentId),
    community: ref("community", community.id),
    user: ref("user", residentId),
    role: "user",
    is_default: community.slug === DEMO_COMMUNITY.slug,
  }));
  await db.query(surql`INSERT IGNORE INTO membership ${memberships};`);
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
      /** The demo resident with her campus and cooperative, as the dev API seeds them on start (dev login E2E). */
      .post("/__test/resident", async (c) => {
        await seedDemoResident(deps);
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
      /** A notification from a plugin of a place in a user's inbox, as ctx.notify stores it (no push). */
      .post("/__test/notification", async (c) => {
        const { email, slug, pluginId, ...notification } = await c.req.json<{
          email: string;
          slug: string;
          pluginId: string;
          title: string;
          body: string;
          open?: NavigateAction;
        }>();
        const user = await userIdByEmail(deps.db, email);
        const community = await communityBySlug(deps.db, slug);
        const installation = community
          ? await first<{ id: RecordId }>(
              deps.db,
              surql`SELECT id FROM plugin_installation WHERE community = ${community.id} AND plugin = ${pluginId};`,
            )
          : undefined;
        if (!user || !community || !installation) return c.json({ error: "not_found" }, 404);
        await deps.db.query(
          surql`CREATE notification CONTENT ${{
            ...notification,
            user,
            community: community.id,
            installation: installation.id,
            plugin: pluginId,
          }} RETURN NONE;`,
        );
        return c.json({ ok: true });
      })
  );
}
