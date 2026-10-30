import { t } from '@/strings';
import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';
import { DEFAULT_SEARCH_URL, DEFAULT_TILE_URL, isHttpsUrl, isTileTemplate } from './logic';

export { DEFAULT_TILE_URL };

const schema = z.object({
  tileUrl: z.string(),
  searchUrl: z.string(),
});

export const settings: ModuleSettings = {
  schema,
  defaults: { tileUrl: DEFAULT_TILE_URL, searchUrl: DEFAULT_SEARCH_URL },
  keywords: ['karte', 'kachel', 'openstreetmap', 'nominatim', 'tile', 'suche'],
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
  ],
};

/** The addresses in use: a changed value that is not a safe https address falls back to the default. */
export function servicesOf(prefs: { tileUrl?: unknown; searchUrl?: unknown } | undefined): {
  tileUrl: string;
  searchUrl: string;
} {
  const tile = typeof prefs?.tileUrl === 'string' ? prefs.tileUrl.trim() : '';
  const search = typeof prefs?.searchUrl === 'string' ? prefs.searchUrl.trim() : '';
  return {
    tileUrl: isTileTemplate(tile) ? tile : DEFAULT_TILE_URL,
    searchUrl: isHttpsUrl(search) ? search : DEFAULT_SEARCH_URL,
  };
}
