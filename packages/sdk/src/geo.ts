import { z } from "zod";

/** A point on the map (WGS 84 degrees), e.g. where a resident saw a boar. */
export const geoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type GeoPoint = z.infer<typeof geoPointSchema>;

/**
 * A place picked in the app (`ui.locationInput`): the point and its address as the geocoder found it, e.g.
 * "Floriańska 15, 31-019 Kraków" ("" = a point without a known address). This is what a form sends to its tool.
 */
export const geoLocationSchema = geoPointSchema.extend({ address: z.string().trim().max(200).default("") });
export type GeoLocation = z.output<typeof geoLocationSchema>;

/** Tool input for a `ui.locationInput` field: `input: z.object({ where: geoLocation().optional() })`. */
export const geoLocation = () => geoLocationSchema;
