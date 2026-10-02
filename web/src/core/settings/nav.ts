/** Navigation preferences (synced scope `nav`): the user's favourite modules in the sidebar. */
import { z } from 'zod';
import { MAX_FAVOURITES } from '@/core/modules/areas';
import { getSettings, setSettings, useSettings } from './settings';

export const NAV_SCOPE = 'nav';

export const navSettingsSchema = z.object({
  /** Module ids in display order; unset = the defaults of `DEFAULT_FAVOURITES`. */
  favourites: z.array(z.string()).max(MAX_FAVOURITES).optional(),
});

/** Stored favourites; `ready` is false while the setting is loading, `stored` unset = defaults. */
export function useStoredFavourites(): { ready: boolean; stored?: string[] } {
  const [values] = useSettings(NAV_SCOPE, navSettingsSchema, {});
  return { ready: values !== undefined, stored: values?.favourites };
}

/** Adds or removes `id`; adding beyond `MAX_FAVOURITES` is refused (returns `current` as is). */
export function toggleFavourite(current: readonly string[], id: string): string[] {
  if (current.includes(id)) return current.filter((x) => x !== id);
  return current.length >= MAX_FAVOURITES ? [...current] : [...current, id];
}

/**
 * Toggles a favourite. `shown` is what the user currently sees (stored or default, already
 * filtered to enabled modules), so the first tap on a default list starts from that list.
 */
export async function setFavourite(id: string, shown: readonly string[]): Promise<boolean> {
  const next = toggleFavourite(shown, id);
  if (next.length === shown.length && next.every((x, i) => x === shown[i])) return false;
  await setSettings(NAV_SCOPE, { favourites: next });
  return true;
}

export async function readFavourites(): Promise<string[] | undefined> {
  return (await getSettings(NAV_SCOPE, navSettingsSchema, {})).favourites;
}
