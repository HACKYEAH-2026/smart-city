import { afterEach, describe, expect, test } from "bun:test";
import type { MyPlace, NotificationInbox } from "@app/shared";
import { surql } from "surrealdb";
import { DEMO_ARENA, DEMO_ARENA_ADMIN, seedDemoContent } from "../src/test-demo";
import { DEMO_COMMUNITY, DEMO_RESIDENT, seedDemoResident } from "../src/test-routes";
import { type Ctx, setup } from "./helpers";

/** The local demo (apps/api/src/test-demo.ts): the people, Kraków's and the Tauron Arena's content. */
let t: Ctx;
afterEach(async () => {
  await t.close();
});

/** The demo as the dev API seeds it; the Kraków admin's session and the seed's dependencies. */
const seedAll = async () => {
  const { admin } = await t.seed();
  const deps = { db: t.db, auth: t.auth, plugins: t.plugins, files: t.files };
  await seedDemoResident(deps);
  await seedDemoContent(deps);
  return { admin, deps };
};

/** How many rows the demo writes: platform tables and the plugins' own tables (`p_<plugin>__<table>`). */
const counts = async () => {
  const [result] = await t.db.query<[Record<string, number>]>(
    surql`RETURN {
            users: count((SELECT id FROM user)),
            memberships: count((SELECT id FROM membership)),
            notifications: count((SELECT id FROM notification)),
            issues: count((SELECT id FROM p_issues__issues)),
            votes: count((SELECT id FROM p_issues__votes)),
            comments: count((SELECT id FROM p_issues__comments)),
            photos: count((SELECT id FROM p_issues__photos)),
            announcements: count((SELECT id FROM p_announcements__announcements)),
            discussions: count((SELECT id FROM p_discussions__discussions)),
            messages: count((SELECT id FROM p_discussions__messages))
          };`,
  );
  return result;
};

describe("dev demo content", () => {
  test("Kraków and the Tauron Arena get their content once: a second run adds nothing", async () => {
    t = await setup();
    const { deps } = await seedAll();
    const seeded = await counts();
    expect(seeded).toMatchObject({ issues: 21, announcements: 14, discussions: 10, photos: 2, votes: 181 });

    await seedDemoContent(deps);
    expect(await counts()).toEqual(seeded);
  });

  test("Anna: Kraków by default, a member of the arena, told that the arena answered and closed her report", async () => {
    t = await setup();
    await seedAll();
    const anna = await t.signIn(DEMO_RESIDENT);

    const places = (await (await t.request("/api/communities", { headers: anna.headers })).json()) as MyPlace[];
    expect(places.find((p) => p.isDefault)?.slug).toBe(DEMO_COMMUNITY.slug);
    expect(places.find((p) => p.slug === DEMO_ARENA.slug)).toMatchObject({ role: "user", isDefault: false });

    const inbox = (await (
      await t.request("/api/me/notifications", { headers: anna.headers })
    ).json()) as NotificationInbox;
    const unread = inbox.items.filter((n) => !n.read).map((n) => `${n.title}: ${n.body}`);
    expect(unread).toEqual([
      "Zgłoszenie zamknięte: Zimno w strefie ciszy",
      expect.stringMatching(/^Administrator odpowiedział na zgłoszenie: Zimno w strefie ciszy: /),
    ]);
  });

  test("both places render for a member and for their admin: the widgets, every list and the admin panel", async () => {
    t = await setup();
    const { admin } = await seedAll();
    const anna = await t.signIn(DEMO_RESIDENT);
    const arenaAdmin = await t.signIn(DEMO_ARENA_ADMIN);
    const lists = (slug: string) =>
      ["announcements", "issues", "discussions"].map(
        (plugin) => `/api/communities/${slug}/plugins/${plugin}/views/list`,
      );
    const adminPanel = (slug: string) => `/api/communities/${slug}/plugins/issues/views/admin`;
    const visits = [
      ...[DEMO_COMMUNITY.slug, DEMO_ARENA.slug].flatMap((slug) => lists(slug).map((path) => ({ path, as: anna }))),
      { path: adminPanel(DEMO_COMMUNITY.slug), as: admin },
      { path: adminPanel(DEMO_ARENA.slug), as: arenaAdmin },
    ];
    const failed = await Promise.all(
      visits.map(async ({ path, as }) => ({ path, status: (await t.request(path, { headers: as.headers })).status })),
    );
    expect(failed.filter((v) => v.status !== 200)).toEqual([]);

    // A widget that fails is left out of the dashboard, so all three must be there.
    const dashboards = [
      { slug: DEMO_COMMUNITY.slug, as: anna },
      { slug: DEMO_ARENA.slug, as: anna },
      { slug: DEMO_COMMUNITY.slug, as: admin },
      { slug: DEMO_ARENA.slug, as: arenaAdmin },
    ];
    const widgets = await Promise.all(
      dashboards.map(async ({ slug, as }) => {
        const res = await t.request(`/api/communities/${slug}/dashboard`, { headers: as.headers });
        return ((await res.json()) as { widgets: unknown[] }).widgets.length;
      }),
    );
    // Kraków (every built-in plugin) and the Tauron Arena (three plugins), each for a member and for its admin.
    expect(widgets).toEqual([10, 3, 10, 3]);
  });
});
