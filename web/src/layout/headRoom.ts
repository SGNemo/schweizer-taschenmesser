/**
 * The room the row under the module head's title (figure, signature, strip) took on the last visit, per route and
 * device (U01, UI round 6): on the next load the frame keeps exactly that room while the page reads its data, so the
 * head neither grows when the page's figure and strip arrive nor shrinks for an empty module. A per-viewer convenience
 * in `localStorage`: missing or blocked storage only means the frame falls back to the head variant's default shape. A
 * value that is off (measured while the data still changed) only costs one small shift and is replaced on that visit.
 * `key` is the route pattern and layout, e.g. `/people@phone`.
 */
const KEY = 'tm-head-room:';

/** Height in rem from the last visit; `0` = the row was empty; `undefined` = not known yet. */
export function readHeadRoom(key: string): number | undefined {
  try {
    const raw = localStorage.getItem(KEY + key);
    if (raw === null) return undefined;
    const rem = Number(raw);
    return Number.isFinite(rem) && rem >= 0 && rem < 40 ? rem : undefined;
  } catch {
    return undefined;
  }
}

export function writeHeadRoom(key: string, rem: number): void {
  try {
    localStorage.setItem(KEY + key, String(Math.round(rem * 100) / 100));
  } catch {
    // storage blocked: the next load uses the default shape
  }
}
