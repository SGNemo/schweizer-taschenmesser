/**
 * Songs the user hid inside one playlist or album of the Spotify player. Only a view setting of this
 * device (`localStorage` `tm-spotify-hidden`, Zod-checked, never synced): Spotify itself is not touched.
 * "Abspielen" in the player leaves hidden songs out; the list can show them again at any time. Only
 * ids are kept, never names.
 */
import { z } from 'zod';

export const HIDDEN_KEY = 'tm-spotify-hidden';
const MAX_LISTS = 200;
const MAX_PER_LIST = 500;
const ID = /^[A-Za-z0-9]{1,40}$/;

const schema = z.record(z.string().regex(ID), z.array(z.string().regex(ID)).max(MAX_PER_LIST));
export type HiddenTracks = z.infer<typeof schema>;

export function readHidden(): HiddenTracks {
  try {
    const raw = localStorage.getItem(HIDDEN_KEY);
    if (!raw) return {};
    try {
      const parsed = schema.safeParse(JSON.parse(raw));
      if (parsed.success) return parsed.data;
    } catch {
      // Not JSON: treated like any damaged value.
    }
    localStorage.removeItem(HIDDEN_KEY);
  } catch {
    // Storage blocked: nothing is hidden.
  }
  return {};
}

function write(value: HiddenTracks): void {
  try {
    if (Object.keys(value).length === 0) localStorage.removeItem(HIDDEN_KEY);
    else localStorage.setItem(HIDDEN_KEY, JSON.stringify(value));
  } catch {
    // Storage blocked: the change holds for this session only.
  }
}

/** Hides (`on`) or shows one song of a list; returns the new state. */
export function setHidden(listId: string, trackId: string, on: boolean): HiddenTracks {
  if (!ID.test(listId) || !ID.test(trackId)) return readHidden();
  const all = readHidden();
  const set = new Set(all[listId] ?? []);
  if (on) set.add(trackId);
  else set.delete(trackId);
  const next = { ...all };
  if (set.size === 0) delete next[listId];
  else if (Object.keys(next).length < MAX_LISTS || next[listId])
    next[listId] = [...set].slice(-MAX_PER_LIST);
  write(next);
  return next;
}

/** Forgets every hidden song (disconnecting, resetting the device). */
export function clearHidden(): void {
  write({});
}
