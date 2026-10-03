import {
  type GeoAddress,
  geoReverseSchema,
  geoSearchSchema,
  type JoinRule,
  type MapPlace,
  type PlaceKind,
} from "@app/shared";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { type GeometryPoint, type RecordId, surql } from "surrealdb";
import type { AppEnv } from "../context";
import { fromGeoPoint, keyOf, ref, rows } from "../db";
import { requireUser } from "../middleware";

type MapRow = {
  id: RecordId;
  slug: string;
  name: string;
  kind: PlaceKind | null;
  address: string | null;
  join_rule: JoinRule | null;
  location: GeometryPoint;
  member: boolean;
};

/** The geocoder's answer, or null when the provider failed (network, outage): the app then lets the user pin by hand. */
const attempt = <T>(call: () => Promise<T>): Promise<{ value: T } | null> =>
  call().then(
    (value) => ({ value }),
    (error) => {
      console.error("geocoder:", error);
      return null;
    },
  );

const toMapPlace = (row: MapRow): MapPlace => ({
  id: keyOf(row.id),
  name: row.name,
  kind: row.kind ?? "other",
  address: row.address ?? "",
  joinRule: row.join_rule ?? "approval",
  ...fromGeoPoint(row.location),
  slug: row.member ? row.slug : null,
});

/**
 * Maps for signed-in users: finding addresses for a place's pin (search and the address at a point, via the
 * geocoder) and the map of places. The map shows the places their admins put on it and the user's own places that
 * have a location; only members learn a place's slug (non-members get 404 inside it anyway).
 */
export const geoRoutes = new Hono<AppEnv>()
  .use(requireUser)
  .get("/search", zValidator("query", geoSearchSchema), async (c) => {
    const { q, lat, lng } = c.req.valid("query");
    const near = lat !== undefined && lng !== undefined ? { lat, lng } : undefined;
    const found = await attempt(() => c.var.geocoder.search(q, near));
    if (!found) return c.json({ error: "geocoder_unavailable" }, 502);
    return c.json(found.value satisfies GeoAddress[], 200);
  })
  .get("/reverse", zValidator("query", geoReverseSchema), async (c) => {
    const found = await attempt(() => c.var.geocoder.reverse(c.req.valid("query")));
    if (!found) return c.json({ error: "geocoder_unavailable" }, 502);
    return c.json({ address: found.value satisfies GeoAddress | null }, 200);
  })
  .get("/places", async (c) => {
    const found = await rows<MapRow>(
      c.var.db,
      surql`LET $mine = (SELECT VALUE community FROM membership WHERE user = ${ref("user", c.var.user.id)});
            SELECT id, slug, name, kind, address, join_rule, location, id INSIDE $mine AS member FROM community
             WHERE location IS NOT NONE AND (on_map OR id INSIDE $mine) ORDER BY name;`,
    );
    return c.json(found.map(toMapPlace), 200);
  });
