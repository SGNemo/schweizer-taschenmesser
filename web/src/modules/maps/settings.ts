import { t } from '@/strings';
import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';
import { DEFAULT_OVERPASS_URL } from './own/overpass';
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
  /** Own map only: nothing outside the built regions is loaded from the internet. */
  offlineOnly: z.boolean(),
  /** Overpass-compatible service the own map is built from. */
  overpassUrl: z.string(),
  /** The calm progress line under the map while a build runs. */
  showBuildProgress: z.boolean(),
});

export const settings: ModuleSettings = {
  schema,
  defaults: {
    tileUrl: DEFAULT_TILE_URL,
    searchUrl: DEFAULT_SEARCH_URL,
    routingUrl: DEFAULT_ROUTING_URL,
    transitUrl: DEFAULT_TRANSIT_URL,
    offlineOnly: false,
    overpassUrl: DEFAULT_OVERPASS_URL,
    showBuildProgress: true,
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
    'offline',
    'eigene karte',
    'overpass',
    'fortschritt',
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
    {
      key: 'offlineOnly',
      get label() {
        return t.maps.settings.offlineOnly;
      },
      get help() {
        return t.maps.settings.offlineOnlyHelp;
      },
      type: 'boolean',
    },
    {
      key: 'overpassUrl',
      get label() {
        return t.maps.settings.overpassUrl;
      },
      get help() {
        return t.maps.settings.overpassUrlHelp;
      },
      type: 'text',
    },
    {
      key: 'showBuildProgress',
      get label() {
        return t.maps.settings.showBuildProgress;
      },
      get help() {
        return t.maps.settings.showBuildProgressHelp;
      },
      type: 'boolean',
    },
  ],
};

/** Whether the calm progress line is shown under the map while an own map is built (default on). */
export const showBuildProgressOf = (prefs: { showBuildProgress?: unknown } | undefined): boolean =>
  prefs?.showBuildProgress !== false;

/** Whether the map may load online tiles outside the own regions. */
export const offlineOnlyOf = (prefs: { offlineOnly?: unknown } | undefined): boolean =>
  prefs?.offlineOnly === true;

/** The addresses in use: a changed value that is not a safe https address falls back to the default. */
export function servicesOf(
  prefs:
    | {
        tileUrl?: unknown;
        searchUrl?: unknown;
        routingUrl?: unknown;
        transitUrl?: unknown;
        overpassUrl?: unknown;
      }
    | undefined,
): {
  tileUrl: string;
  searchUrl: string;
  routingUrl: string;
  transitUrl: string;
  overpassUrl: string;
} {
  const tile = typeof prefs?.tileUrl === 'string' ? prefs.tileUrl.trim() : '';
  const search = typeof prefs?.searchUrl === 'string' ? prefs.searchUrl.trim() : '';
  const routing = typeof prefs?.routingUrl === 'string' ? prefs.routingUrl.trim() : '';
  const transit = typeof prefs?.transitUrl === 'string' ? prefs.transitUrl.trim() : '';
  const overpass = typeof prefs?.overpassUrl === 'string' ? prefs.overpassUrl.trim() : '';
  return {
    tileUrl: isTileTemplate(tile) ? tile : DEFAULT_TILE_URL,
    searchUrl: isHttpsUrl(search) ? search : DEFAULT_SEARCH_URL,
    routingUrl: isHttpsUrl(routing) ? routing : DEFAULT_ROUTING_URL,
    transitUrl: isHttpsUrl(transit) ? transit : DEFAULT_TRANSIT_URL,
    overpassUrl: isHttpsUrl(overpass) ? overpass : DEFAULT_OVERPASS_URL,
  };
}
