import { t } from '@/strings';
import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';
import {
  DEFAULT_ROUTING_URL,
  DEFAULT_SEARCH_URL,
  DEFAULT_TILE_URL,
  DEFAULT_TRANSIT_URL,
  isHttpsUrl,
  isTileTemplate,
} from './logic';

export { DEFAULT_TILE_URL };

const schema = z.object({
  tileUrl: z.string(),
  searchUrl: z.string(),
  routingUrl: z.string(),
  transitUrl: z.string(),
});

export const settings: ModuleSettings = {
  schema,
  defaults: {
    tileUrl: DEFAULT_TILE_URL,
    searchUrl: DEFAULT_SEARCH_URL,
    routingUrl: DEFAULT_ROUTING_URL,
    transitUrl: DEFAULT_TRANSIT_URL,
  },
  keywords: [
    'karte',
    'kachel',
    'openstreetmap',
    'nominatim',
    'tile',
    'suche',
    'route',
    'osrm',
    'bahn',
    'bus',
    'transitous',
  ],
  fields: [
    {
      key: 'tileUrl',
      get label() {
        return t.maps.settings.tileUrl;
      },
      get help() {
        return t.maps.settings.tileUrlHelp;
      },
      type: 'text',
    },
    {
      key: 'searchUrl',
      get label() {
        return t.maps.settings.searchUrl;
      },
      get help() {
        return t.maps.settings.searchUrlHelp;
      },
      type: 'text',
    },
    {
      key: 'routingUrl',
      get label() {
        return t.maps.settings.routingUrl;
      },
      get help() {
        return t.maps.settings.routingUrlHelp;
      },
      type: 'text',
    },
    {
      key: 'transitUrl',
      get label() {
        return t.maps.settings.transitUrl;
      },
      get help() {
        return t.maps.settings.transitUrlHelp;
      },
      type: 'text',
    },
  ],
};

/** The addresses in use: a changed value that is not a safe https address falls back to the default. */
export function servicesOf(
  prefs:
    | { tileUrl?: unknown; searchUrl?: unknown; routingUrl?: unknown; transitUrl?: unknown }
    | undefined,
): {
  tileUrl: string;
  searchUrl: string;
  routingUrl: string;
  transitUrl: string;
} {
  const tile = typeof prefs?.tileUrl === 'string' ? prefs.tileUrl.trim() : '';
  const search = typeof prefs?.searchUrl === 'string' ? prefs.searchUrl.trim() : '';
  const routing = typeof prefs?.routingUrl === 'string' ? prefs.routingUrl.trim() : '';
  const transit = typeof prefs?.transitUrl === 'string' ? prefs.transitUrl.trim() : '';
  return {
    tileUrl: isTileTemplate(tile) ? tile : DEFAULT_TILE_URL,
    searchUrl: isHttpsUrl(search) ? search : DEFAULT_SEARCH_URL,
    routingUrl: isHttpsUrl(routing) ? routing : DEFAULT_ROUTING_URL,
    transitUrl: isHttpsUrl(transit) ? transit : DEFAULT_TRANSIT_URL,
  };
}
