import { z } from 'zod';

export const PLACE_CATEGORIES = ['home', 'work', 'shop', 'health', 'leisure', 'other'] as const;
export type PlaceCategory = (typeof PLACE_CATEGORIES)[number];

export const ROUTE_MODES = ['walk', 'bike', 'car', 'transit'] as const;
export type RouteMode = (typeof ROUTE_MODES)[number];

const lat = z.number().min(-90).max(90);
const lon = z.number().min(-180).max(180);

/** One end of a route: copied from a place or a search hit, so a deleted place never breaks a route. */
export const endpointSchema = z.object({
  label: z.string().min(1),
  lat,
  lon,
});
export type Endpoint = z.output<typeof endpointSchema>;

/** A saved place. Coordinates in decimal degrees (WGS 84). */
export const placeSchema = z.object({
  name: z.string().min(1),
  lat,
  lon,
  address: z.string().optional(),
  note: z.string().optional(),
  category: z.enum(PLACE_CATEGORIES).default('other'),
  pinned: z.boolean().default(false),
});
export type Place = z.output<typeof placeSchema>;

/** A route used often: from, optional stops, to and how you travel. Opened in the map or an app of your choice. */
export const routeSchema = z.object({
  name: z.string().min(1),
  mode: z.enum(ROUTE_MODES).default('walk'),
  from: endpointSchema,
  to: endpointSchema,
  via: z.array(endpointSchema).max(3).default([]),
  note: z.string().optional(),
  pinned: z.boolean().default(false),
});
export type Route = z.output<typeof routeSchema>;
