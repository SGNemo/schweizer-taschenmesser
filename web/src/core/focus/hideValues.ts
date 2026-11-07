/**
 * "Werte ausblenden": device-local switch in `_meta` (never synced, never in a backup). Default off.
 * Money figures in widgets are replaced by a neutral placeholder while it is on (see `ui/SensitiveValue`).
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db/db';

export const HIDE_VALUES_KEY = 'focus.hideValues';

const meta = () => db.table<{ key: string; value: unknown }, string>('_meta');

export async function getHideValues(): Promise<boolean> {
  return (await meta().get(HIDE_VALUES_KEY))?.value === true;
}

export async function setHideValues(on: boolean): Promise<void> {
  if (on) await meta().put({ key: HIDE_VALUES_KEY, value: true });
  else await meta().delete(HIDE_VALUES_KEY);
}

/** Live value; `true` while loading, so a figure is never shown for a moment by mistake. */
export const useHideValues = (): boolean => useLiveQuery(getHideValues, [], true);
